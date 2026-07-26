# research-graph-engine

A governed knowledge graph for research literature. Papers go in; validated, provenance-
tracked claims and concepts come out — and nothing advances a stage without passing a
deterministic gate that records *why*.

The point isn't the extraction. It's that every node in the graph can answer: who produced
me, from what source, with what confidence, which checks did I pass, and if a human waived
one of those checks — who, and on what grounds.

```
spawn ──► worker extracts ──► envelope validated ──► gate ──► HELD ──► human review ──► unlock
                                    (untrusted)      (6 checks)         (waiver audited)
```

Stdlib only. No network imports. 106 tests, no external test dependencies.

```bash
python3 -m unittest discover -p 'test_*.py' -q
```

## The three planes

| Plane | File | Responsibility |
|---|---|---|
| **Control** | `research_graph_gates.py` | Six deterministic checks; explicit reason codes; every decision fully traced |
| **Data** | `research_graph_schema.py` | Node/edge/trace/conflict types, closed enums, structural validation |
| **Execution** | `research_graph_workers.py` | Directive out, envelope back, admission control over untrusted workers |

They were built in that order — control first — deliberately. Schema expanded to satisfy
what the gate actually checks rather than what seemed plausible to model; workers were
written last, against a contract that already existed. `docs/BUILD_NOTES.md` records what
each phase proved and the one structural mismatch that surfaced along the way.

## The gate

Six checks, run in order, short-circuiting on the first failure. Each emits a `CheckTrace`
with evidence; the aggregate is a `GateDecision` carrying every check that ran.

| Check | Blocks with |
|---|---|
| schema validity | `SCHEMA_INVALID` |
| provenance present | `PROVENANCE_MISSING` |
| confidence ≥ threshold | `LOW_CONFIDENCE` |
| human review state | `REVIEW_REQUIRED` |
| no unresolved conflicts | `CONFLICT_UNRESOLVED` |
| node type may advance | `DOWNSTREAM_NOT_ALLOWED` |

Passing all six gives `ALLOWED` — or `ALLOWED_BY_WAIVER` if a human override was involved,
which is a distinct verdict on purpose. `report()` counts waived passes separately, because
a rising waiver rate means the threshold or the extractor is wrong, and the response to that
is to fix one of them, not to keep waiving.

## Waivers are governed, not an escape hatch

A human can waive the confidence gate. Four rules keep that honest:

- **Fail closed on invisibility** — a waiver the gate can't see is no waiver.
- **A defective waiver is no waiver** — no `waiver_reason`, no `reviewed_by` (no accountable
  human), status not `approved`, or a review task not itself reviewed → still blocked, with
  the specific defect named in the trace.
- **`waiver_confidence_floor`** (default 0.4) — a waiver rescues a borderline node, not an
  arbitrarily bad one. Without a floor the confidence gate is decorative.
- **`honor_waivers=False`** disables the path entirely.

## Workers are untrusted

LLM, regex, or a human pasting JSON — no difference. The spawner validates the whole
envelope before anything reaches the graph, and a bad envelope fails *whole*: a
half-admitted extraction is unauditable. Rejected:

- returning a node type the directive didn't ask for
- emitting a node with no `EXTRACT` trace explaining it
- a trace claiming an output that isn't in the envelope
- claiming a `source_paper` other than the directive's
- marking its own output `human_reviewed`
- emitting results below the directive's confidence floor
- duplicate ids, collisions with the live graph, `max_results` overruns

All errors are collected rather than short-circuited, so a worker gets its whole report card
in one pass.

`ReferenceWorker` is a deliberately dumb deterministic extractor. It exists so the loop runs
end to end with no model in it — if the plumbing only works with an LLM attached, the
plumbing isn't proven. It traces its negative decisions too: SKIP below floor, ABSTAIN at
`max_results`.

## Traces are structured

Not a text blob. Each entry carries `trace_id`, `timestamp`, `worker_id`, `decision_type`,
`confidence`, `reason_code`, `reasoning_summary`, `input_refs`, `output_refs` — so decisions
stay queryable ("every ABSTAIN by worker X under 0.6") rather than greppable. A malformed
trace invalidates its parent node.

## graph_schema.json is generated

Emitted from the same `FieldSpec`s that `validate_node()` enforces, so the published contract
and the enforced contract cannot drift:

```bash
python3 research_graph_schema.py --emit-json-schema > graph_schema.json
```

A test fails if the checked-in file is stale or hand-edited. Another fails if the gate's
required-field table and `NODE_SCHEMA` diverge.

## Example

```python
from research_graph_schema import ResearchGraph, ExtractionType
from research_graph_gates import WorkflowGate
from research_graph_workers import WorkerSpawner, ReferenceWorker

graph = ResearchGraph()
sp = WorkerSpawner(graph, WorkflowGate(confidence_threshold=0.9))

job, directive = sp.spawn("paper_2606.13707", ExtractionType.CLAIMS)
envelope = ReferenceWorker().run(directive, "Hierarchical orchestration reduces overhead.")

result = sp.admit(directive, envelope)
# -> admitted, but HELD: LOW_CONFIDENCE (85% < 90%); a review_task was opened

decision = sp.approve_review(
    result.review_task.id, "reviewer@example.com", "Triple verified by hand",
    waive_confidence=True, waiver_reason="0.85 is parser caution, not doubt")
# -> ALLOWED_BY_WAIVER; the waiver, its reason, and its author are in the trace
```

## Status

Built through Phase 4. All six gate checks have real implementations and real producers.
Conflict *detection* is deliberately shallow — same subject/object with opposed relation
verbs — because real semantic contradiction detection belongs in a worker, not in the
control plane. The gate doesn't find conflicts; it refuses to advance past unresolved ones.
