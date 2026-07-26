"""Unit tests for Neo4j persistence layer.

Gracefully skips if Neo4j server is not available.
"""
import unittest
from unittest.mock import MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from triage_neo4j import TriageNeo4jStore
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False


class TestTriageNeo4jStore(unittest.TestCase):
    """Test Neo4j store initialization and methods."""

    def setUp(self):
        """Set up test fixtures."""
        if not NEO4J_AVAILABLE:
            self.skipTest("Neo4j driver not available")

    def test_neo4j_store_initialization(self):
        """Test TriageNeo4jStore can be instantiated."""
        store = TriageNeo4jStore(uri="bolt://localhost:7687", user="neo4j", password="test")
        self.assertIsNotNone(store)
        self.assertEqual(store.uri, "bolt://localhost:7687")
        self.assertEqual(store.user, "neo4j")
        self.assertFalse(store._connected)

    def test_neo4j_connection_failure_graceful(self):
        """Test that connection failures are handled gracefully."""
        store = TriageNeo4jStore(uri="bolt://nonexistent:7687", user="neo4j", password="wrong")
        # Should not raise, just return False
        result = store.connect()
        self.assertFalse(result)
        self.assertFalse(store._connected)

    def test_neo4j_methods_fail_gracefully_without_connection(self):
        """Test that methods return empty/False without active connection."""
        store = TriageNeo4jStore()
        store._connected = False

        # These should return safely without raising
        self.assertFalse(store.store_governance_dag())
        self.assertEqual(store.query_escalation_patterns(), [])
        self.assertEqual(store.query_critical_paths(), [])
        self.assertEqual(store.query_decision_chain("TRIAGE-0001"), [])
        self.assertEqual(store.query_patient_decisions("P001"), [])
        self.assertEqual(store.stats(), {})

    def test_neo4j_store_decision_without_connection(self):
        """Test store_decision returns False without connection."""
        store = TriageNeo4jStore()
        store._connected = False

        decision_data = {
            "ai_triage_level": "yellow",
            "ai_routing": "ed",
            "ai_confidence": 0.6,
            "escalation_required": True,
            "status": "escalated",
        }

        result = store.store_decision("TRIAGE-0001", "P001", decision_data)
        self.assertFalse(result)


class TestNeo4jAvailability(unittest.TestCase):
    """Test Neo4j availability checks."""

    def test_neo4j_driver_installed(self):
        """Verify neo4j-driver is available."""
        try:
            from neo4j import GraphDatabase, basic_auth
            self.assertTrue(True)
        except ImportError:
            self.skipTest("neo4j-driver not installed")


if __name__ == "__main__":
    unittest.main()
