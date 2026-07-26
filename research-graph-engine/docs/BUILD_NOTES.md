# Phase 3 complete — schema expansion (data plane)

**Status:** 61/61 tests green (17 Phase-2 gate tests unchanged + 44 new). Additive: no line
of `research_graph_gates.py` was modified.

## Files

| File | Role |
|---|---|
| `research_graph_schema.py` | Enums, `Trace`, `Node`/`Edge`/`ConflictEdge`, `NODE_SCHEMA` FieldSpecs, validators, conflict-detection stub, `ResearchGraph`, JSON-Schema exporter |
| `golden_fixtures.py` | The four canonical states |
| `test_schema.py` | 44 tests |
| `graph_schema.json` | **Generated** from `NODE_SCHEMA` — regenerate with `python3 research_graph_schema.py --emit-json-schema > graph_schema.json` |

## The three review adjustments

**1. Traces are structured.** `Trace` carries `trace_id`, `timestamp`, `worker_id`,
`decision_type`, `confidence`, `reason_code`, `reasoning_summary`, `input_refs`,
`output_refs`. Validated per-entry — a malformed trace invalidates its parent node
(`test_bad_trace_invalidates_its_node`), so observability can't rot silently. Round-trips
through JSON back into `Trace` objects, not dicts.

**2. Enums are closed.**
`JobStatus` queued|running|completed|failed|held|approved|rejected ·
`ReviewStatus` pending|approved|rejected|needs_revision ·
`ExtractionType` claims|concepts|methods|benchmarks|conflicts ·
`ConflictType` contradicts|incompatible_scope|method_dependent ·
plus `DecisionType` (extract|skip|merge|flag_conflict|abstain) and `ExtractionMethod`,
which the trace and provenance validators needed.

**3. Golden fixtures — all four exist and are exercised twice**, once against the schema
and once through the unmodified gate:

| Fixture | Schema | Gate verdict |
|---|---|---|
| auto-pass job | valid | `ALLOWED` |
| low-confidence held job | valid | `LOW_CONFIDENCE` |
| human-waived job | valid | `LOW_CONFIDENCE` ← see below |
| conflict claim pair | valid | `DOWNSTREAM_NOT_ALLOWED` (claims terminal) |

## Pre-merge checklist — verified

- ✅ Schema rejects `extraction_job` missing `paper_id` (`MISSING_REQUIRED`)
- ✅ Schema rejects `extraction_job` missing `extraction_type`
- ✅ Schema rejects `review_task` missing `extraction_job_id`
- ✅ All 17 gate tests pass unchanged
- ✅ Four golden fixtures exist and validate
- ✅ Bonus guard: `test_every_gate_required_field_is_declared_in_schema` fails if the gate's
  hardcoded required-field table and `NODE_SCHEMA` ever drift apart
- ✅ Bonus guard: `test_graph_schema_json_is_current` fails if anyone hand-edits the
  generated JSON schema

---

# Phase 4 — workers (done)

**106/106 tests green.** The 17 original gate tests still pass untouched.

`research_graph_workers.py` + `test_workers.py` (36 tests). The governing assumption is
that **a worker is untrusted** — LLM, regex, or a human pasting JSON, it makes no
difference. Nothing it returns enters the graph until the spawner has validated the whole
envelope, and a bad envelope fails *whole*, never partially. A half-admitted extraction is
unauditable.

**Three contracts.** `ExtractionDirective` goes out (what to extract, the confidence floor,
the target node type, the required trace fields, and the gate threshold echoed so a worker
never has to read the gate's source to know what it's aiming at). `ResultEnvelope` comes
back — nodes and traces always travel together. `WorkerSpawner` is the only writer to the
graph.

**What gets rejected** (each has a test):

| Attack | Caught by |
|---|---|
| returns a `claim` when the directive said `concept` | target-type contract |
| emits a node with no `EXTRACT` trace explaining it | untraced-output check |
| trace claims an `output_ref` not in the envelope | phantom-output check |
| node claims a `source_paper` other than the directive's | source-spoofing check |
| marks its own output `human_reviewed` | self-review is not a thing a worker may do |
| emits results below the directive's `confidence_floor` | should have been SKIPped |
| exceeds `max_results`, duplicate ids, id collision with the live graph | envelope integrity |
| trace `worker_id` disagrees with the envelope's | identity consistency |

All errors are collected rather than short-circuited, so a worker gets its whole report card
in one pass.

**`ReferenceWorker`** is a deliberately dumb deterministic extractor (frequency-scored
concepts, relation-triple claims). It exists so the loop runs end-to-end with no model in
it — if the plumbing only works with an LLM attached, the plumbing isn't proven. It also
traces its *negative* decisions: SKIP below floor, ABSTAIN at max_results.

**The loop, observed:**

```
1. spawned  : job_040468_claims -> queued
2. worker   : 2 nodes, 2 traces
3. admitted : True | job now held | LOW_CONFIDENCE
4. review   : review_job_040468_claims
   reason   : LOW_CONFIDENCE: Confidence 85% below threshold 90%
5. approved : ALLOWED_BY_WAIVER | job now approved
6. report   : {'total_decisions': 2, 'allowed': 1, 'blocked': 1,
               'allowed_by_waiver': 1, 'by_reason_code': {...}}
7. graph ok : True | 4 nodes 4 edges
```

`approve_review()` re-runs the gate and returns the fresh decision — approval is a *request*
to re-evaluate, not a decree that the node advances. A plain approval on a low-confidence
job still blocks (`test_plain_approval_does_not_clear_low_confidence`); only an explicit
waiver clears it, and the API refuses a waiver with no reason.

**The sixth check is no longer a stub.** `_check_no_conflicts` now consults
`graph.conflicts`, scoped to the node *and everything it produced* — a job answers for its
output. Proven end-to-end: extract a claim from paper A, extract the opposite from paper B,
the detector records the contradiction, and paper B's job is blocked with
`CONFLICT_UNRESOLVED` even after human approval, until someone sets `resolved` with a
resolution note. `detect_conflicts=False` makes the check inert and says so in the trace,
rather than silently passing.

All six gate checks now have real implementations and real producers.

---

# Phase 3.1 — waiver-aware confidence gate (done)

**70/70 tests green.** The 17 original gate tests still pass untouched; the finding below is
now resolved, and the test that pinned it has been replaced by nine that govern the new path.

`_check_confidence_above_threshold` now consults the graph. Resolution order: an
`approved_for` edge pointing at the node, falling back to a `review_task` whose
`extraction_job_id` back-references the job. New reason code `ALLOWED_BY_WAIVER` propagates
to the final `GateDecision`, so a waived pass never reads as an earned one, and `report()`
counts `allowed_by_waiver` separately — a rising waiver rate is the signal that the
threshold or the extractor is wrong, and should prompt fixing one of those rather than
waiving more.

Four rules keep the waiver a governed bypass rather than an escape hatch:

- **Fail closed on invisibility** — a waiver the gate can't see is no waiver. Called without
  graph context, the same node still blocks.
- **A defective waiver is no waiver** — missing `waiver_reason`, missing `reviewed_by`
  (no accountable human), status not `approved`, or a review task not itself marked
  `human_reviewed` all block. The specific defect is named in the trace's
  `waiver_rejected` list, so a half-filled waiver is loud rather than silent.
- **`waiver_confidence_floor` (default 0.4)** — a waiver can rescue a below-threshold node,
  not an arbitrarily bad one. Without a floor the confidence gate would be decorative.
- **`honor_waivers=False`** disables the path entirely for stricter runs.

Sample trace:

```
verdict: ALLOWED_BY_WAIVER | can_proceed: True
evidence: {"confidence": 0.59, "threshold": 0.7, "waiver_confidence_floor": 0.4,
           "waived": true, "waived_by": "parry.s.2324@gmail.com",
           "waiver_reason": "'multi-agent' is central to this paper; …",
           "review_task_id": "review_2606_concepts_001",
           "original_gate_reason": "LOW_CONFIDENCE: Confidence 59% below threshold 70%"}
```

---

## The finding that produced Phase 3.1 (historical — now fixed)

Phase 2's gate runs the confidence check **before** the review check. So a job a human
explicitly waived (`confidence_threshold_waived: true`, `waiver_reason` filled in, review
task `approved`) *still* returns `LOW_CONFIDENCE`. The waiver is stored correctly; nothing
consumes it.

This is pinned, not papered over — `test_fixture_3_waiver_is_not_yet_honored_by_gate`
asserts the current (wrong) behavior with a docstring explaining why, so it fails loudly the
day someone fixes it. Not fixed here because the pre-merge contract was *gate tests pass
unchanged*, and a waiver-aware confidence check is a gate change.

**Phase 3.1 (small):** `_check_confidence_above_threshold` consults the linked `review_task`
via the `approved_for` edge; if `confidence_threshold_waived` is true and status is
`approved`, pass with a `WAIVED` trace instead of blocking. Needs a new reason code
(`ALLOWED_BY_WAIVER`) so the waiver stays visible in the decision trace rather than
disappearing into a silent pass.

## Also landed

- **Edge endpoint contracts** — `requires_review` must go `extraction_job → review_task`,
  `approved_for` the reverse, `blocked_by`/`unlocks` job→job. Enforced by `validate_edge`
  when a node index is supplied; dangling endpoints rejected.
- **Conflict detection stub** — `detect_conflicts_in_graph()` catches the trivial case
  (same subject+object, opposed relation verb) so the gate's `CONFLICT_UNRESOLVED` path has
  a real producer to wire against in Phase 4. Real semantic detection stays worker-side.
- **`graph_schema.json` is now generated**, not hand-maintained. This is the same
  single-source-of-truth discipline the sibling repos use — the published contract and the
  enforced contract are the same object.

## Next: Phase 4 (workers)

The contract is now fully specified in both directions — Phase 2 says what gets checked,
Phase 3 says what a conforming node looks like. A worker reads a directive, extracts,
emits `Trace` entries per decision, and produces nodes that pass `validate_node()` before
the gate ever sees them.
