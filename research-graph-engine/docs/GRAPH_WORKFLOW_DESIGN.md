# Research Graph: Workflow-Structured Extraction with Dynamic Workers

**Principle:** Extraction itself is a graph workflow, not a pipeline. Papers are nodes. Extraction jobs are nodes. Reviews are nodes. Confidence gates control flow.

---

## Architecture: Graph Workflow (Not Pipeline)

### Current (Flat Pipeline — Wrong)
```
Fetch Papers → Extract Metadata → Extract Domains → Extract Claims → Review → Query
```

### Better (Graph Workflow — Right)
```
Paper Node
  ├─ [Job: Metadata Extraction] → Metadata Node (confidence: 1.0, auto-approved)
  │   ├─ [Job: Domain Keyword Extraction] → Domain Nodes (confidence: 0.7, needs review)
  │   └─ [Edge: paper→domain] (confidence: 1.0)
  │
  ├─ [Review Gate: Domain extraction >= 0.7 & human_reviewed=true?]
  │   └─ IF YES → Unlock next jobs
  │   └─ IF NO → Create Review Task, wait for human
  │
  ├─ [Job: Claim Extraction] → Claim Nodes (confidence: 0.8, from LLM, waits for review)
  │   └─ [Edge: paper→claim] (confidence: 0.8)
  │
  └─ [Query Gate: All claims reviewed & confidence >= 0.9?]
      └─ IF YES → Available for graph queries
      └─ IF NO → Mark "pending review"
```

**Key difference:** Extraction jobs are first-class graph nodes with status tracking.

---

## Node Types (Expanded)

```json
{
  "type": "paper",
  "properties": {
    "arxiv_id": "2606.13707",
    "title": "...",
    "status": "metadata_extracted" | "awaiting_domain_review" | "claims_extracted" | "complete"
  }
}

{
  "type": "extraction_job",
  "properties": {
    "job_id": "job_2606_domain_extraction_001",
    "paper_id": "paper_2606.13707",
    "extraction_type": "domain_keyword" | "claim_semantic" | "method",
    "worker_id": "claude-code-session-abc123",
    "status": "pending" | "in_progress" | "completed" | "failed",
    "spawned_at": "2026-07-26T15:32:10Z",
    "completed_at": "2026-07-26T15:35:20Z",
    "result_count": 3,
    "avg_confidence": 0.72,
    "worker_notes": ""
  }
}

{
  "type": "review_task",
  "properties": {
    "task_id": "review_task_2606_domains_001",
    "extraction_job_id": "job_2606_domain_extraction_001",
    "status": "pending" | "approved" | "rejected" | "needs_revision",
    "created_at": "2026-07-26T15:35:20Z",
    "reviewed_by": "user" | null,
    "reviewed_at": null,
    "confidence_threshold_met": false,
    "review_notes": ""
  }
}
```

---

## Edges (Workflow Control)

```
paper → [extraction_job: domain_keyword]
        (type: "spawns_job", blocking=false)

extraction_job → [domain_node]
        (type: "creates", confidence: extracted_confidence)

extraction_job → [review_task]
        (type: "awaits_review", blocking=true)

review_task → paper
        (type: "unlocks_next", blocking=true)
        [only activated if review_task.status="approved" & confidence >= threshold]
```

**Blocking semantics:**
- `blocking=false`: Job spawns parallel to other work
- `blocking=true`: Downstream jobs wait for this gate

---

## Extraction Worker Model (Dynamic, Not Permanent)

### Current (Permanent Agent — Inefficient)
```python
class PermanentClaimExtractor:
    def run_forever(self):
        while True:
            paper = queue.get()
            claims = self.extract_claims(paper)
            storage.save(claims)
```

### Better (Dynamic Worker — Resource Efficient)
```python
# In GitHub Actions / Claude Code, on-demand:

class ExtractionWorkerSpawner:
    """Spawn a worker for each paper, then exit."""
    
    def spawn_extraction_job(self, paper_id: str, job_type: str):
        """
        1. Create extraction_job node in graph
        2. Spawn Claude Code session (or GitHub Action)
        3. Worker extracts, updates graph
        4. Worker exits
        5. Graph becomes source of truth
        
        Returns: job_id for tracking
        """
        job = ExtractionJob(
            job_id=f"job_{paper_id}_{job_type}",
            paper_id=paper_id,
            extraction_type=job_type,
            status="pending"
        )
        graph.add_node(job)
        
        # Spawn worker (Claude Code session OR GitHub Action step)
        worker_id = spawn_worker(
            prompt=f"Extract {job_type} from paper {paper_id}. Update graph node {job.id}",
            directive={
                "paper_id": paper_id,
                "extraction_type": job_type,
                "schema_version": "1.0",
                "confidence_floor": 0.7,
                "output_format": "json",
                "tracing": {
                    "job_id": job.id,
                    "trace_every_decision": True
                }
            }
        )
        
        job.worker_id = worker_id
        job.status = "in_progress"
        graph.update_node(job)
        
        return job.id
```

**Worker lifecycle:**
1. **Spawn** (on-demand): GitHub Actions triggered by graph state, or Claude Code manual
2. **Work** (30 min): Extract claims/domains from paper, stream results into graph
3. **Exit** (clean): Worker updates job node with results + traces, then terminates
4. **Verify** (async): Graph queries new results, confidence gates trigger reviews or next jobs

**Advantage:** No agent waiting idle. No "permanent extractor." Each paper gets a focused extraction session.

---

## Confidence-Gated Review (The Core Innovation)

### Review Gate Logic

```python
def should_unlock_next_stage(paper_id: str) -> Tuple[bool, str]:
    """
    Can we move from "domain extraction" → "claim extraction"?
    
    Returns: (can_proceed, reason)
    """
    
    # 1. Check if extraction job completed
    job = graph.get_node(f"job_{paper_id}_domain_extraction")
    if job.status != "completed":
        return False, "Extraction job still in progress"
    
    # 2. Check average confidence of extracted domains
    domain_edges = graph.edges_from(f"paper_{paper_id}", type="creates")
    confidences = [e.provenance.confidence for e in domain_edges]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0
    
    if avg_conf < 0.7:
        return False, f"Domain extraction confidence {avg_conf:.0%} below 0.7 threshold"
    
    # 3. Check if human reviewed
    review_task = graph.get_node(f"review_task_{paper_id}_domains")
    if review_task.status != "approved":
        return False, "Domains pending human review"
    
    # 4. Gate passed
    return True, "Ready for claim extraction"

# Usage:
can_proceed, reason = should_unlock_next_stage("paper_2606.13707")
if can_proceed:
    spawn_extraction_job("paper_2606.13707", "claim_semantic")
else:
    create_review_task("paper_2606.13707", "domain_extraction", reason)
```

**What this prevents:**
- Extracting claims from papers with unreviewed domains (cascade of low-confidence)
- Querying with unvetted data
- Automation running on uncertain foundations

---

## Worker Directive Spec (Tracing Built-In)

When you spawn a worker, you send a directive:

```json
{
  "paper_id": "2606.13707",
  "extraction_type": "claim_semantic",
  "schema_version": "1.0",
  "confidence_floor": 0.8,
  "output_format": "json",
  
  "tracing": {
    "job_id": "job_2606_claims_001",
    "trace_every_decision": true,
    "decisions_schema": {
      "claim_extraction": {
        "prompt_version": "1.0",
        "reasoning_required": true,
        "trace_fields": ["claim_text", "subject", "relation", "object", "confidence", "reasoning"]
      }
    },
    "trace_destination": "graph_node[job_id].traces"
  },
  
  "validation": {
    "schema_path": "schema/graph_schema.json",
    "node_type": "claim",
    "edge_types": ["paper→claim"],
    "confidence_threshold": 0.8
  },
  
  "feedback_loop": {
    "if_confidence_below_threshold": "flag for human review",
    "if_schema_invalid": "halt, return error",
    "if_successful": "update graph, mark job complete, trigger next stage gate check"
  }
}
```

**Worker reads this, then:**
1. Extracts claims from paper
2. For each claim, logs: `{claim_text, reasoning, confidence, trace_id}`
3. Validates against schema
4. Streams results into `graph_node[job_id].traces`
5. Updates job node: `status=completed, result_count=N, avg_confidence=0.85`
6. Returns

**Graph queries the job node:**
- ✅ Success: `job.status=completed, avg_confidence >= 0.8` → Ready for review
- ⚠️ Low confidence: `job.status=completed, avg_confidence=0.65` → Create review task (flag for human)
- ❌ Failed: `job.status=failed, error_reason=...` → Retry or escalate

---

## Workflow Execution (GitHub Actions or Manual)

### Automatic (GitHub Actions, Daily)

```yaml
# .github/workflows/research-workflow.yml

on:
  schedule:
    - cron: '0 6 * * *'  # Daily 6am UTC
  workflow_dispatch:

jobs:
  stage-1-fetch:
    runs-on: ubuntu-latest
    steps:
      - run: python -m research_engine fetch_new_papers
      - run: git add data/papers.json && git commit -m "New papers"
      - run: git push origin main

  stage-2-extract-metadata:
    needs: stage-1-fetch
    runs-on: ubuntu-latest
    steps:
      - run: python -m research_engine spawn_extraction_jobs --type=metadata
      # This creates extraction_job nodes in graph and exits
      
  stage-3-extract-domains:
    needs: stage-2-extract-metadata
    runs-on: ubuntu-latest
    steps:
      - run: python -m research_engine check_gates --from=metadata_extraction
      # Checks: all metadata jobs done? avg confidence > 0.7? If yes, spawn domain jobs
      - run: python -m research_engine spawn_extraction_jobs --type=domain_keyword

  stage-4-graph-rebuild:
    needs: stage-3-extract-domains
    runs-on: ubuntu-latest
    steps:
      - run: python -m research_engine rebuild_graph
      # Loads all nodes/edges from data/, rebuilds canonical_graph_latest.json
      - run: git add data/canonical_graph_*.json && git commit -m "Graph rebuilt"
      - run: git push origin main
```

### Manual (Claude Code, Ad-Hoc)

```python
# In Claude Code session:

from research_engine import ResearchGraph, ExtractionWorkerSpawner

graph = ResearchGraph.load("data/canonical_graph_latest.json")
spawner = ExtractionWorkerSpawner(graph)

# User: "Extract claims from the 10 new papers"
new_papers = graph.nodes_with_type("paper").filter(status="awaiting_claim_extraction")
for paper in new_papers:
    job_id = spawner.spawn_extraction_job(paper.id, "claim_semantic")
    print(f"Spawned job {job_id} for {paper.label}")

# Worker runs (in this session or separate), updates graph
# User comes back later, reviews results in graph viewer
```

---

## Graph Nodes Over Time (Example)

### T=0 (Fetch)
```
paper_2606.13707 {status: "fetched"}
```

### T=1 (Metadata Extraction Job Completes)
```
paper_2606.13707 {status: "metadata_extracted"}
├─ extraction_job_meta_001 {status: "completed", result_count: 1}
│  └─ trace: [{claim: "title: Orchestra-o1", confidence: 1.0}]
```

### T=2 (Domain Extraction Job Completes)
```
paper_2606.13707 {status: "awaiting_domain_review"}
├─ extraction_job_domain_001 {status: "completed", result_count: 2, avg_confidence: 0.72}
│  ├─ trace: [{domain: "orchestration", confidence: 0.85, reasoning: "..."}]
│  └─ trace: [{domain: "multi-agent", confidence: 0.59, reasoning: "..."}]
├─ domain_orchestration {confidence: 0.85}
└─ domain_multi-agent {confidence: 0.59}
```

### T=3 (Review Gate Check)
```
review_task_domains_001 {status: "pending"}
  reason: "domain_multi_agent confidence 0.59 < 0.7 threshold"
  
→ Human marks: confidence_threshold_waived=true (reason: "actually, multi-agent is central to this paper")

review_task_domains_001 {status: "approved"}
```

### T=4 (Claims Extraction Unlocked)
```
paper_2606.13707 {status: "extracting_claims"}
├─ extraction_job_claims_001 {status: "in_progress"}
```

### T=5 (Claims Extracted, Ready for Query)
```
paper_2606.13707 {status: "complete"}
├─ extraction_job_claims_001 {status: "completed", result_count: 5, avg_confidence: 0.82}
│  ├─ claim_001 {confidence: 0.85, text: "hierarchical planning reduces coordination overhead"}
│  ├─ claim_002 {confidence: 0.79, text: "omnimodal orchestration enables video/audio integration"}
│  └─ ...
└─ [All downstream queries now include this paper]
```

---

## Implementation Checklist (Phase B + Partial Phase A)

- [ ] **Schema** ✅ (already designed)
  - [ ] Add `extraction_job` and `review_task` node types
  - [ ] Add workflow control edges (spawns_job, awaits_review, unlocks_next)

- [ ] **Graph Workflow Engine**
  - [ ] `should_unlock_next_stage()` gate logic
  - [ ] `spawn_extraction_job()` worker spawner
  - [ ] Job node lifecycle tracking

- [ ] **Worker Directive**
  - [ ] Define directive schema (JSON, validation)
  - [ ] Worker reads directive, executes, traces
  - [ ] Tracing schema (decisions, reasoning, confidence per extraction)

- [ ] **Visualization (Enhanced)**
  - [ ] Show job nodes with status badge (pending / in_progress / completed / failed)
  - [ ] Show review task nodes with gate status
  - [ ] Workflow visualization: highlight the critical path (paper → job → review → unlock → next job)

- [ ] **GitHub Actions**
  - [ ] Daily fetch → spawn metadata jobs → spawn domain jobs → rebuild graph

- [ ] **Manual Interface (Claude Code)**
  - [ ] `python -m research_engine spawn_extraction_jobs --type=<type>`
  - [ ] Inspect graph nodes in REPL
  - [ ] Manually approve/reject review tasks

---

## Why This Beats the Pipeline Approach

| Aspect | Pipeline | Graph Workflow |
|--------|----------|----------------|
| **Traceability** | Results only | Every job, every decision, every trace |
| **Parallelism** | Sequential stages | Spawn jobs in parallel, block only on gates |
| **Confidence gates** | Post-hoc filtering | Baked into workflow, prevents invalid flows |
| **Review loop** | Separate from extraction | First-class graph node, gates next stage |
| **Worker lifecycle** | Always-on agents | Spawn-extract-exit, no idle overhead |
| **Schema evolution** | Manual updates | Job node proves conformance, tracks versions |
| **Query readiness** | "Is this paper ready?" unclear | `paper.status="complete"` + all downstream jobs approved |

---

## Next Steps

1. **Extend schema** with `extraction_job`, `review_task` node types
2. **Implement gate logic** (`should_unlock_next_stage`)
3. **Build worker spawner** (`spawn_extraction_job` with directive)
4. **Update visualization** to show job nodes + workflow status
5. **Wire up GitHub Actions** to execute the workflow daily

Then Phase A (automated graph building) becomes a natural extension — the workflow runs automatically, workers are spawned on schedule, gates check confidence.
