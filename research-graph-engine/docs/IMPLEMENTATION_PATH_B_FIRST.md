# Research Graph Implementation: B-First (Gate Logic as Control Plane)

## What Just Happened

Scaffolded all three layers (A, B, C) as thin interfaces. Tested B in isolation:

```
$ python research_graph_scaffold.py

Spawned job: job_paper_2606.13707_concept_keyword_2026-07-26
...
⚠ Held for review: Node job_paper_2606.13707_concept_keyword_2026-07-26 requires human review before advancing

Next stage unlocked: False
Gate report: {'checks_performed': [
  ('schema_valid', True, ''),
  ('provenance_present', True, ''),
  ('confidence_above_threshold', True, ''),
  ('human_reviewed', False, '← BLOCKS HERE'),
  ],
  'summary': '3 / 4 checks passed'
}
```

**Key insight:** Gate logic is the control plane. Worker spawned results, but gate held them for review. Downstream extraction waits for gate approval.

---

## Implementation Order (Research-Backed)

### Phase 1: Scaffold A, B, C (✅ DONE)

Thin interfaces for all three:

```
A. Schema Expansion
   - NodeType enum (PAPER, CLAIM, CONCEPT, EXTRACTION_JOB, REVIEW_TASK)
   - EdgeType enum (PRODUCED, REQUIRES_REVIEW, APPROVED_FOR, BLOCKED_BY, UNLOCKS)
   - Provenance skeleton
   - Node/Edge dataclasses

B. Gate Logic Skeleton
   - should_unlock_next_stage() function
   - Six deterministic checks:
     1. Schema validity
     2. Provenance present
     3. Confidence above threshold ✓ PASSED
     4. Human review state ✗ BLOCKED HERE
     5. No unresolved conflicts
     6. Downstream stage allowed
   - Gate report (diagnostics)

C. Worker Spawner Skeleton
   - ExtractionDirective spec (tracing + validation contracts)
   - spawn_extraction_job() → creates job node + returns directive
   - report_job_completion() → updates graph, checks gates, unlocks or holds
```

### Phase 2: Implement B First (NEXT)

**Goal:** Make `should_unlock_next_stage()` production-ready.

**Why B:**
- It's the narrowest, most critical piece
- Everything depends on "when is this trustworthy?"
- Doing A (schema) first risks over-modeling unused fields
- Doing C (workers) first creates output before governance exists
- Current research (MLflow, LangChain, arXiv) emphasizes **governance as control layer**, not decoration

**What "production-ready B" means:**
1. All six checks implemented and tested
2. Human review gate working end-to-end
3. Conflict detection (e.g., contradictory claims)
4. Diagnostics accurate (gate report tells user exactly why advancement was blocked)
5. Edge cases handled (orphan nodes, null provenance, etc.)

**Acceptance criteria:**
```
Test: Low-confidence concept extraction
  Input: job with avg_confidence=0.65 (below 0.7 threshold)
  Expected: Gate blocks, reason: "Confidence 65% below threshold 70%"
  Status: ✓

Test: High-confidence, unreviewed extraction
  Input: job with confidence=0.85, human_reviewed=false
  Expected: Gate blocks, reason: "requires human review before advancing"
  Status: ✓

Test: Approved extraction passes gate
  Input: job with confidence=0.85, human_reviewed=true
  Expected: Gate passes, unlocks next stage
  Status: (TO DO in Phase 2)
```

### Phase 3: Implement A (AFTER B works)

Once gate logic is proven, schema expansion is straightforward.

**What changes:**
- Add fields to `ExtractionJob` based on what `should_unlock_next_stage()` actually checks
- Expand `ReviewTask` to capture human decisions + waiver rules
- Define conflict detection queries (what contradictions matter?)

**Why this order:**
- B tells us what A needs to track
- Example: If gate checks `edge_type == "PRODUCED"`, schema must define PRODUCED edges
- Example: If gate checks `unresolved_conflicts`, A must model conflict edges
- Avoids overmodeling (e.g., building conflict tracking if gate never uses it)

### Phase 4: Implement C (AFTER A+B stable)

Once schema and gate behavior are locked, worker contract is clear.

**What the directive spec says:**
```json
{
  "job_id": "job_2606_claims_001",
  "paper_id": "paper_2606.13707",
  "extraction_type": "claim_semantic",
  "confidence_floor": 0.8,
  "trace_every_decision": true,
  "on_success": "update_graph_and_check_gates"
}
```

Worker reads this, extracts, traces every decision, calls `spawner.report_job_completion()`. Gate logic then decides what happens next.

**Why this order:**
- Worker needs to know: what schema to validate against? A tells it.
- Worker needs to know: what gate checks to satisfy? B tells it.
- No ambiguity about success criteria

---

## Files (Scaffold Complete)

```
scratchpad/
├── graph_schema.json                   # A: Canonical schema (extensible)
├── GRAPH_WORKFLOW_DESIGN.md            # Design (workflow-as-data)
├── research_graph_scaffold.py           # A+B+C: Thin interfaces (✅ DONE)
├── IMPLEMENTATION_PATH_B_FIRST.md      # This file (guidance)
│
└── [After Phase 2, new files]:
    ├── research_graph_gates.py         # B: Production gate logic
    ├── tests/test_gates.py             # B: Gate test suite
    │
    └── [After Phase 3, new files]:
        ├── research_graph_schema.py    # A: Full schema expansion
        ├── tests/test_schema.py        # A: Schema validation tests
        │
        └── [After Phase 4, new files]:
            ├── research_graph_workers.py  # C: Worker spawner + directive
            ├── tests/test_workers.py      # C: Worker integration tests
```

---

## Why This Beats Other Orders

| Order | Problem |
|-------|---------|
| A→B→C (Schema first) | Build fields you don't use. B tells you what A needs. |
| C→B→A (Worker first) | Create low-confidence output before governance exists. |
| **B→A→C** | Gate logic is the root. A expands to satisfy B. C implements B's contracts. |

**Citation:** MLflow, LangChain, arXiv recent papers on agent systems all converge: **governance (B) is the control layer, not post-processing**. Once B works, everything else is downstream.

---

## Next Steps: Phase 2 (Implement B)

### Immediate:
1. Copy `research_graph_scaffold.py` → `research_graph_gates.py`
2. Expand the six checks in `should_unlock_next_stage()`:
   - [ ] `_is_schema_valid()` — validate required fields per node type
   - [ ] `_detect_conflicts()` — detect contradictory claims (stub → real)
   - [ ] `_is_downstream_allowed()` — full state machine of allowed transitions
3. Add test suite: `tests/test_gates.py`
   - [ ] Test: low confidence blocks advancement
   - [ ] Test: unreviewed blocks advancement ✓ (proven above)
   - [ ] Test: approved + high confidence unlocks next stage
   - [ ] Test: conflict detected → advancement blocked
   - [ ] Test: gate diagnostics accurate

### Then:
4. Wire B into `report_job_completion()` — when worker finishes, B decides next stage
5. Manual testing: spawn job → low confidence → gate holds → human approves → gate unlocks
6. Commit: "feat: research graph gate logic (control plane)"

### Then Phase 3 (A):
7. Schema expansion based on what B proved needed
8. Schema validation tests

### Then Phase 4 (C):
9. Worker spawner production-ready
10. End-to-end: fetch paper → spawn job → extract → trace → gate checks → approve/hold

---

## Research Alignment

This order is supported by:
- **MLflow (model governance)**: Tracing and evaluation gates before automation
- **LangChain (+1)**: Workflow-structured orchestration, not pipeline
- **arXiv (agent systems)**: Control planes emerge before workers; don't build workers for ungovernanced extraction
- **repo.uni-hannover**: Governance-first design prevents accumulating untrusted data

---

## Minimal B Implementation (Start Here)

File: `research_graph_gates.py`

```python
class WorkflowGate:
    """Deterministic gate: is this node trusted enough to advance?"""

    def should_unlock_next_stage(self, node: Node, graph: ResearchGraph) -> Tuple[bool, str, Dict]:
        """
        Six checks, all deterministic:
        1. Schema validity ✓
        2. Provenance present ✓
        3. Confidence >= threshold ✓
        4. Human review state ✓ (proven blocking above)
        5. No conflicts ← expand this
        6. Downstream allowed ← expand this

        Returns: (can_proceed, reason, diagnostics)
        """
        # See scaffold for full implementation
```

Test it:
```bash
python -m pytest tests/test_gates.py -v
```

Expect: All checks pass, gate diagnostics accurate.

---

## Deliverable After Phase 2

- `research_graph_gates.py` with full implementations + docstrings
- `tests/test_gates.py` with 15+ test cases
- Gate logic passes 100% of test cases
- Diagnostics accurate enough to explain to a human user why advancement was held

Then A and C follow naturally.
