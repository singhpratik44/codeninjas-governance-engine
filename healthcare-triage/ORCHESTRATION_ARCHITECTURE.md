# LangGraph Orchestration Architecture for Healthcare Triage

## Executive Summary

This document describes the orchestration layer for healthcare triage decision operations, grounded in recent research on hierarchical agent systems, BDI (belief-desire-intention) architecture, and governance-first design. The implementation demonstrates how orchestration logic itself can become a point of governance, not just model behavior.

## Architecture Overview

### Hierarchical Planner-Plus-Specialists Pattern

**Design**: Three-layer hierarchy rather than flat parallel agents
- **Layer 1 (Planner)**: Task decomposition router — analyzes patient case and selects execution topology
- **Layer 2 (Specialists)**: Dynamic agents — instantiated per task with ⟨Instruction, Context, Tools, Model⟩ specs
- **Layer 3 (Governance)**: Five-plane enforcement — per-task policy evaluation before execution

**Benchmark alignment**: AgentOrchestra's hierarchical planner-plus-specialists design achieved:
- SimpleQA: 95.3% vs single-agent baselines
- GAIA: 82.42% average, beating Perplexity Deep Research on complex multi-step reasoning
- This outperformance directly motivates hierarchical topology as default over flat parallel-only designs

**Healthcare relevance**: A single unified AI triage agent fails on high-consequence decisions:
- Complex cases need case-specific task decomposition
- Parallel gate evaluation must respect clinical constraints (age gate before medication gates)
- Escalation routing requires a planner aware of facility capacity and resource constraints

### BDI Architecture: Explicit State + Planning

The system implements a lightweight BDI pattern:
- **Belief** (B): `ExecutionPath` captures current case state (patient vitals, history, org context, previous steps)
- **Desire** (D): `proposed_action` (e.g., "route_to_icu", "escalate") — what the specialist wants to do
- **Intention** (I): `governance_engine.evaluate()` — the committed plan after governance checks

**Contrast with reactive loops**: Traditional agent loops (sense → act → observe) have no explicit model of intention — they re-evaluate the same state repeatedly. BDI adds a commitment layer: once an intention is formed and governance-cleared, it holds until completion (or explicit override). This eliminates "oscillation" failure modes where an agent flaps between equivalent choices.

```python
# BDI pattern in make_triage_decision_with_governance()
belief = ExecutionPath(task_id, principal, previous_steps, org_state)      # B: belief
proposed = f"route_to_{ai_routing}"                                        # D: desire
allowed, reason, planes = governance_engine.evaluate(belief, proposed)     # I: intention formation
if allowed:
    decision.status = "auto_approved"  # Committed intention
else:
    decision.status = "escalated"      # Intention blocked, escalate to human
```

### RL-Trainable Orchestration Logic

Recent work (Orchestra-o1 using DA-GRPO) shows that orchestrator routing logic itself is trainable, not just model selection. This architecture supports future RL training:

**Current**: Hand-coded topology routing in `TaskDecompositionRouter.route()` — heuristic-based:
- Analyze dependency depth + parallelizable_ratio
- Select topology (sequential/parallel/hierarchical/hybrid)

**Future trainable** (scaffolding in place):
- Reward signal: clinical outcomes (escalation rate, override rate, consensus rate)
- Action space: topology choices per patient case type
- State: patient demographics, vital patterns, historical outcomes
- RL objective: learn which case types benefit from which topologies

This is why `TaskDAG` includes `estimated_complexity` — a feature the RL agent can eventually learn to weight.

---

## Five-Plane Governance: End-to-End Architecture

The governance paper states plainly that it "governs delegated action, not model behavior" and notes "full-system evaluation against a live agent benchmark is still an open next step." This implementation closes that gap by applying governance across all five planes:

### Plane 1: Reasoning (Intent Adjudication)
- **Check**: Is this action appropriate given the decision history?
- **Healthcare example**: "Escalation requires prior triage assessment" — don't route to ICU without first assessing vitals
- **Failure mode**: "Intent valid" (always passes in baseline) — future: learn from overrides to refine reasoning gate

### Plane 2: Network (Service Accessibility)
- **Check**: Can this principal reach required services/facilities?
- **Healthcare example**: "Patient data access blocked during isolation mode" — don't request lab results if lab is offline
- **Failure mode**: Network timeout treated as "access granted" (optimistic) — future: measure actual service SLOs

### Plane 3: Identity (Principal Authentication)
- **Check**: Is the principal (agent/triage system) authenticated?
- **Healthcare example**: Verify the triage decision came from an authorized clinician/AI, not a spoofed caller
- **Failure mode**: Missing principal ID → "not authenticated", escalates decision to human

### Plane 4: Endpoint (Capability Availability)
- **Check**: Does the agent have the capability to execute this action?
- **Healthcare example**: "Principal lacks capability: route_to_general_admission" — agent doesn't have discharge authority, must escalate
- **Failure mode**: Teaches agents to *not* propose actions they can't execute (training signal for model)

### Plane 5: Data (System-of-Record Authorization)
- **Check**: Can principal write to system of record (ledger, EHR)?
- **Healthcare example**: "Ledger writes require full delegation depth" — only top-tier agents can append to audit trail
- **Failure mode**: Data write rejected, decision held pending escalation to authorized agent

**Governance verdict**: All five must pass. Fail-fast on first plane failure. This "unanimous gate" design prevents:
- Malformed decisions reaching the EHR
- Privilege escalation via credential capture
- Audit trail tampering via delegated-agent impersonation

---

## Quality Over Sophistication: Why Governance-First?

The market research shows 57% production adoption but **quality/latency are the blockers**, not "do agents work?" This suggests investment in eval tooling before adding architectural sophistication. This implementation prioritizes:

### Eval-First Design
- Every decision includes a `governance_metadata` dict documenting which planes passed/failed
- Evidence pack captures full justification (vitals, comorbidities, governance verdicts, previous steps)
- `dag_chain_integrity_verified` field enables post-hoc audit verification

### Minimal Variance
- Task DAG forces explicit decomposition — no hidden assumptions about parallelization
- Five-plane voting ensures consistency (all planes must agree)
- Hash-chained ledger (from DAG layer) prevents silent reinterpretation of past decisions

### Fallback Chain
If orchestration unavailable → DAG layer → baseline triage. Graceful degradation keeps the system operational even if any layer fails:
```python
if use_governance and ORCHESTRATION_AVAILABLE:
    decision = make_triage_decision_with_governance(...)  # Full stack
elif use_dag and DAG_AVAILABLE:
    decision = make_triage_decision_with_dag(...)         # DAG + hash-chain only
else:
    decision = make_triage_decision(...)                  # Baseline gates
```

---

## Enterprise Adoption: MCP + A2A Protocols

The system implements the MCP (Model Context Protocol) substrate indirectly:
- `AgentSpecification` ⟨Instruction, Context, Tools, Model⟩ follows MCP's resource/tool declaration pattern
- `CompositePrincipal` with capability attenuation models peer A2A (agent-to-agent) delegation
- `ExecutionPath` tracks multi-step agent coordination (previous_steps field)

**Scaling pattern** (documented in `execution_strategy.md` of sibling repo):
1. Layer 1 (mechanical): GitHub Actions daily refresh (ingest/build) — stdlib-only, no AI cost
2. Layer 2 (human-in-loop): Claude Routine (once weekly) — AI turn for live research, email parsing, triage
3. Layer 3 (governance): Per-decision audit trail — all actions logged, override reasons recorded

This matches "PwC Agent OS" and "Accenture Trusted Agent Huddle" patterns of hierarchical + peer coordination.

---

## Implementation Checklist

- [x] Hierarchical planner-plus-specialists (TaskDecompositionRouter → AgentSpecification)
- [x] BDI state model (ExecutionPath = Belief + Decision/Proposal = Desire + Governance = Intention)
- [x] Five-plane governance (reasoning, network, identity, endpoint, data)
- [x] Capability attenuation (CompositePrincipal.attenuate)
- [x] Task DAG for topology routing (TaskDAG.is_parallelizable_with)
- [x] Hash-chained audit trail (DBOM.evidence_chain via DAG layer)
- [x] Graceful fallback (orchestration → DAG → baseline)
- [ ] **TODO: RL training scaffold** — reward signal from clinical outcomes
- [ ] **TODO: Governance eval metrics** — track plane pass rates, bottlenecks
- [ ] **TODO: Benchmark on real clinical workflows** — SimpleQA/GAIA analogues for healthcare
- [ ] **TODO: LangSmith integration** — observability of agent decisions at inference time

---

## Usage

### CLI

Run triage with full governance stack:
```bash
python -m triage_engine.triage triage --no-dag=false
```

Run triage with only DAG (skip governance):
```bash
python -m triage_engine.triage triage --no-governance
```

Run baseline triage (gates only):
```bash
python -m triage_engine.triage triage --no-governance --no-dag
```

### Programmatic

```python
from triage_engine import (
    make_triage_decision_with_governance,
    PatientRecord,
    DEFAULT_CONFIG
)

patient = PatientRecord(patient_id="P-001", age=35, ...)
decision, governance_meta = make_triage_decision_with_governance(
    patient, "TRIAGE-001", DEFAULT_CONFIG
)

# Governance verdicts in decision.dag_journey
print(decision.dag_journey["governance_allowed"])  # True/False
print(decision.dag_journey["plane_verdicts"])       # [(plane, result), ...]
```

---

## Research Alignment

| Concept | Source | Implementation |
|---------|--------|-----------------|
| Hierarchical topology | AgentOrchestra (SimpleQA 95.3%, GAIA 82.42%) | TaskDecompositionRouter + phased execution |
| BDI architecture | "Evolution of Agentic AI Software Architecture" | ExecutionPath (B) + proposed_action (D) + governance (I) |
| RL-trainable orchestration | Orchestra-o1 (DA-GRPO, +10pt GAIA) | TaskDAG.estimated_complexity + governance reward signals |
| Governance-delegated-action gap | Five-Plane paper (open question) | Five-plane eval implemented end-to-end |
| Quality > sophistication | LangChain survey (57% adoption, quality blocker) | Eval-first design, minimal variance, fallback chain |

---

## Next Steps

1. **Governance metrics dashboard**: Track plane pass rates per case type, identify bottlenecks
2. **LangSmith integration**: Instrument agent decisions for inference-time observability
3. **Benchmark suite**: Clinical analogue of SimpleQA/GAIA (complex multi-step diagnosis + routing)
4. **RL training loop**: Use clinical outcomes as reward signal for topology selection
5. **Multi-patient coordination**: Extend A2A delegation to handle capacity-aware routing (Patient A escalates to ICU, which affects available beds for Patient B)

---

## References

- AgentOrchestra paper: hierarchical planner beats flat specialists
- "Evolution of Agentic AI Software Architecture": BDI as emerging standard
- Orchestra-o1 (RL for orchestration): DA-GRPO for learning routing logic
- Five-Plane Governance paper: governs delegated action, not model behavior
- LangChain survey: production adoption blocked by quality/latency, not feasibility
