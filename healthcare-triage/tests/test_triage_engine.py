"""Unit tests for the healthcare triage engine."""
import unittest
import json
import os
import tempfile
from datetime import datetime, timezone
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from triage_engine import (
    PatientRecord, TriageDecision, TriageState,
    compute_triage_severity, evaluate_policy_gates,
    make_triage_decision, load_state, save_state,
    build_command_center_snapshot, ingest_patients,
    triage_all_patients, DEFAULT_CONFIG, SCHEMA_VERSION
)


class TestTriageSeverity(unittest.TestCase):
    """Test triage severity computation."""

    def test_healthy_patient(self):
        """Healthy vitals should be green."""
        patient = PatientRecord(
            patient_id="TEST-1", age=40, sex="M",
            chief_complaint="routine checkup",
            vital_temp=37.0, vital_spo2=99, vital_bp_sys=120, vital_hr=70
        )
        level, score, reason = compute_triage_severity(patient)
        self.assertEqual(level, "green")
        self.assertLess(score, 0.25)

    def test_fever_patient(self):
        """High fever should increase severity."""
        patient = PatientRecord(
            patient_id="TEST-2", age=40, sex="M",
            chief_complaint="fever",
            vital_temp=39.8, vital_spo2=97, vital_bp_sys=120, vital_hr=95
        )
        level, score, reason = compute_triage_severity(patient)
        self.assertIn(level, ["yellow", "orange", "red"])
        self.assertGreater(score, 0.25)

    def test_hypoxia_patient(self):
        """Low O2 should escalate severity."""
        patient = PatientRecord(
            patient_id="TEST-3", age=40, sex="M",
            chief_complaint="shortness of breath",
            vital_temp=37.0, vital_spo2=85, vital_bp_sys=120, vital_hr=110
        )
        level, score, reason = compute_triage_severity(patient)
        self.assertIn(level, ["yellow", "orange", "red"])
        self.assertGreater(score, 0.2)

    def test_critical_vitals(self):
        """Multiple critical vitals should be red."""
        patient = PatientRecord(
            patient_id="TEST-4", age=40, sex="M",
            chief_complaint="severe distress",
            vital_temp=40.5, vital_spo2=80, vital_bp_sys=170, vital_hr=135
        )
        level, score, reason = compute_triage_severity(patient)
        self.assertEqual(level, "red")
        self.assertGreater(score, 0.7)


class TestPolicyGates(unittest.TestCase):
    """Test governance policy gate evaluation."""

    def test_age_gate_young(self):
        """Age < 5 should trigger age gate."""
        patient = PatientRecord(
            patient_id="TEST-5", age=3, sex="M",
            chief_complaint="fever",
            vital_temp=38.5, vital_spo2=97, vital_bp_sys=100, vital_hr=115
        )
        gates, escalation, reason = evaluate_policy_gates(patient, "yellow", DEFAULT_CONFIG)
        self.assertTrue(escalation)
        self.assertFalse(gates.get("age_gate"))

    def test_age_gate_elderly(self):
        """Age > 75 should trigger age gate."""
        patient = PatientRecord(
            patient_id="TEST-6", age=81, sex="F",
            chief_complaint="weakness",
            vital_temp=37.0, vital_spo2=95, vital_bp_sys=145, vital_hr=80
        )
        gates, escalation, reason = evaluate_policy_gates(patient, "yellow", DEFAULT_CONFIG)
        self.assertTrue(escalation)
        self.assertFalse(gates.get("age_gate"))

    def test_fever_gate(self):
        """High fever should trigger fever gate."""
        patient = PatientRecord(
            patient_id="TEST-7", age=40, sex="M",
            chief_complaint="fever",
            vital_temp=39.8, vital_spo2=97, vital_bp_sys=120, vital_hr=90
        )
        gates, escalation, reason = evaluate_policy_gates(patient, "yellow", DEFAULT_CONFIG)
        self.assertTrue(escalation)
        self.assertFalse(gates.get("fever_gate"))

    def test_hypoxia_gate(self):
        """Low SpO2 should trigger hypoxia gate."""
        patient = PatientRecord(
            patient_id="TEST-8", age=40, sex="M",
            chief_complaint="shortness of breath",
            vital_temp=37.0, vital_spo2=91, vital_bp_sys=120, vital_hr=100
        )
        gates, escalation, reason = evaluate_policy_gates(patient, "yellow", DEFAULT_CONFIG)
        self.assertTrue(escalation)
        self.assertFalse(gates.get("hypoxia_gate"))

    def test_comorbidity_gate(self):
        """Multiple comorbidities should trigger gate."""
        patient = PatientRecord(
            patient_id="TEST-9", age=60, sex="M",
            chief_complaint="chest pain",
            vital_temp=37.0, vital_spo2=97, vital_bp_sys=150, vital_hr=90,
            comorbidities=["diabetes", "hypertension", "CAD"]
        )
        gates, escalation, reason = evaluate_policy_gates(patient, "yellow", DEFAULT_CONFIG)
        self.assertTrue(escalation)
        self.assertFalse(gates.get("comorbidity_gate"))


class TestTriageDecisions(unittest.TestCase):
    """Test triage decision making."""

    def test_decision_creation(self):
        """Decision should be created with all required fields."""
        patient = PatientRecord(
            patient_id="TEST-10", age=40, sex="M",
            chief_complaint="chest pain",
            vital_temp=37.0, vital_spo2=98, vital_bp_sys=130, vital_hr=85
        )
        decision = make_triage_decision(patient, "TRIAGE-TEST-1", DEFAULT_CONFIG)
        self.assertEqual(decision.patient_id, "TEST-10")
        self.assertIn(decision.ai_triage_level, ["green", "yellow", "orange", "red"])
        self.assertGreaterEqual(decision.ai_confidence, 0)
        self.assertLessEqual(decision.ai_confidence, 1)
        self.assertIsNotNone(decision.evidence_pack)
        self.assertGreater(len(decision.policy_checks), 0)

    def test_decision_reproducibility(self):
        """Same patient input should produce same decision."""
        patient = PatientRecord(
            patient_id="TEST-11", age=40, sex="M",
            chief_complaint="fever",
            vital_temp=39.0, vital_spo2=96, vital_bp_sys=130, vital_hr=90
        )
        decision1 = make_triage_decision(patient, "TRIAGE-TEST-2", DEFAULT_CONFIG)
        decision2 = make_triage_decision(patient, "TRIAGE-TEST-3", DEFAULT_CONFIG)

        # Core decision fields should match
        self.assertEqual(decision1.ai_triage_level, decision2.ai_triage_level)
        self.assertEqual(decision1.ai_routing, decision2.ai_routing)
        self.assertEqual(decision1.escalation_required, decision2.escalation_required)


class TestStateManagement(unittest.TestCase):
    """Test state persistence and management."""

    def setUp(self):
        """Create temporary directory for state."""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up temporary files."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_state_schema(self):
        """State should have required schema fields."""
        state = TriageState(
            schema_version=SCHEMA_VERSION,
            snapshot_seq=0,
            generated_at=datetime.now(timezone.utc).isoformat(),
            config=DEFAULT_CONFIG,
        )
        self.assertEqual(state.schema_version, SCHEMA_VERSION)
        self.assertEqual(state.snapshot_seq, 0)
        self.assertEqual(len(state.patients), 0)
        self.assertEqual(len(state.decisions), 0)

    def test_audit_ledger_append_only(self):
        """Audit ledger should only append, never delete."""
        state = TriageState(
            schema_version=SCHEMA_VERSION,
            snapshot_seq=0,
            generated_at=datetime.now(timezone.utc).isoformat(),
            config=DEFAULT_CONFIG,
        )

        initial_len = len(state.audit_ledger)
        state.audit_ledger.append({"action": "test", "timestamp": datetime.now(timezone.utc).isoformat()})
        self.assertEqual(len(state.audit_ledger), initial_len + 1)

        # Verify old entries still exist
        self.assertEqual(state.audit_ledger[initial_len]["action"], "test")


class TestCommandCenterSnapshot(unittest.TestCase):
    """Test command center view generation."""

    def test_snapshot_structure(self):
        """Snapshot should have required structure."""
        state = TriageState(
            schema_version=SCHEMA_VERSION,
            snapshot_seq=1,
            generated_at=datetime.now(timezone.utc).isoformat(),
            config=DEFAULT_CONFIG,
        )

        # Add some test decisions
        patient = PatientRecord(
            patient_id="TEST-12", age=40, sex="M",
            chief_complaint="test",
            vital_temp=37.0, vital_spo2=98, vital_bp_sys=120, vital_hr=75
        )
        state.patients.append(patient)
        decision = make_triage_decision(patient, "TRIAGE-TEST-4", DEFAULT_CONFIG)
        state.decisions.append(decision)

        snapshot = build_command_center_snapshot(state)

        self.assertIn("generated_at", snapshot)
        self.assertIn("snapshot_seq", snapshot)
        self.assertIn("queue", snapshot)
        self.assertIn("metrics", snapshot)

        # Verify metrics
        metrics = snapshot["metrics"]
        self.assertGreaterEqual(metrics["total_decisions"], 0)
        self.assertGreaterEqual(metrics["auto_approve_rate"], 0)
        self.assertLessEqual(metrics["auto_approve_rate"], 1)
        self.assertGreaterEqual(metrics["escalation_rate"], 0)
        self.assertLessEqual(metrics["escalation_rate"], 1)


class TestIntegration(unittest.TestCase):
    """Integration tests for the full pipeline."""

    def test_patient_ingest_and_triage(self):
        """Full pipeline: ingest patients → triage → snapshot."""
        state = TriageState(
            schema_version=SCHEMA_VERSION,
            snapshot_seq=0,
            generated_at=datetime.now(timezone.utc).isoformat(),
            config=DEFAULT_CONFIG,
        )

        # Create test patients
        for i in range(5):
            patient = PatientRecord(
                patient_id=f"INT-{i}", age=40, sex="M",
                chief_complaint="test",
                vital_temp=37.0 + i*0.5, vital_spo2=98-i*2,
                vital_bp_sys=120+i*5, vital_hr=75+i*5
            )
            state.patients.append(patient)

        # Triage all
        state = triage_all_patients(state)

        # Verify all were triaged
        self.assertEqual(len(state.decisions), 5)

        # Build snapshot
        snapshot = build_command_center_snapshot(state)

        self.assertEqual(snapshot["metrics"]["total_decisions"], 5)
        self.assertGreater(len(snapshot["queue"]), 0)


if __name__ == "__main__":
    unittest.main()
