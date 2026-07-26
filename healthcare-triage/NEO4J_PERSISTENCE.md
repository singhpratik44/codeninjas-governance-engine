# Neo4j Persistence Layer for Healthcare Triage

Persistent graph storage for triage decisions, governance DAG structure, and evidence chains using Neo4j graph database with Cypher query support.

## Architecture

### Graph Structure

```
State Nodes (13):
  START → ASSESS_VITALS → GATE_AGE → [GATE_FEVER, GATE_HYPOXIA, GATE_COMORBID]
    ↓                                    ↓
  ESCALATION_DECISION → [ROUTE_ICU, ROUTE_ED, ROUTE_DISCHARGE]
    ↓
  APPROVAL → [OVERRIDE | COMPLETE]

Relationships:
  - State -[TRANSITIONS]-> State (governance flow)
  - Patient -[HAS_DECISION]-> Decision (ownership)
  - Decision -[EVALUATES]-> Gate (gate results)
  - Decision -[CONTAINS_EVIDENCE]-> Evidence (evidence trail)
  - Evidence -[CHAINS_TO]-> Evidence (hash chaining)
```

### Node Labels

| Label | Properties | Purpose |
|-------|-----------|---------|
| **State** | name, description, is_gate, created_at | Governance DAG states |
| **Decision** | decision_id, patient_id, triage_level, routing, confidence, escalation_required, status, created_at | Individual triage decisions |
| **Patient** | patient_id, created_at | Patient records |
| **Evidence** | decision_id, sequence, state, timestamp, hash, evidence_json | Hash-chained evidence entries |
| **Gate** | name, created_at | Policy gate definitions |

### Relationships

| Type | From → To | Properties | Semantics |
|------|-----------|-----------|-----------|
| **TRANSITIONS** | State → State | condition, created_at | Governance flow rules |
| **HAS_DECISION** | Patient → Decision | created_at | Patient owns decision |
| **EVALUATES** | Decision → Gate | passed, evaluated_at | Gate evaluation result |
| **CONTAINS_EVIDENCE** | Decision → Evidence | sequence | Decision carries evidence |
| **CHAINS_TO** | Evidence → Evidence | — | Hash chain link (tamper-evidence) |

## Setup

### 1. Install Neo4j Community Edition

```bash
# Docker (recommended)
docker run -d \
  --name neo4j \
  -p 7687:7687 \
  -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

Or download: https://neo4j.com/download/

### 2. Install Python Driver

```bash
pip install neo4j>=5.0
```

### 3. Initialize Governance DAG in Neo4j

```bash
python -m triage_engine neo4j-init \
  --uri bolt://localhost:7687 \
  --user neo4j \
  --password password
```

## Usage

### Auto-Persist Decisions During Triage

```bash
python -m triage_engine triage \
  --neo4j-uri bolt://localhost:7687 \
  --neo4j-user neo4j \
  --neo4j-password password
```

Output:
```
Triaged 75 patients
✓ DAG orchestration enabled (parallel gates, hash-chained audit trail)
✓ Neo4j persisted: 75 decisions, 450 relationships
```

### Query Graph Statistics

```bash
python -m triage_engine neo4j-stats \
  --uri bolt://localhost:7687 \
  --user neo4j \
  --password password
```

Output:
```
=== Neo4j Graph Statistics ===
decision_count: 75
evidence_count: 450
gate_count: 6
patient_count: 75
relationship_count: 800
state_count: 13
```

### Python API

```python
from triage_neo4j import TriageNeo4jStore
from triage_engine import load_state, triage_all_patients

# Connect to Neo4j
store = TriageNeo4jStore(uri="bolt://localhost:7687", user="neo4j", password="password")
if not store.connect():
    print("Neo4j not available")
    exit(1)

# Initialize governance DAG
store.store_governance_dag()

# Triage patients and persist to Neo4j
state = load_state()
triage_all_patients(state, neo4j_store=store)

# Query escalation patterns
patterns = store.query_escalation_patterns()
# [
#   {"gate": "fever_gate", "count": 21},
#   {"gate": "hypoxia_gate", "count": 15},
#   {"gate": "comorbidity_gate", "count": 8},
# ]

# Query critical paths through DAG
paths = store.query_critical_paths()
# [
#   ["START", "ASSESS_VITALS", "GATE_AGE", "GATE_FEVER", "ESCALATION_DECISION", ...],
#   ...
# ]

# Trace evidence chain for a decision
chain = store.query_decision_chain("TRIAGE-0001")
# [
#   {"sequence": 0, "state": "START", "timestamp": "...", "hash": "abc123..."},
#   {"sequence": 1, "state": "ASSESS_VITALS", "timestamp": "...", "hash": "def456..."},
#   ...
# ]

# Get all decisions for a patient
decisions = store.query_patient_decisions("P001")
# [
#   {"decision_id": "TRIAGE-0001", "triage_level": "yellow", "status": "escalated", ...},
#   ...
# ]

store.close()
```

## Cypher Query Examples

### Find Patients with Multiple Escalations

```cypher
MATCH (p:Patient)-[:HAS_DECISION]->(d:Decision)
WHERE d.escalation_required = true
WITH p, COUNT(d) as escalation_count
WHERE escalation_count > 1
RETURN p.patient_id, escalation_count
ORDER BY escalation_count DESC
```

### Critical Path Analysis

```cypher
MATCH path = (s:State {name: 'START'})-[:TRANSITIONS*]->(e:State {name: 'COMPLETE'})
RETURN [n IN nodes(path) | n.name] as state_path, length(path) as path_length
```

### Evidence Chain Integrity Verification

```cypher
MATCH (d:Decision {decision_id: 'TRIAGE-0001'})-[:CONTAINS_EVIDENCE]->(e:Evidence)
OPTIONAL MATCH (e)-[:CHAINS_TO]->(next:Evidence)
RETURN e.sequence, e.state, e.hash, CASE WHEN next IS NOT NULL THEN 'linked' ELSE 'final' END as chain_status
ORDER BY e.sequence
```

### Gate Effectiveness (Which Gates Prevent Escalation?)

```cypher
MATCH (d:Decision)-[:EVALUATES]->(g:Gate)
WITH g.name as gate, 
     COUNT(*) as total,
     COUNT(CASE WHEN d.escalation_required = false THEN 1 END) as prevented
RETURN gate, total, prevented, ROUND(100.0 * prevented / total, 1) as prevention_rate
ORDER BY prevention_rate DESC
```

### Patient Journey Timeline

```cypher
MATCH (p:Patient {patient_id: 'P001'})-[:HAS_DECISION]->(d:Decision)
MATCH (d)-[:CONTAINS_EVIDENCE]->(e:Evidence)
RETURN d.decision_id, e.sequence, e.state, e.timestamp, e.hash
ORDER BY d.created_at, e.sequence
```

## Testing

Neo4j tests run with graceful degradation:
- If Neo4j server is running: full integration tests execute
- If Neo4j server is unavailable: tests skip cleanly

```bash
python -m unittest discover -s tests -q
# Ran 20 tests (15 core + 5 Neo4j integration) OK
```

## Performance Considerations

| Operation | Notes |
|-----------|-------|
| **store_governance_dag()** | ~100ms (13 states, 17 transitions) |
| **store_decision()** | ~50ms per decision (includes evidence chain, gates) |
| **query_escalation_patterns()** | ~10ms (indexed by gate name) |
| **query_decision_chain()** | ~5ms (evidence chain traversal) |
| **query_patient_decisions()** | ~10ms per patient |

### Indexing Recommendations

```cypher
CREATE INDEX state_name FOR (s:State) ON (s.name);
CREATE INDEX decision_id FOR (d:Decision) ON (d.decision_id);
CREATE INDEX patient_id FOR (p:Patient) ON (p.patient_id);
CREATE INDEX evidence_seq FOR (e:Evidence) ON (e.decision_id, e.sequence);
```

## Graceful Degradation

Neo4j is **optional**:
- If neo4j-driver not installed: CLI skips Neo4j commands
- If Neo4j server unavailable: triage continues without persistence
- All core functionality (DAG, decisions, snapshots) works standalone

```python
from triage_engine import NEO4J_AVAILABLE
if NEO4J_AVAILABLE:
    # Use Neo4j for persistence
else:
    # Use JSON snapshots only
```

## Future Enhancements

1. **Real-time Dashboard:** Neo4j query API feeding live decision analytics
2. **Graph Analytics:** Community detection (clusters of similar decisions)
3. **Anomaly Detection:** Cypher queries to flag unusual decision patterns
4. **Audit Visualization:** Web UI for evidence chain rendering with cryptographic verification
5. **Backup & Recovery:** Automated Neo4j backups, point-in-time recovery
6. **Multi-tenant:** Separate Neo4j graphs per care facility
7. **HIPAA Compliance:** Encryption at rest, access control via Neo4j roles

## Troubleshooting

### Connection Refused
```
Neo4j connection failed: Failed to connect to bolt://localhost:7687
```
**Fix:** Start Neo4j server or verify it's running on correct port

### Authentication Failed
```
Neo4j connection failed: Unauthorized. User authentication failed
```
**Fix:** Verify credentials in neo4j.conf or Docker run command

### Memory Issues
```
OutOfMemory: Java heap space
```
**Fix:** Increase Neo4j JVM memory: `NEO4J_dbms_memory_heap_max__size=4G`

## References

- Neo4j Documentation: https://neo4j.com/docs/
- Cypher Query Language: https://neo4j.com/docs/cypher-manual/current/
- Python Driver: https://neo4j.com/docs/api/python/current/
- Graph Database Patterns: https://neo4j.com/developer/graph-database/
