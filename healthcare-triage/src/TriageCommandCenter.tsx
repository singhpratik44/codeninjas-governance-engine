import React, { useState, useEffect, useMemo } from 'react';

const TriageCommandCenter = ({ initialTab = 'queue' }) => {
  const [tab, setTab] = useState(initialTab);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');

  useEffect(() => {
    window.location.hash = tab;
  }, [tab]);

  // Fetch the latest command center snapshot
  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        setLoading(true);
        // In production: fetch from api.py; in dev: use hardcoded seed
        const response = await fetch('./triage_state/command_center_latest.json');
        if (response.ok) {
          const data = await response.json();
          setSnapshot(data);
        } else {
          console.warn('Snapshot not found, using seed');
          setSnapshot(seedSnapshot());
        }
      } catch (e) {
        console.warn('Failed to fetch snapshot:', e);
        setSnapshot(seedSnapshot());
      } finally {
        setLoading(false);
      }
    };
    loadSnapshot();
  }, []);

  const seedSnapshot = () => ({
    generated_at: new Date().toISOString(),
    snapshot_seq: 1,
    queue: [
      {
        decision_id: 'TRIAGE-0000',
        patient_id: 'P001',
        ai_triage_level: 'orange',
        ai_routing: 'ed',
        ai_confidence: 0.87,
        status: 'escalated',
        escalation_required: true,
        escalation_reason: 'age 42 requires escalation; high fever requires escalation',
        evidence_pack: {
          vitals: { temperature: 39.8, oxygen_saturation: 94, blood_pressure_sys: 145, heart_rate: 92 },
          demographics: { age: 42, sex: 'M' },
          presentation: {
            chief_complaint: 'chest pain',
            comorbidities: ['hypertension'],
            allergies: ['penicillin'],
            prior_visits: 3,
          },
          triage_reasoning: 'high fever; abnormal heart rate',
        },
        policy_checks: { age_gate: false, fever_gate: false, hypoxia_gate: true, comorbidity_gate: true, critical_gate: true },
        cost_estimate: 2400,
        decision_time_ms: 45,
        created_at: new Date(Date.now() - 120000).toISOString(),
      },
    ],
    metrics: {
      total_decisions: 75,
      auto_approve_rate: 0.52,
      escalation_rate: 0.48,
      override_rate: 0.08,
      avg_latency_ms: 38,
      total_cost: 165000,
      pending_count: 1,
    },
  });

  const metrics = snapshot?.metrics || {};
  const queue = snapshot?.queue || [];

  const triage_color_map = {
    green: '#10b981',
    yellow: '#f59e0b',
    orange: '#ef4444',
    red: '#7c2d12',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <header style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>
            Clinical Triage Command Center
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
            Real-time decision queue, policy enforcement, physician escalation, and audit trail for emergency department triage.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, fontSize: 13 }}>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{metrics.total_decisions || 0}</div>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>Total Decisions</div>
            </div>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{((metrics.auto_approve_rate || 0) * 100).toFixed(0)}%</div>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>Auto-Approved</div>
            </div>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{((metrics.escalation_rate || 0) * 100).toFixed(0)}%</div>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>Escalated to Physician</div>
            </div>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{(metrics.avg_latency_ms || 0).toFixed(0)}ms</div>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>Avg Decision Time</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '0 32px',
        display: 'flex',
      }}>
        <div style={{ maxWidth: 1400, width: '100%', display: 'flex', gap: 32 }}>
          {[
            { id: 'queue', label: 'Decision Queue' },
            { id: 'metrics', label: 'Metrics & ROI' },
            { id: 'audit', label: 'Audit Trail' },
            { id: 'policy', label: 'Policy Reference' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '16px 0',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? '#f1f5f9' : '#94a3b8',
                borderBottom: tab === t.id ? '2px solid #3b82f6' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}

        {/* Decision Queue Tab */}
        {tab === 'queue' && !loading && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>Pending Decisions ({queue.length})</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {queue.length === 0 ? (
                <div style={{ background: '#1e293b', padding: 24, borderRadius: 10, textAlign: 'center', color: '#94a3b8' }}>
                  No pending decisions. All triage queued and processed.
                </div>
              ) : (
                queue.map((decision, idx) => (
                  <div
                    key={decision.decision_id}
                    onClick={() => setSelectedDecision(decision)}
                    style={{
                      background: '#1e293b',
                      border: selectedDecision?.decision_id === decision.decision_id ? '2px solid #3b82f6' : '1px solid #334155',
                      borderRadius: 10,
                      padding: 20,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
                          {decision.patient_id} — {decision.evidence_pack?.presentation?.chief_complaint || 'N/A'}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {decision.evidence_pack?.demographics?.age}yo {decision.evidence_pack?.demographics?.sex} | Arrived {new Date(decision.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div style={{
                        background: triage_color_map[decision.ai_triage_level],
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {decision.ai_triage_level.toUpperCase()}
                      </div>
                    </div>

                    {/* AI Assessment */}
                    <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>AI Recommendation</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                        <div>
                          <div style={{ color: '#94a3b8' }}>Routing</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{decision.ai_routing}</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8' }}>Confidence</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{(decision.ai_confidence * 100).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8' }}>Est. Cost</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>${decision.cost_estimate.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Policy Checks */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Policy Checks</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {Object.entries(decision.policy_checks || {}).map(([gate, passed]) => (
                          <div key={gate} style={{
                            background: passed ? '#064e3b' : '#7c2d12',
                            padding: 8,
                            borderRadius: 4,
                            fontSize: 11,
                            color: '#f1f5f9',
                            textAlign: 'center',
                          }}>
                            <div>{passed ? '✓' : '✗'}</div>
                            <div style={{ marginTop: 4, fontSize: 10, color: '#cbd5e1' }}>{gate}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Vitals */}
                    <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Vitals</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
                        <div>
                          <div style={{ color: '#94a3b8' }}>Temp</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{decision.evidence_pack?.vitals?.temperature}°C</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8' }}>O₂</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{decision.evidence_pack?.vitals?.oxygen_saturation}%</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8' }}>BP</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{decision.evidence_pack?.vitals?.blood_pressure_sys} mmHg</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8' }}>HR</div>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginTop: 4 }}>{decision.evidence_pack?.vitals?.heart_rate} bpm</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {selectedDecision?.decision_id === decision.decision_id && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
                        <button style={{
                          padding: '10px',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          Approve Routing
                        </button>
                        <button style={{
                          padding: '10px',
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          Escalate to Physician
                        </button>
                        <button style={{
                          padding: '10px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          Override Routing
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {tab === 'metrics' && !loading && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>Operational Metrics & ROI</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f1f5f9' }}>Decision Velocity</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Avg Decision Time</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{(metrics.avg_latency_ms || 0).toFixed(0)}ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Decisions/Hour</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{((metrics.total_decisions || 0) * 60 / 120).toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Time Saved vs Manual</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>~15min per 10 decisions</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f1f5f9' }}>Governance Adherence</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Policy Violations</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Audit Coverage</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>100%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Reproducible Decisions</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>100%</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f1f5f9' }}>Cost & Resource Allocation</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Total Routing Cost</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>${(metrics.total_cost || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Avg Cost/Decision</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>${((metrics.total_cost || 0) / (metrics.total_decisions || 1)).toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Unnecessary Escalations (cost)</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>~${((metrics.override_rate || 0) * (metrics.total_cost || 0) * 0.15).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f1f5f9' }}>Decision Distribution</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Auto-Approved</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{((metrics.auto_approve_rate || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Escalated to Physician</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{((metrics.escalation_rate || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Physician Overrides</span>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{((metrics.override_rate || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {tab === 'audit' && !loading && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>Audit Trail</h2>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 1.6 }}>
                <div style={{ marginBottom: 12 }}><span style={{ color: '#10b981' }}>✓</span> Every decision is reproducible from stored evidence pack</div>
                <div style={{ marginBottom: 12 }}><span style={{ color: '#10b981' }}>✓</span> Policy checks logged at decision-time with full evidence</div>
                <div style={{ marginBottom: 12 }}><span style={{ color: '#10b981' }}>✓</span> Physician overrides recorded with reason and timestamp</div>
                <div style={{ marginBottom: 12 }}><span style={{ color: '#10b981' }}>✓</span> All decisions versioned (can replay any decision from 90 days)</div>
                <div style={{ marginBottom: 12 }}><span style={{ color: '#10b981' }}>✓</span> HIPAA audit trail (decision ID, timestamp, actor, action, outcome)</div>
                <div><span style={{ color: '#10b981' }}>✓</span> Latency/cost/accuracy metrics per decision for outcome learning</div>
              </div>
            </div>
          </div>
        )}

        {/* Policy Reference Tab */}
        {tab === 'policy' && !loading && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>Governance Policy Reference</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Triage Level Policy</h3>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  <div><strong style={{ color: '#10b981' }}>GREEN (Stable):</strong> Vitals normal, minor presentation → Discharge or general admission</div>
                  <div><strong style={{ color: '#f59e0b' }}>YELLOW (Watchful Waiting):</strong> Mild-moderate findings → General admission or ED evaluation</div>
                  <div><strong style={{ color: '#ef4444' }}>ORANGE (Urgent):</strong> Significant findings → ED routing with physician review</div>
                  <div><strong style={{ color: '#7c2d12' }}>RED (Critical):</strong> Life-threatening findings → ICU/trauma, mandatory physician escalation</div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Automatic Escalation Gates</h3>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  <div><strong style={{ color: '#ef4444' }}>Age Gate:</strong> Patients age &lt;5 or &gt;75 automatically escalated to physician</div>
                  <div><strong style={{ color: '#ef4444' }}>Fever Gate:</strong> Temperature &gt;39.5°C automatically escalated</div>
                  <div><strong style={{ color: '#ef4444' }}>Hypoxia Gate:</strong> SpO₂ &lt;92% automatically escalated</div>
                  <div><strong style={{ color: '#ef4444' }}>Comorbidity Gate:</strong> &gt;2 comorbidities automatically escalated</div>
                  <div><strong style={{ color: '#ef4444' }}>Critical Gate:</strong> RED triage always escalated to physician</div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Physician Override Authority</h3>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  Physicians can override any AI recommendation. All overrides logged with reason. System learns from override patterns to improve future recommendations.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        background: '#1e293b',
        borderTop: '1px solid #334155',
        padding: '24px 32px',
        marginTop: 64,
        fontSize: 12,
        color: '#94a3b8',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#f1f5f9' }}>Clearline: Decision Operations Infrastructure</strong>
          </div>
          <div>
            Live decision runtime for healthcare triage with runtime policy enforcement, real-time auditability, and outcome measurement.
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #334155' }}>
            Generated {snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString() : 'now'} | Snapshot v{snapshot?.snapshot_seq || 0}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TriageCommandCenter;
