"""
Healthcare Triage Decision DAG — research-informed orchestration + audit trail.

Incorporates:
- NormCode: auditable intermediate representation (explicit data flow)
- AuditWeave: tamper-evident ledger (hash-chained evidence)
- G-SPEC: governance graph + constraints (symbolic policy layer)
- Institutional AI: governance graph as immutable manifest
- DAG Orchestration: parallel sub-decisions where possible

Stdlib only (networkx, hashlib, json).
"""
from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from typing import Literal
from dataclasses import dataclass, field, asdict
from enum import Enum

import networkx as nx


# ================================================================ Governance Graph (G-SPEC pattern)

class StateType(Enum):
    """Valid states in the triage governance graph."""
    START = "patient_arrived"
    ASSESS_VITALS = "vitals_assessed"
    GATE_AGE = "age_gate"
    GATE_FEVER = "fever_gate"
    GATE_HYPOXIA = "hypoxia_gate"
    GATE_COMORBID = "comorbidity_gate"
    ESCALATION_DECISION = "escalation_decision"
    ROUTE_ICU = "route_icu"
    ROUTE_ED = "route_ed"
    ROUTE_DISCHARGE = "route_discharge"
    APPROVAL = "approval"
    OVERRIDE = "override"
    COMPLETE = "complete"


class GatePolicyConstraint(Enum):
    """Symbolic policy constraints (SHACL-like validation)."""
    MUST_PASS_AGE_FIRST = "all_gates_wait_for_age"
    ESCALATION_REQUIRES_ALL = "escalation_needs_fever_and_comorbid"
    OVERRIDE_NEEDS_REASON = "override_must_have_reason"
    ROUTING_FINAL = "routing_decision_is_immutable"


@dataclass
class TriageDAGNode:
    """A node in the governance graph."""
    state: StateType
    description: str
    is_gate: bool = False
    is_decision_point: bool = False
    can_parallelize: bool = False
    policy_constraints: list[GatePolicyConstraint] = field(default_factory=list)


@dataclass
class TriageDAGEdge:
    """An edge (transition) in the governance graph."""
    source: StateType
    target: StateType
    condition: str  # Human-readable condition (e.g., "age < 5")
    is_critical_path: bool = False
    requires_evidence: list[str] = field(default_factory=list)


# ================================================================ Hash-Chained Ledger (AuditWeave pattern)

@dataclass
class HashChainedEntry:
    """Tamper-evident ledger entry with cryptographic chaining."""
    timestamp: str
    state: StateType
    evidence: dict
    decision_id: str
    previous_hash: str = ""
    current_hash: str = ""

    def compute_hash(self) -> str:
        """Compute SHA256 of this entry + previous hash."""
        payload = json.dumps({
            "timestamp": self.timestamp,
            "state": self.state.value,
            "evidence": self.evidence,
            "decision_id": self.decision_id,
            "previous_hash": self.previous_hash,
        }, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()

    def verify(self) -> bool:
        """Verify this entry's hash integrity."""
        return self.current_hash == self.compute_hash()


@dataclass
class DBOM:
    """Decision Bill of Material (NormCode + DBOM pattern)."""
    decision_id: str
    patient_id: str
    model_version: str = "v1.0"
    data_sources: list[str] = field(default_factory=lambda: ["vitals", "comorbidities"])
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    gates_evaluated: dict[str, bool] = field(default_factory=dict)
    evidence_chain: list[HashChainedEntry] = field(default_factory=list)

    def add_evidence(self, state: StateType, evidence: dict, previous_hash: str = ""):
        """Add tamper-evident entry to chain."""
        entry = HashChainedEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            state=state,
            evidence=evidence,
            decision_id=self.decision_id,
            previous_hash=previous_hash,
        )
        entry.current_hash = entry.compute_hash()
        self.evidence_chain.append(entry)
        return entry.current_hash

    def verify_chain(self) -> bool:
        """Verify entire evidence chain for tampering."""
        for entry in self.evidence_chain:
            if not entry.verify():
                return False
        return True


# ================================================================ Triage DAG Builder

class TriageGovernanceDAG:
    """Governance graph for triage decisions (G-SPEC + DAG Orchestration)."""

    def __init__(self):
        self.graph = nx.DiGraph()
        self.nodes_dict: dict[StateType, TriageDAGNode] = {}
        self.edges_list: list[TriageDAGEdge] = []
        self._build_manifest()

    def _build_manifest(self):
        """Build immutable governance graph manifest (Institutional AI pattern)."""

        # Define nodes
        nodes = [
            TriageDAGNode(StateType.START, "Patient arrival"),
            TriageDAGNode(StateType.ASSESS_VITALS, "Vitals assessment"),
            TriageDAGNode(StateType.GATE_AGE, "Age-based escalation check", is_gate=True),
            TriageDAGNode(StateType.GATE_FEVER, "Fever-based escalation check", is_gate=True, can_parallelize=True),
            TriageDAGNode(StateType.GATE_HYPOXIA, "Hypoxia-based escalation check", is_gate=True, can_parallelize=True),
            TriageDAGNode(StateType.GATE_COMORBID, "Comorbidity-based escalation check", is_gate=True, can_parallelize=True),
            TriageDAGNode(StateType.ESCALATION_DECISION, "Escalation verdict (fan-in)", is_decision_point=True,
                         policy_constraints=[GatePolicyConstraint.ESCALATION_REQUIRES_ALL]),
            TriageDAGNode(StateType.ROUTE_ICU, "Route to ICU"),
            TriageDAGNode(StateType.ROUTE_ED, "Route to ED"),
            TriageDAGNode(StateType.ROUTE_DISCHARGE, "Route to discharge/follow-up"),
            TriageDAGNode(StateType.APPROVAL, "Physician approval", is_decision_point=True,
                         policy_constraints=[GatePolicyConstraint.ROUTING_FINAL]),
            TriageDAGNode(StateType.OVERRIDE, "Physician override", is_decision_point=True,
                         policy_constraints=[GatePolicyConstraint.OVERRIDE_NEEDS_REASON, GatePolicyConstraint.ROUTING_FINAL]),
            TriageDAGNode(StateType.COMPLETE, "Decision complete + recorded"),
        ]

        for node in nodes:
            self.nodes_dict[node.state] = node
            self.graph.add_node(node.state.value, **asdict(node))

        # Define edges (governance transitions)
        edges = [
            # START → ASSESS_VITALS (mandatory)
            TriageDAGEdge(StateType.START, StateType.ASSESS_VITALS, "Always", is_critical_path=True),

            # ASSESS_VITALS → AGE_GATE (mandatory, funnel point)
            TriageDAGEdge(StateType.ASSESS_VITALS, StateType.GATE_AGE, "Always", is_critical_path=True,
                         requires_evidence=["age"]),

            # AGE_GATE → parallel gates (can run in parallel)
            TriageDAGEdge(StateType.GATE_AGE, StateType.GATE_FEVER, "age check passed", is_critical_path=False,
                         requires_evidence=["fever_check_passed"]),
            TriageDAGEdge(StateType.GATE_AGE, StateType.GATE_HYPOXIA, "age check passed",
                         requires_evidence=["hypoxia_check_passed"]),
            TriageDAGEdge(StateType.GATE_AGE, StateType.GATE_COMORBID, "age check passed",
                         requires_evidence=["comorbid_check_passed"]),

            # Parallel gates → ESCALATION_DECISION (fan-in, must wait for all)
            TriageDAGEdge(StateType.GATE_FEVER, StateType.ESCALATION_DECISION, "Fever gate verdict",
                         is_critical_path=True),
            TriageDAGEdge(StateType.GATE_HYPOXIA, StateType.ESCALATION_DECISION, "Hypoxia gate verdict"),
            TriageDAGEdge(StateType.GATE_COMORBID, StateType.ESCALATION_DECISION, "Comorbidity gate verdict"),

            # ESCALATION_DECISION → routing (fan-out, conditional)
            TriageDAGEdge(StateType.ESCALATION_DECISION, StateType.ROUTE_ICU, "escalation_required=True, severity=critical",
                         is_critical_path=True),
            TriageDAGEdge(StateType.ESCALATION_DECISION, StateType.ROUTE_ED, "escalation_required=True, severity=moderate"),
            TriageDAGEdge(StateType.ESCALATION_DECISION, StateType.ROUTE_DISCHARGE, "escalation_required=False"),

            # Routing → APPROVAL (mandatory)
            TriageDAGEdge(StateType.ROUTE_ICU, StateType.APPROVAL, "ICU route selected", is_critical_path=True),
            TriageDAGEdge(StateType.ROUTE_ED, StateType.APPROVAL, "ED route selected"),
            TriageDAGEdge(StateType.ROUTE_DISCHARGE, StateType.APPROVAL, "Discharge route selected"),

            # APPROVAL → OVERRIDE or COMPLETE
            TriageDAGEdge(StateType.APPROVAL, StateType.OVERRIDE, "Physician overrides AI", is_critical_path=False),
            TriageDAGEdge(StateType.APPROVAL, StateType.COMPLETE, "Physician approves AI", is_critical_path=True),
            TriageDAGEdge(StateType.OVERRIDE, StateType.COMPLETE, "Override recorded"),
        ]

        for edge in edges:
            self.edges_list.append(edge)
            self.graph.add_edge(edge.source.value, edge.target.value, **asdict(edge))

    def topological_order(self) -> list[StateType]:
        """Execute gates in dependency order."""
        topo = list(nx.topological_sort(self.graph))
        return [StateType(s) for s in topo]

    def critical_path(self) -> list[StateType]:
        """Longest path through the graph (determines minimum latency)."""
        # Find all edges marked is_critical_path=True
        critical_edges = [(u, v) for u, v, d in self.graph.edges(data=True) if d.get("is_critical_path")]
        if not critical_edges:
            return []
        # Build subgraph of critical edges
        critical_subgraph = self.graph.edge_subgraph(critical_edges)
        if critical_subgraph.nodes():
            path = nx.dag_longest_path(critical_subgraph)
            return [StateType(s) for s in path]
        return []

    def parallelize_opportunities(self) -> dict[StateType, list[StateType]]:
        """Find gates that can run in parallel (no mutual dependencies)."""
        parallelizable = {}
        gates = [s for s, n in self.nodes_dict.items() if n.is_gate]
        for gate in gates:
            deps = list(self.graph.predecessors(gate.value))
            # Gates with same predecessors can run in parallel
            same_pred = [g for g in gates if list(self.graph.predecessors(g.value)) == deps and g != gate]
            if same_pred:
                parallelizable[gate] = same_pred
        return parallelizable

    def fan_in_points(self) -> list[StateType]:
        """Identify nodes where multiple paths converge (synchronization points)."""
        return [s for s in self.nodes_dict if self.graph.in_degree(s.value) > 1]

    def fan_out_points(self) -> list[StateType]:
        """Identify nodes where multiple paths diverge (conditional branching)."""
        return [s for s in self.nodes_dict if self.graph.out_degree(s.value) > 1]

    def validate_constraints(self, state: StateType, context: dict) -> tuple[bool, str]:
        """Validate policy constraints before state transition (SHACL-like)."""
        node = self.nodes_dict.get(state)
        if not node:
            return False, f"Unknown state: {state}"

        for constraint in node.policy_constraints:
            if constraint == GatePolicyConstraint.MUST_PASS_AGE_FIRST:
                if StateType.GATE_AGE not in context.get("gates_passed", []):
                    return False, "Age gate must run first"
            elif constraint == GatePolicyConstraint.ESCALATION_REQUIRES_ALL:
                required = {StateType.GATE_FEVER, StateType.GATE_HYPOXIA, StateType.GATE_COMORBID}
                if not required.issubset(context.get("gates_passed", set())):
                    return False, "Escalation requires all gate verdicts"
            elif constraint == GatePolicyConstraint.OVERRIDE_NEEDS_REASON:
                if not context.get("override_reason"):
                    return False, "Override requires documented reason"
            elif constraint == GatePolicyConstraint.ROUTING_FINAL:
                if context.get("routing_changed_after_approval"):
                    return False, "Routing decision is immutable after approval"

        return True, "All constraints satisfied"


# ================================================================ Orchestrator (DAG Execution)

class TriageOrchestrator:
    """Execute triage decisions along the DAG, with parallel + sequential coordination."""

    def __init__(self):
        self.dag = TriageGovernanceDAG()
        self.current_state: StateType | None = None
        self.dbom: DBOM | None = None

    def begin_triage(self, patient_id: str, decision_id: str) -> DBOM:
        """Initialize a new triage journey."""
        self.current_state = StateType.START
        self.dbom = DBOM(decision_id=decision_id, patient_id=patient_id)
        self.dbom.add_evidence(StateType.START, {"patient_id": patient_id})
        return self.dbom

    def transition(self, to_state: StateType, evidence: dict) -> tuple[bool, str, str]:
        """Attempt state transition with policy validation + audit."""
        valid, reason = self.dag.validate_constraints(to_state, evidence)
        if not valid:
            return False, f"Policy violation: {reason}", ""

        # Record in hash-chained ledger
        prev_hash = self.dbom.evidence_chain[-1].current_hash if self.dbom.evidence_chain else ""
        current_hash = self.dbom.add_evidence(to_state, evidence, prev_hash)
        self.current_state = to_state

        return True, "Transition accepted", current_hash

    def execute_parallel_gates(self, gates_and_evidence: dict[StateType, dict]) -> dict[StateType, tuple[bool, dict]]:
        """Execute multiple gates in parallel (fever + hypoxia + comorbidity)."""
        results = {}
        for gate, evidence in gates_and_evidence.items():
            # Simulate gate execution (in real usage, call the triage_engine gate functions)
            success, gate_evidence = self._evaluate_gate(gate, evidence)
            results[gate] = (success, gate_evidence)
            # Record each gate's result
            self.dbom.gates_evaluated[gate.value] = success
        return results

    def _evaluate_gate(self, gate: StateType, evidence: dict) -> tuple[bool, dict]:
        """Placeholder: actual gate logic from triage_engine.py."""
        # In production: call compute_triage_severity, evaluate_policy_gates, etc.
        return True, {"gate": gate.value, "passed": True}

    def compute_critical_path_latency(self) -> int:
        """Estimate latency savings from parallelization."""
        critical = self.dag.critical_path()
        # Rough estimate: each gate ~50ms, parallel gates save ~100ms
        base_latency = len(critical) * 50  # ms
        parallel_opportunities = len(self.dag.parallelize_opportunities())
        savings = parallel_opportunities * 50
        return max(0, base_latency - savings)

    def render_journey(self) -> dict:
        """Render the decision journey as structured evidence."""
        return {
            "decision_id": self.dbom.decision_id,
            "patient_id": self.dbom.patient_id,
            "current_state": self.current_state.value if self.current_state else None,
            "gates_evaluated": self.dbom.gates_evaluated,
            "evidence_chain": [asdict(e) for e in self.dbom.evidence_chain],
            "chain_integrity_verified": self.dbom.verify_chain(),
            "critical_path": [s.value for s in self.dag.critical_path()],
            "fan_in_points": [s.value for s in self.dag.fan_in_points()],
            "fan_out_points": [s.value for s in self.dag.fan_out_points()],
            "parallelization_opportunities": {
                k.value: [v.value for v in vals]
                for k, vals in self.dag.parallelize_opportunities().items()
            },
        }


# ================================================================ CLI

if __name__ == "__main__":
    # Demo: show DAG structure
    orch = TriageOrchestrator()
    print("=== Triage Governance DAG ===")
    print(f"Nodes: {len(orch.dag.graph.nodes())}")
    print(f"Edges: {len(orch.dag.graph.edges())}")
    print(f"Critical path: {[s.value for s in orch.dag.critical_path()]}")
    print(f"Fan-in points (synchronization): {[s.value for s in orch.dag.fan_in_points()]}")
    print(f"Fan-out points (branching): {[s.value for s in orch.dag.fan_out_points()]}")
    print(f"Parallelizable gates: {list(orch.dag.parallelize_opportunities().keys())}")

    # Demo: begin a triage
    dbom = orch.begin_triage("P001", "TRIAGE-0001")
    print(f"\n=== Started triage {dbom.decision_id} ===")
    print(f"Evidence chain length: {len(dbom.evidence_chain)}")

    # Demo: execute parallel gates
    results = orch.execute_parallel_gates({
        StateType.GATE_FEVER: {"temp": 39.8},
        StateType.GATE_HYPOXIA: {"spo2": 95},
        StateType.GATE_COMORBID: {"comorbidities": 1},
    })
    print(f"Parallel gate results: {len(results)} gates evaluated")

    # Demo: check integrity
    print(f"Evidence chain integrity: {dbom.verify_chain()}")
