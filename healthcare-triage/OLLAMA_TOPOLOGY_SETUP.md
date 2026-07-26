# Ollama + Topology Router Setup Guide

## Quick Start (5 minutes)

### 1. Install Ollama

**macOS/Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

**Or download from:** https://ollama.ai/download

### 2. Pull a Model

```bash
# Recommended: Fast, low-memory (2GB)
ollama pull mistral

# Alternatives:
ollama pull neural-chat    # Smallest, fastest (~1GB)
ollama pull llama2         # High quality (~4GB)
ollama pull orca-mini      # Best reasoning (~2GB)
```

### 3. Start Ollama Server

```bash
ollama serve
# Output: listening on 127.0.0.1:11434
```

### 4. Test Integration

```bash
# In another terminal, from healthcare-triage directory
python -c "
from ollama_integration import ollama_invoke

result = ollama_invoke('What is 2 + 2?', model='mistral')
print(result)
"
```

**Expected output:**
```
2 + 2 = 4
```

---

## How It Works

### Ollama Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Triage Orchestration                   │
│  (LangGraph + Five-Plane Governance + Topology Router)  │
└────────────────────────┬────────────────────────────────┘
                         │
                    ModelAdapter
                         │
         ┌───────────────┴──────────────┐
         │                              │
    Claude API                    Ollama Client
  (Token cost)                 (Zero cost, local)
         │                              │
    Anthropic                  localhost:11434
   (Requires auth)              (Local server)
```

### Model Provider Hierarchy

```python
# ModelAdapter.get_default_for_complexity(complexity, prefer_ollama=True)

# If Ollama available → use it (zero cost)
# Else if prefer_provider == "claude" → use Claude API
# Else if prefer_provider == "openai" → use OpenAI API
# Else → fallback to claude-haiku
```

### Model Selection by Complexity

| Complexity | Ollama Model | Purpose |
|-----------|--------------|---------|
| 1-2 (simple) | neural-chat | Fast gate evaluation |
| 3-6 (moderate) | mistral | Default for most tasks |
| 7-9 (complex) | llama2 | Better reasoning |
| 10 (reasoning-heavy) | orca-mini | Specialized reasoning |

---

## Topology Router: AdaptOrch Implementation

The topology router selects optimal execution topology based on task DAG analysis.

### How It Works

```
Input: Task DAG (dependency graph + metadata)
         │
         ↓
    DAGAnalyzer
    - Compute max dependency depth
    - Count parallelizable task pairs
    - Estimate critical path
         │
         ↓
    TopologyRouter Heuristics
    - IF all tasks independent → PARALLEL
    - IF deep chain (depth > 3) → HIERARCHICAL
    - IF some parallelism → HYBRID
    - ELSE → SEQUENTIAL
         │
         ↓
    Output: Execution phases + speedup estimate + confidence score
```

### Topology Options

**1. SEQUENTIAL**
```
Execution:  A → B → C → D
Timeline:   ████████████ (slow, strict ordering)

When to use:
- Linear dependency chains (B requires A, C requires B, etc.)
- Tasks with side effects that must be ordered
- Low parallelization opportunities

Healthcare example:
  assess_vitals → age_gate → escalation_decision → routing
```

**2. PARALLEL**
```
Execution:  A → {B, C, D}
Timeline:   ████ (fast, no ordering required)

When to use:
- All tasks independent (no dependencies between them)
- High parallelizable ratio (>0.5)

Healthcare example:
  fever_gate, hypoxia_gate, comorbidity_gate all run on assess_vitals output
```

**3. HIERARCHICAL**
```
Execution:  A → {B → {C, D}, E}
Timeline:   ████ (tree structure, moderate parallelism)

When to use:
- Deep dependency chains (depth > 3)
- Mixed parallelism at different levels
- Fan-in/fan-out patterns

Healthcare example:
  assess_vitals → {fever_gate, hypoxia_gate} → escalation_decision → {route_icu, route_ed}
```

**4. HYBRID**
```
Execution:  Mix of sequential and parallel phases
Timeline:   ████ (balanced, moderate parallelism)

When to use:
- Moderate dependency depth (2-3)
- Some tasks parallelizable, some sequential
- Need flexibility

Healthcare example:
  assess → {fever_gate || hypoxia_gate} → escalation → routing
  (Note: || = can run in parallel)
```

### Metrics Computed

For each task DAG, the analyzer computes:

```python
GraphMetrics(
    num_nodes: int              # Total tasks
    num_edges: int              # Dependencies
    max_depth: int              # Longest path from start to end
    parallelizable_ratio: float # Fraction of tasks that can run in parallel
    avg_complexity: float       # Mean complexity across all tasks
    critical_path_length: int   # Sum of complexities on longest path
    fan_out_opportunities: int  # Branches in the DAG
    fan_in_points: int          # Convergence points (multiple inputs)
)
```

### Speedup Estimation

The router estimates speedup vs. sequential baseline:

```
SEQUENTIAL:     speedup = 1.0 (baseline)
PARALLEL:       speedup = min(num_tasks, num_tasks)  (ideal case)
HYBRID:         speedup = num_tasks / (2 * depth)    (conservative)
HIERARCHICAL:   speedup = 1 + (ratio * depth / 10)   (limited)
```

### Confidence Scoring

Confidence (0-1) measures how well metrics align with the selected topology:

```python
if topology == SEQUENTIAL:
    confidence = 1.0 - parallelizable_ratio  # High if low parallelism
elif topology == PARALLEL:
    confidence = parallelizable_ratio * (1.0 - min(1.0, depth / 5))
elif topology == HIERARCHICAL:
    confidence = min(1.0, (depth / 3)) * (0.5 + 0.5 * parallelizable_ratio)
else:  # HYBRID
    confidence = min(1.0, parallelizable_ratio + (depth / 10))
```

High confidence → more reliable topology choice
Low confidence → topology choice might need manual review

---

## Integration Examples

### Example 1: Triage with Ollama + Topology Router

```python
from triage_engine import (
    PatientRecord, 
    make_triage_decision_with_governance,
    DEFAULT_CONFIG
)

patient = PatientRecord(
    patient_id="P-001",
    age=35,
    sex="M",
    chief_complaint="Fever",
    vital_temp=39.2,
    vital_spo2=94,
    vital_bp_sys=120,
    vital_hr=92,
    comorbidities=["hypertension"],
)

# Uses Ollama (mistral) for complexity 3 task + topology router
decision, governance = make_triage_decision_with_governance(
    patient, "TRIAGE-001", DEFAULT_CONFIG
)

print(f"Routing: {decision.ai_routing}")
print(f"Topology: {governance['topology']}")
print(f"Confidence: {governance.get('confidence', 'N/A')}")
```

### Example 2: Direct Topology Routing

```python
from topology_router import TaskDAG, route_tasks

tasks = {
    "assess": TaskDAG(
        "assess", "Assess vitals",
        dependencies=[],
        can_parallelize=True,
        estimated_complexity=2,
    ),
    "fever": TaskDAG(
        "fever", "Check fever",
        dependencies=["assess"],
        can_parallelize=True,
        estimated_complexity=1,
    ),
    "hypoxia": TaskDAG(
        "hypoxia", "Check hypoxia",
        dependencies=["assess"],
        can_parallelize=True,
        estimated_complexity=1,
    ),
}

decision = route_tasks(tasks)
print(f"Selected topology: {decision.topology.value}")
print(f"Execution phases: {decision.phases}")
print(f"Speedup: {decision.estimated_speedup:.2f}x")
print(f"Confidence: {decision.confidence:.2f}")
```

### Example 3: Using Ollama Directly

```python
from ollama_integration import OllamaModelAdapter, OllamaConfig

adapter = OllamaModelAdapter(OllamaConfig(model="mistral"))

# Single invocation
response = adapter.invoke(
    "Explain healthcare triage in 2 sentences.",
    system="You are a medical expert."
)
print(response)

# Streaming
print("Streaming: ", end="")
for token in adapter.invoke_streaming("What is sepsis?"):
    print(token, end="", flush=True)
print()
```

---

## Offline Testing (No Ollama Needed)

For CI/CD or environments without Ollama, the system gracefully degrades:

```python
from triage_orchestration import ModelAdapter, TaskDecompositionRouter

# Graceful fallback
model = ModelAdapter.get_default_for_complexity(5, prefer_ollama=True)
# Returns: "claude-sonnet-5" if Ollama unavailable
#          "ollama:mistral" if Ollama available

# Topology router uses simplified heuristics if topology_router unavailable
decision = TaskDecompositionRouter.route(tasks)
# Uses production algorithm if available
# Falls back to simplified heuristics otherwise
```

---

## Performance Characteristics

### Token Cost

| System | Cost Per Decision |
|--------|-------------------|
| **Ollama (local)** | **$0.00** (free, runs locally) |
| Claude Haiku API | ~$0.001 per decision |
| Claude Sonnet API | ~$0.01 per decision |

### Latency

| Model | Inference Latency | Memory |
|-------|-------------------|--------|
| **neural-chat** | ~100ms | 1GB |
| **mistral** | ~150ms | 2GB |
| **llama2** | ~200ms | 4GB |
| **orca-mini** | ~180ms | 2GB |

### Topology Router

| Operation | Complexity | Time |
|-----------|-----------|------|
| DAG metrics computation | O(\|V\| + \|E\|) | <1ms |
| Topology selection | O(1) heuristic | <1ms |
| Phase grouping | O(\|V\| log \|V\|) | <5ms |
| **Total** | | **<10ms** |

---

## Troubleshooting

### "Ollama not available" Error

```bash
# Check if Ollama is running:
curl http://localhost:11434/api/tags

# If fails, start Ollama:
ollama serve

# If error persists, check logs:
# macOS: ~/Library/Logs/Ollama/...
# Linux: ~/.ollama/logs/...
```

### Out of Memory

```bash
# Pull smaller model:
ollama pull neural-chat  # 1GB vs mistral 2GB

# Or increase swap:
ulimit -n 65536  # Increase file descriptors
```

### Slow Inference

```bash
# Use faster model:
from triage_orchestration import ModelAdapter
model = ModelAdapter.get_default_for_complexity(3, prefer_speed=True)

# Or run on GPU:
# Set CUDA_VISIBLE_DEVICES=0 for GPU acceleration
CUDA_VISIBLE_DEVICES=0 ollama serve
```

---

## Production Deployment

### Docker with Ollama

```dockerfile
FROM python:3.11-slim

# Install Ollama
RUN apt-get update && apt-get install -y curl
RUN curl https://ollama.ai/install.sh | sh

# Copy triage system
COPY healthcare-triage/ /app/

WORKDIR /app
RUN pip install -r requirements.txt

# Start Ollama + app
CMD ollama serve & sleep 2 && python -m triage_engine triage
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: triage-orchestration
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        resources:
          limits:
            memory: "4Gi"
            cpu: "2"
      - name: triage
        image: triage:latest
        env:
        - name: OLLAMA_BASE_URL
          value: "http://localhost:11434"
```

---

## Monitoring & Metrics

### Governance Metrics (from governance planes)

```python
# Each decision records plane verdicts
decision.dag_journey["plane_verdicts"] = [
    ("reasoning", "Intent valid"),
    ("network", "Network access granted"),
    ("identity", "Identity verified"),
    ("endpoint", "Principal has capability"),
    ("data", "Data write authorized"),
]
```

### Topology Metrics (from router)

```python
# Each decision records topology choice
decision.dag_journey = {
    "topology": "hybrid",
    "critical_path_length": 3,
    "estimated_speedup": 1.5,
    "confidence": 0.77,
}
```

### Collect Metrics Over Time

```python
import json
from collections import defaultdict

def analyze_decisions(decisions):
    stats = {
        "topology_distribution": defaultdict(int),
        "confidence_distribution": [],
        "speedup_distribution": [],
        "governance_plane_pass_rate": defaultdict(lambda: [0, 0]),
    }
    
    for d in decisions:
        meta = d.dag_journey
        stats["topology_distribution"][meta.get("topology")] += 1
        stats["confidence_distribution"].append(meta.get("confidence", 0.8))
        
        for plane, result in meta.get("plane_verdicts", []):
            stats["governance_plane_pass_rate"][plane][1] += 1
            if "valid" in result.lower() or "verified" in result.lower():
                stats["governance_plane_pass_rate"][plane][0] += 1
    
    return stats
```

---

## References

- [Ollama Documentation](https://ollama.ai)
- [Mistral Model](https://mistral.ai)
- [Topology Router Algorithm](./topology_router.py)
- [Five-Plane Governance](./ORCHESTRATION_ARCHITECTURE.md)
