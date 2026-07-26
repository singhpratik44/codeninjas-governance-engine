"""Healthcare Triage Decision Center — runtime governance for clinical escalation.

Canonical state: patient record → triage severity assessment → routing decision.
Governance: policy checks (age, vitals, comorbidities) → approve/escalate/block.
Audit: every decision is reproducible, overridable, and auditable for 90 days.

Stdlib only. No network imports by design.
"""
from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Literal

SCHEMA_VERSION = 1
TRIAGE_LEVELS = ["green", "yellow", "orange", "red"]  # stable → urgent
ROUTING_OPTIONS = ["discharge", "general_admission", "ed", "icu", "trauma"]
DECISION_STATUSES = ["pending", "auto_approved", "escalated", "overridden", "blocked"]

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIAGE_STATE_DIR = os.path.join(REPO_ROOT, "healthcare-triage", "triage_state")
DATA_DIR = os.path.join(REPO_ROOT, "healthcare-triage", "data")

os.makedirs(TRIAGE_STATE_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Governance doctrine for clinical decisions
DOCTRINE = [
    "Patient safety first — escalate on any uncertainty, block on evidence of harm.",
    "Audit trail is operational — every decision must be reproducible.",
    "Escalation is not failure — uncertain cases go to physician, not auto-routed.",
    "Override evidence — when a physician overrides AI, reason and confidence recorded.",
]

DEFAULT_CONFIG = {
    "decision_timeout_minutes": 5,
    "escalation_timeout_minutes": 15,
    "policy_version": 1,
    "triage_levels": {
        "green": {"name": "Stable", "max_vital_deviation": 0.1, "routing": "discharge"},
        "yellow": {"name": "Watchful Waiting", "max_vital_deviation": 0.2, "routing": "general_admission"},
        "orange": {"name": "Urgent", "max_vital_deviation": 0.4, "routing": "ed"},
        "red": {"name": "Critical", "max_vital_deviation": 1.0, "routing": "icu"},
    },
    "policy_gates": {
        "age_gate": {"rule": "age < 5 or age > 75", "action": "escalate", "reason": "Age-based escalation"},
        "fever_gate": {"rule": "temp > 39.5", "action": "escalate", "reason": "High fever"},
        "hypoxia_gate": {"rule": "spo2 < 92", "action": "escalate", "reason": "Low oxygen"},
        "comorbidity_gate": {"rule": "comorbidities > 2", "action": "escalate", "reason": "Multiple comorbidities"},
        "pregnancy_gate": {"rule": "pregnant and red_triage", "action": "escalate", "reason": "Pregnant critical case"},
    },
}

# ---------------------------------------------------------------- state model

@dataclass
class PatientRecord:
    """A patient arriving for triage."""
    patient_id: str
    age: int
    sex: str
    chief_complaint: str
    vital_temp: float  # Celsius
    vital_spo2: int  # %
    vital_bp_sys: int  # systolic
    vital_hr: int  # bpm
    comorbidities: list[str] = field(default_factory=list)
    allergies: list[str] = field(default_factory=list)
    prior_visits: int = 0
    arrival_time: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class TriageDecision:
    """Runtime decision: AI triage → governance checks → human approval."""
    decision_id: str
    patient_id: str

    # AI assessment
    ai_severity_score: float  # 0–1, normalized
    ai_triage_level: str  # green/yellow/orange/red
    ai_routing: str  # discharge/general/ed/icu/trauma
    ai_confidence: float  # 0–1
    ai_reasoning: str  # why this routing

    # Governance checks
    policy_checks: dict[str, bool] = field(default_factory=dict)  # gate_name -> passed
    escalation_required: bool = False
    escalation_reason: str = ""

    # Human decision
    status: str = "pending"  # pending/auto_approved/escalated/overridden/blocked
    approved_by: str = ""
    approved_at: str = ""
    override_reason: str = ""

    # Audit
    decision_time_ms: int = 0
    cost_estimate: float = 0.0
    evidence_pack: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class TriageState:
    """Canonical state: all patients and decisions."""
    schema_version: int
    snapshot_seq: int
    generated_at: str
    config: dict
    patients: list[PatientRecord] = field(default_factory=list)
    decisions: list[TriageDecision] = field(default_factory=list)
    audit_ledger: list[dict] = field(default_factory=list)

# ---------------------------------------------------------------- core logic

def compute_triage_severity(patient: PatientRecord) -> tuple[str, float, str]:
    """Assess patient severity from vitals and presentation.

    Returns: (triage_level, severity_score 0–1, reasoning)
    """
    score = 0.0
    reasons = []

    # Fever contribution
    if patient.vital_temp >= 39.5:
        score += 0.3
        reasons.append("high fever")
    elif patient.vital_temp >= 38.5:
        score += 0.15
        reasons.append("fever")

    # Hypoxia contribution
    if patient.vital_spo2 < 92:
        score += 0.35
        reasons.append("low oxygen")
    elif patient.vital_spo2 < 95:
        score += 0.15
        reasons.append("mild hypoxia")

    # Tachycardia / bradycardia
    if patient.vital_hr > 120 or patient.vital_hr < 50:
        score += 0.2
        reasons.append("abnormal heart rate")

    # Hypertension / hypotension
    if patient.vital_bp_sys > 160 or patient.vital_bp_sys < 90:
        score += 0.1
        reasons.append("abnormal blood pressure")

    # Age risk
    if patient.age < 5 or patient.age > 75:
        score += 0.15
        reasons.append("age-based risk")

    # Comorbidities
    if len(patient.comorbidities) > 2:
        score += 0.1
        reasons.append(f"{len(patient.comorbidities)} comorbidities")

    score = min(1.0, score)

    if score >= 0.75:
        level = "red"
    elif score >= 0.5:
        level = "orange"
    elif score >= 0.25:
        level = "yellow"
    else:
        level = "green"

    reasoning = "; ".join(reasons) if reasons else "stable vitals"
    return level, score, reasoning

def evaluate_policy_gates(patient: PatientRecord, ai_level: str, config: dict) -> tuple[dict[str, bool], bool, str]:
    """Check clinical policy gates. Return (gate_results, escalation_required, reason)."""
    gates = config.get("policy_gates", {})
    results = {}
    escalation_required = False
    escalation_reasons = []

    # Age gate
    if patient.age < 5 or patient.age > 75:
        results["age_gate"] = False
        escalation_required = True
        escalation_reasons.append(f"age {patient.age} requires escalation")
    else:
        results["age_gate"] = True

    # Fever gate
    if patient.vital_temp > 39.5:
        results["fever_gate"] = False
        escalation_required = True
        escalation_reasons.append("high fever requires escalation")
    else:
        results["fever_gate"] = True

    # Hypoxia gate
    if patient.vital_spo2 < 92:
        results["hypoxia_gate"] = False
        escalation_required = True
        escalation_reasons.append("low oxygen requires escalation")
    else:
        results["hypoxia_gate"] = True

    # Comorbidity gate
    if len(patient.comorbidities) > 2:
        results["comorbidity_gate"] = False
        escalation_required = True
        escalation_reasons.append(f"{len(patient.comorbidities)} comorbidities require escalation")
    else:
        results["comorbidity_gate"] = True

    # Red triage gate
    if ai_level == "red":
        results["critical_gate"] = False
        escalation_required = True
        escalation_reasons.append("critical triage requires physician review")
    else:
        results["critical_gate"] = True

    reason = "; ".join(escalation_reasons) if escalation_reasons else ""
    return results, escalation_required, reason

def make_triage_decision(patient: PatientRecord, decision_id: str, config: dict) -> TriageDecision:
    """Make a triage decision: assess, check policy, return decision for approval."""
    import time
    start_time = time.time() * 1000

    # AI assessment
    ai_level, ai_severity, reasoning = compute_triage_severity(patient)

    # Routing
    routing_map = {
        "green": "discharge",
        "yellow": "general_admission",
        "orange": "ed",
        "red": "icu",
    }
    ai_routing = routing_map.get(ai_level, "ed")

    # Confidence: higher if vitals support the triage level, lower if mixed signals
    ai_confidence = min(1.0, ai_severity + 0.1)

    # Policy checks
    policy_checks, escalation_required, escalation_reason = evaluate_policy_gates(patient, ai_level, config)

    # Cost estimate (rough)
    cost_map = {"discharge": 0, "general_admission": 1500, "ed": 2400, "icu": 5000, "trauma": 7500}
    cost = cost_map.get(ai_routing, 2400)

    # Status: auto-approve if no escalation, else escalate to physician
    status = "auto_approved" if not escalation_required else "escalated"

    # Build evidence pack
    evidence_pack = {
        "vitals": {
            "temperature": patient.vital_temp,
            "oxygen_saturation": patient.vital_spo2,
            "blood_pressure_sys": patient.vital_bp_sys,
            "heart_rate": patient.vital_hr,
        },
        "demographics": {
            "age": patient.age,
            "sex": patient.sex,
        },
        "presentation": {
            "chief_complaint": patient.chief_complaint,
            "comorbidities": patient.comorbidities,
            "allergies": patient.allergies,
            "prior_visits": patient.prior_visits,
        },
        "triage_reasoning": reasoning,
    }

    elapsed_ms = int(time.time() * 1000 - start_time)

    return TriageDecision(
        decision_id=decision_id,
        patient_id=patient.patient_id,
        ai_severity_score=ai_severity,
        ai_triage_level=ai_level,
        ai_routing=ai_routing,
        ai_confidence=ai_confidence,
        ai_reasoning=reasoning,
        policy_checks=policy_checks,
        escalation_required=escalation_required,
        escalation_reason=escalation_reason,
        status=status,
        cost_estimate=cost,
        evidence_pack=evidence_pack,
        decision_time_ms=elapsed_ms,
    )

def approve_decision(state: TriageState, decision_id: str, approved_by: str, override: bool = False, override_reason: str = "") -> dict:
    """Approve a triage decision or override it with reason."""
    decision = next((d for d in state.decisions if d.decision_id == decision_id), None)
    if not decision:
        return {"ok": False, "reason": "Decision not found"}

    if override:
        decision.status = "overridden"
        decision.override_reason = override_reason
    else:
        decision.status = "auto_approved" if not decision.escalation_required else "escalated"

    decision.approved_by = approved_by
    decision.approved_at = datetime.now(timezone.utc).isoformat()

    # Audit entry
    state.audit_ledger.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "decision_id": decision_id,
        "patient_id": decision.patient_id,
        "action": "override" if override else "approve",
        "approved_by": approved_by,
        "routing": decision.ai_routing,
        "override_reason": override_reason if override else "",
    })

    return {"ok": True, "status": decision.status, "routing": decision.ai_routing}

def load_state() -> TriageState:
    """Load canonical state from disk, or initialize empty."""
    state_file = os.path.join(TRIAGE_STATE_DIR, "canonical_state_latest.json")
    if os.path.exists(state_file):
        with open(state_file) as f:
            data = json.load(f)
            return TriageState(
                schema_version=data.get("schema_version", SCHEMA_VERSION),
                snapshot_seq=data.get("snapshot_seq", 0),
                generated_at=data.get("generated_at", ""),
                config=data.get("config", DEFAULT_CONFIG),
                patients=[PatientRecord(**p) for p in data.get("patients", [])],
                decisions=[TriageDecision(**d) for d in data.get("decisions", [])],
                audit_ledger=data.get("audit_ledger", []),
            )
    return TriageState(
        schema_version=SCHEMA_VERSION,
        snapshot_seq=0,
        generated_at=datetime.now(timezone.utc).isoformat(),
        config=DEFAULT_CONFIG,
    )

def save_state(state: TriageState):
    """Save canonical state and increment seq."""
    state.snapshot_seq += 1
    state.generated_at = datetime.now(timezone.utc).isoformat()

    # Latest
    state_file = os.path.join(TRIAGE_STATE_DIR, "canonical_state_latest.json")
    with open(state_file, "w") as f:
        json.dump(asdict(state), f, indent=2, default=str)

    # Versioned
    version_dir = os.path.join(TRIAGE_STATE_DIR, "versions")
    os.makedirs(version_dir, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    version_file = os.path.join(version_dir, f"state_v{state.snapshot_seq:04d}_{ts}.json")
    with open(version_file, "w") as f:
        json.dump(asdict(state), f, indent=2, default=str)

def ingest_patients(state: TriageState, csv_path: str) -> TriageState:
    """Ingest patients from CSV."""
    if not os.path.exists(csv_path):
        return state

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            patient = PatientRecord(
                patient_id=row["patient_id"],
                age=int(row["age"]),
                sex=row["sex"],
                chief_complaint=row["chief_complaint"],
                vital_temp=float(row["vital_temp"]),
                vital_spo2=int(row["vital_spo2"]),
                vital_bp_sys=int(row["vital_bp_sys"]),
                vital_hr=int(row["vital_hr"]),
                comorbidities=row.get("comorbidities", "").split(";") if row.get("comorbidities") else [],
                allergies=row.get("allergies", "").split(";") if row.get("allergies") else [],
                prior_visits=int(row.get("prior_visits", 0)),
            )
            # Upsert
            existing = next((p for p in state.patients if p.patient_id == patient.patient_id), None)
            if existing:
                idx = state.patients.index(existing)
                state.patients[idx] = patient
            else:
                state.patients.append(patient)
    return state

def triage_all_patients(state: TriageState) -> TriageState:
    """Make triage decisions for all patients without existing decisions."""
    for i, patient in enumerate(state.patients):
        # Skip if already has a decision
        if any(d.patient_id == patient.patient_id for d in state.decisions):
            continue

        decision = make_triage_decision(patient, f"TRIAGE-{i:04d}", state.config)
        state.decisions.append(decision)

    return state

def build_command_center_snapshot(state: TriageState) -> dict:
    """Build the command center view: queue, decisions, metrics."""
    decisions_pending = [d for d in state.decisions if d.status in ["pending", "escalated"]]
    decisions_approved = [d for d in state.decisions if d.status == "auto_approved"]
    decisions_overridden = [d for d in state.decisions if d.status == "overridden"]

    # Metrics
    total_decisions = len(state.decisions)
    auto_approve_rate = len(decisions_approved) / total_decisions if total_decisions else 0
    escalation_rate = len([d for d in state.decisions if d.escalation_required]) / total_decisions if total_decisions else 0
    override_rate = len(decisions_overridden) / total_decisions if total_decisions else 0
    avg_latency_ms = sum(d.decision_time_ms for d in state.decisions) / total_decisions if total_decisions else 0
    total_cost = sum(d.cost_estimate for d in state.decisions)

    return {
        "generated_at": state.generated_at,
        "snapshot_seq": state.snapshot_seq,
        "queue": [
            {
                "decision_id": d.decision_id,
                "patient_id": d.patient_id,
                "ai_triage_level": d.ai_triage_level,
                "ai_routing": d.ai_routing,
                "ai_confidence": d.ai_confidence,
                "status": d.status,
                "escalation_required": d.escalation_required,
                "escalation_reason": d.escalation_reason,
                "evidence_pack": d.evidence_pack,
                "policy_checks": d.policy_checks,
                "cost_estimate": d.cost_estimate,
                "decision_time_ms": d.decision_time_ms,
                "created_at": d.created_at,
            }
            for d in sorted(decisions_pending, key=lambda d: d.created_at)
        ],
        "metrics": {
            "total_decisions": total_decisions,
            "auto_approve_rate": auto_approve_rate,
            "escalation_rate": escalation_rate,
            "override_rate": override_rate,
            "avg_latency_ms": avg_latency_ms,
            "total_cost": total_cost,
            "pending_count": len(decisions_pending),
        },
    }

# ---------------------------------------------------------------- CLI

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Healthcare Triage Engine")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    ingest_parser = subparsers.add_parser("ingest", help="Ingest patients from CSV")
    ingest_parser.add_argument("--csv", default=os.path.join(DATA_DIR, "patients.csv"), help="Path to CSV file")

    subparsers.add_parser("triage", help="Run triage on ingested patients")
    subparsers.add_parser("build", help="Build command center snapshot")

    args = parser.parse_args()

    if args.command == "ingest":
        state = load_state()
        state = ingest_patients(state, args.csv)
        save_state(state)
        print(f"Ingested {len(state.patients)} patients")
    elif args.command == "triage":
        state = load_state()
        state = triage_all_patients(state)
        save_state(state)
        print(f"Triaged {len(state.decisions)} patients")
    elif args.command == "build":
        state = load_state()
        snapshot = build_command_center_snapshot(state)
        snapshot_path = os.path.join(TRIAGE_STATE_DIR, "command_center_latest.json")
        with open(snapshot_path, "w") as f:
            json.dump(snapshot, f, indent=2)
        print(f"Built snapshot: {snapshot_path}")
    else:
        parser.print_help()
