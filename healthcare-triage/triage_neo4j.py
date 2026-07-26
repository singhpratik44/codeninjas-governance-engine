"""Neo4j persistence layer for healthcare triage decisions.

Stores governance DAG structure, decision journeys, and evidence chains
in Neo4j graph database for persistent storage, complex queries, and analytics.

Pattern: Graph-based audit trail with Cypher query support.
"""
from __future__ import annotations

from neo4j import GraphDatabase, basic_auth
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Optional
import json

try:
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False


class TriageNeo4jStore:
    """Persist triage decisions and governance DAG to Neo4j graph database."""

    def __init__(self, uri: str = "bolt://localhost:7687", user: str = "neo4j", password: str = "password"):
        """Initialize Neo4j connection.

        Args:
            uri: Neo4j connection URI (default: local bolt)
            user: Database user
            password: Database password
        """
        self.uri = uri
        self.user = user
        self.password = password
        self.driver = None
        self._connected = False

    def connect(self) -> bool:
        """Attempt connection to Neo4j. Returns True if successful, False otherwise."""
        try:
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=basic_auth(self.user, self.password),
                connection_timeout=5.0,
            )
            # Verify connection
            with self.driver.session() as session:
                session.run("RETURN 1")
            self._connected = True
            print(f"✓ Connected to Neo4j: {self.uri}")
            return True
        except Exception as e:
            print(f"⚠ Neo4j connection failed: {e}")
            self._connected = False
            return False

    def close(self):
        """Close Neo4j connection."""
        if self.driver:
            self.driver.close()

    def store_governance_dag(self):
        """Store triage governance DAG structure in Neo4j (13 states, transitions, constraints)."""
        if not self._connected:
            return False

        try:
            with self.driver.session() as session:
                # Create state nodes
                states = [
                    ("START", "Patient arrival"),
                    ("ASSESS_VITALS", "Vitals assessment"),
                    ("GATE_AGE", "Age-based escalation check", True),
                    ("GATE_FEVER", "Fever-based escalation check", True),
                    ("GATE_HYPOXIA", "Hypoxia-based escalation check", True),
                    ("GATE_COMORBID", "Comorbidity-based escalation check", True),
                    ("ESCALATION_DECISION", "Escalation verdict (fan-in)", False),
                    ("ROUTE_ICU", "Route to ICU"),
                    ("ROUTE_ED", "Route to ED"),
                    ("ROUTE_DISCHARGE", "Route to discharge/follow-up"),
                    ("APPROVAL", "Physician approval", False),
                    ("OVERRIDE", "Physician override", False),
                    ("COMPLETE", "Decision complete + recorded"),
                ]

                for state_data in states:
                    state_name = state_data[0]
                    description = state_data[1]
                    is_gate = state_data[2] if len(state_data) > 2 else False

                    session.run("""
                        MERGE (s:State {name: $name})
                        SET s.description = $description, s.is_gate = $is_gate, s.created_at = $ts
                    """, name=state_name, description=description, is_gate=is_gate, ts=datetime.now(timezone.utc).isoformat())

                # Create transitions (edges)
                transitions = [
                    ("START", "ASSESS_VITALS", "Always"),
                    ("ASSESS_VITALS", "GATE_AGE", "Always"),
                    ("GATE_AGE", "GATE_FEVER", "age check passed"),
                    ("GATE_AGE", "GATE_HYPOXIA", "age check passed"),
                    ("GATE_AGE", "GATE_COMORBID", "age check passed"),
                    ("GATE_FEVER", "ESCALATION_DECISION", "Fever gate verdict"),
                    ("GATE_HYPOXIA", "ESCALATION_DECISION", "Hypoxia gate verdict"),
                    ("GATE_COMORBID", "ESCALATION_DECISION", "Comorbidity gate verdict"),
                    ("ESCALATION_DECISION", "ROUTE_ICU", "escalation_required=True, critical"),
                    ("ESCALATION_DECISION", "ROUTE_ED", "escalation_required=True, moderate"),
                    ("ESCALATION_DECISION", "ROUTE_DISCHARGE", "escalation_required=False"),
                    ("ROUTE_ICU", "APPROVAL", "ICU route selected"),
                    ("ROUTE_ED", "APPROVAL", "ED route selected"),
                    ("ROUTE_DISCHARGE", "APPROVAL", "Discharge route selected"),
                    ("APPROVAL", "OVERRIDE", "Physician overrides AI"),
                    ("APPROVAL", "COMPLETE", "Physician approves AI"),
                    ("OVERRIDE", "COMPLETE", "Override recorded"),
                ]

                for source, target, condition in transitions:
                    session.run("""
                        MATCH (s:State {name: $source}), (t:State {name: $target})
                        MERGE (s)-[r:TRANSITIONS]->(t)
                        SET r.condition = $condition, r.created_at = $ts
                    """, source=source, target=target, condition=condition, ts=datetime.now(timezone.utc).isoformat())

            print("✓ Governance DAG stored in Neo4j (13 states, 17 transitions)")
            return True
        except Exception as e:
            print(f"✗ Error storing governance DAG: {e}")
            return False

    def store_decision(self, decision_id: str, patient_id: str, decision_data: dict) -> bool:
        """Store a triage decision and its journey in Neo4j.

        Args:
            decision_id: Unique decision identifier
            patient_id: Patient ID
            decision_data: Decision object (from TriageDecision)

        Returns:
            True if stored successfully, False otherwise
        """
        if not self._connected:
            return False

        try:
            with self.driver.session() as session:
                # Create/update Patient node
                session.run("""
                    MERGE (p:Patient {patient_id: $patient_id})
                    ON CREATE SET p.created_at = $ts
                """, patient_id=patient_id, ts=datetime.now(timezone.utc).isoformat())

                # Create Decision node
                session.run("""
                    MERGE (d:Decision {decision_id: $decision_id})
                    SET d.patient_id = $patient_id,
                        d.ai_triage_level = $triage_level,
                        d.ai_routing = $routing,
                        d.ai_confidence = $confidence,
                        d.escalation_required = $escalation,
                        d.status = $status,
                        d.created_at = $ts
                    RETURN d
                """,
                    decision_id=decision_id,
                    patient_id=patient_id,
                    triage_level=decision_data.get("ai_triage_level"),
                    routing=decision_data.get("ai_routing"),
                    confidence=decision_data.get("ai_confidence"),
                    escalation=decision_data.get("escalation_required"),
                    status=decision_data.get("status"),
                    ts=datetime.now(timezone.utc).isoformat()
                )

                # Link Patient → Decision
                session.run("""
                    MATCH (p:Patient {patient_id: $patient_id}), (d:Decision {decision_id: $decision_id})
                    MERGE (p)-[r:HAS_DECISION]->(d)
                    SET r.created_at = $ts
                """, patient_id=patient_id, decision_id=decision_id, ts=datetime.now(timezone.utc).isoformat())

                # Store evidence chain (if DAG journey available)
                dag_journey = decision_data.get("dag_journey", {})
                if dag_journey and "evidence_chain" in dag_journey:
                    for i, entry in enumerate(dag_journey["evidence_chain"]):
                        state_name = entry.get("state")
                        if state_name:
                            # Create Evidence node
                            session.run("""
                                MERGE (e:Evidence {decision_id: $decision_id, sequence: $seq})
                                SET e.state = $state,
                                    e.timestamp = $ts,
                                    e.hash = $hash,
                                    e.evidence_json = $evidence
                            """,
                                decision_id=decision_id,
                                seq=i,
                                state=state_name,
                                ts=entry.get("timestamp"),
                                hash=entry.get("current_hash", "")[:16],  # Truncate for readability
                                evidence=json.dumps(entry.get("evidence", {}))
                            )

                            # Link Decision → Evidence
                            session.run("""
                                MATCH (d:Decision {decision_id: $decision_id}), (e:Evidence {decision_id: $decision_id, sequence: $seq})
                                MERGE (d)-[r:CONTAINS_EVIDENCE]->(e)
                                SET r.sequence = $seq
                            """, decision_id=decision_id, seq=i)

                            # Chain evidence (previous → current)
                            if i > 0:
                                session.run("""
                                    MATCH (e1:Evidence {decision_id: $decision_id, sequence: $prev}),
                                          (e2:Evidence {decision_id: $decision_id, sequence: $curr})
                                    MERGE (e1)-[r:CHAINS_TO]->(e2)
                                """, decision_id=decision_id, prev=i-1, curr=i)

                # Store policy checks (gates)
                policy_checks = decision_data.get("policy_checks", {})
                for gate_name, passed in policy_checks.items():
                    session.run("""
                        MERGE (g:Gate {name: $gate_name})
                        ON CREATE SET g.created_at = $ts
                    """, gate_name=gate_name, ts=datetime.now(timezone.utc).isoformat())

                    session.run("""
                        MATCH (d:Decision {decision_id: $decision_id}), (g:Gate {name: $gate_name})
                        MERGE (d)-[r:EVALUATES]->(g)
                        SET r.passed = $passed, r.evaluated_at = $ts
                    """, decision_id=decision_id, gate_name=gate_name, passed=passed, ts=datetime.now(timezone.utc).isoformat())

            return True
        except Exception as e:
            print(f"✗ Error storing decision {decision_id}: {e}")
            return False

    def query_escalation_patterns(self) -> list[dict]:
        """Cypher query: Find most common escalation patterns.

        Returns: List of {pattern, count} ordered by frequency
        """
        if not self._connected:
            return []

        try:
            with self.driver.session() as session:
                results = session.run("""
                    MATCH (d:Decision)-[r:EVALUATES]->(g:Gate)
                    WHERE d.escalation_required = true
                    WITH g.name as gate, COUNT(*) as count
                    RETURN gate, count
                    ORDER BY count DESC
                    LIMIT 10
                """)
                return [{"gate": record["gate"], "count": record["count"]} for record in results]
        except Exception as e:
            print(f"⚠ Error querying escalation patterns: {e}")
            return []

    def query_critical_paths(self) -> list[str]:
        """Cypher query: Find paths through governance DAG.

        Returns: List of paths (state sequences)
        """
        if not self._connected:
            return []

        try:
            with self.driver.session() as session:
                results = session.run("""
                    MATCH path = (s:State {name: 'START'})-[:TRANSITIONS*]->(e:State {name: 'COMPLETE'})
                    WITH [n IN nodes(path) | n.name] as state_path, length(path) as path_length
                    RETURN state_path, path_length
                    LIMIT 5
                """)
                return [[node for node in record["state_path"]] for record in results]
        except Exception as e:
            print(f"⚠ Error querying critical paths: {e}")
            return []

    def query_decision_chain(self, decision_id: str) -> list[dict]:
        """Cypher query: Retrieve full evidence chain for a decision.

        Args:
            decision_id: Decision to trace

        Returns: List of evidence entries in order
        """
        if not self._connected:
            return []

        try:
            with self.driver.session() as session:
                results = session.run("""
                    MATCH (d:Decision {decision_id: $decision_id})-[:CONTAINS_EVIDENCE]->(e:Evidence)
                    RETURN e.sequence as seq, e.state as state, e.timestamp as ts, e.hash as hash
                    ORDER BY e.sequence
                """, decision_id=decision_id)
                return [
                    {"sequence": record["seq"], "state": record["state"], "timestamp": record["ts"], "hash": record["hash"]}
                    for record in results
                ]
        except Exception as e:
            print(f"⚠ Error querying decision chain {decision_id}: {e}")
            return []

    def query_patient_decisions(self, patient_id: str) -> list[dict]:
        """Cypher query: Get all decisions for a patient.

        Args:
            patient_id: Patient to look up

        Returns: List of decision records
        """
        if not self._connected:
            return []

        try:
            with self.driver.session() as session:
                results = session.run("""
                    MATCH (p:Patient {patient_id: $patient_id})-[:HAS_DECISION]->(d:Decision)
                    RETURN d.decision_id as id, d.ai_triage_level as level, d.status as status, d.created_at as created_at
                    ORDER BY d.created_at DESC
                """, patient_id=patient_id)
                return [
                    {"decision_id": record["id"], "triage_level": record["level"], "status": record["status"], "created_at": record["created_at"]}
                    for record in results
                ]
        except Exception as e:
            print(f"⚠ Error querying patient decisions for {patient_id}: {e}")
            return []

    def stats(self) -> dict:
        """Cypher query: Get Neo4j graph statistics.

        Returns: {nodes_count, edges_count, decisions_count, patients_count}
        """
        if not self._connected:
            return {}

        try:
            with self.driver.session() as session:
                stats = {}

                # Count nodes by type
                for label in ["State", "Decision", "Patient", "Evidence", "Gate"]:
                    result = session.run(f"MATCH (n:{label}) RETURN COUNT(n) as count")
                    stats[f"{label.lower()}_count"] = result.single()["count"]

                # Count relationships
                result = session.run("MATCH ()-[r]->() RETURN COUNT(r) as count")
                stats["relationship_count"] = result.single()["count"]

                return stats
        except Exception as e:
            print(f"⚠ Error getting Neo4j stats: {e}")
            return {}
