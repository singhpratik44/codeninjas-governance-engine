// ============================================================================
// QUANTUM PM REFACTORED — Boundary Observables Implementation
// Applies all five pillars from design principles:
// 1. Holographic Principle → Boundary Observables
// 2. Black-Hole Thermodynamics → Information Release Curves
// 3. Quantum Geometry → Network Topology & Curvature
// 4. Light Angles → Alignment Heuristic
// 5. Consciousness & IIT → Integration Metrics (Φ)
// ============================================================================

import React, { useState, useMemo } from "react";
import FranchiseGovernanceService, {
  ApprovalDecision,
  BoundaryObservable,
  FranchiseeProfile,
  TerritoryHealth,
} from "./governance-integration";

const GRN = "#2f7a3f";
const AMB = "#b8860b";
const VIO = "#7a6bd8";
const INK = "#111";
const MUT = "#666";
const RULE = "#ccc";
const BG = "#fdfdfb";

// ============================================================================
// PILLAR 1: BOUNDARY OBSERVABLE CARD
// CEO/board can approve/reject in 2 minutes
// Shows: SR%, gates, capital unlock, confidence
// Hides: internal details, scenario deltas
// ============================================================================

function BoundaryObservableCard({ decision, onApprove, onDefer }: { decision: ApprovalDecision; onApprove: () => void; onDefer: () => void }) {
  const { franchisee } = useMemo(() => {
    const f = decision;
    return { franchisee: f };
  }, [decision]);

  const obs = decision.boundaryObservable;
  const align = decision.alignmentAnalysis;

  return (
    <div style={{ border: `2px solid ${GRN}`, borderRadius: 8, padding: 16, marginBottom: 16, background: "#f9faf8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUT, textTransform: "uppercase" }}>
            Franchisee: {decision.franchiseeId}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginTop: 4 }}>
            Territory: {decision.alignmentAnalysis.franchiseeId}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>
          Confidence: <span style={{ color: obs.confidence > 0.8 ? GRN : obs.confidence > 0.65 ? AMB : "#8b0000" }}>{(obs.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Boundary Observables Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16, padding: "12px 0", borderBottom: `1px solid ${RULE}` }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: "uppercase", marginBottom: 4 }}>Success Rate (vs avg)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: GRN }}>
            {(obs.successRate * 100).toFixed(0)}%
            <span style={{ fontSize: 11, color: MUT, marginLeft: 4 }}>(vs 65% network avg)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: "uppercase", marginBottom: 4 }}>Capital Unlock</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: VIO }}>
            ${(obs.capitalUnlock / 1000).toFixed(0)}K
            <span style={{ fontSize: 11, color: MUT, marginLeft: 4 }}>(fee + build-out)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: "uppercase", marginBottom: 4 }}>Months to Positive</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>
            {obs.estimatedMonthsToEBITDAPositive}
            <span style={{ fontSize: 11, color: MUT, marginLeft: 4 }}>months</span>
          </div>
        </div>
      </div>

      {/* Governor Gates (must pass all 4) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: MUT, marginBottom: 8 }}>
          Governor Gates ({obs.gates.filter(g => g.pass).length}/{obs.gates.length} pass)
        </div>
        {obs.gates.map((gate) => (
          <div key={gate.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11 }}>
            <span style={{ fontSize: 12, color: gate.pass ? GRN : "#8b0000" }}>{gate.pass ? "✓" : "⚠"}</span>
            <span style={{ fontWeight: 700, color: INK }}>{gate.name}:</span>
            <span style={{ color: MUT }}>{gate.reason}</span>
          </div>
        ))}
      </div>

      {/* Why (Causal Explanation) */}
      <div style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 11, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: INK, marginBottom: 8 }}>Why this decision:</div>
        <ul style={{ margin: "0 0 0 16px", paddingLeft: 0 }}>
          <li style={{ marginBottom: 4 }}>
            {align.tier === "aligned" ? "✓ Existing territory with strong funnel and peer network" : align.tier === "oblique" ? "⚠ New territory—requires ops coordination" : "✗ Territory saturated or franchisee weak—defer"}
          </li>
          <li style={{ marginBottom: 4 }}>
            {obs.gates.filter(g => g.pass).length === 4 ? "✓ All approval gates pass" : `⚠ ${4 - obs.gates.filter(g => g.pass).length} gate(s) flag concerns`}
          </li>
          <li style={{ marginBottom: 4 }}>
            {decision.integrationMetrics.phi <= 0.70 ? "✓ Network coherence healthy—safe to approve" : "⚠ Network coherence high—consider smaller approval pace"}
          </li>
          <li>Risk: {align.tier === "aligned" ? "Low risk if market conditions hold" : "Requires close monitoring first 6 months"}</li>
        </ul>
      </div>

      {/* Approval Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onApprove}
          disabled={decision.decision === "defer"}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 700,
            background: decision.decision === "approve" ? GRN : "#e0e0e0",
            color: decision.decision === "approve" ? "#fff" : MUT,
            border: "none",
            borderRadius: 4,
            cursor: decision.decision === "defer" ? "not-allowed" : "pointer",
            opacity: decision.decision === "defer" ? 0.5 : 1,
          }}>
          Approve {decision.decision === "approve" ? "(Recommended)" : decision.decision === "conditional" ? "(Conditional)" : "(Disabled)"}
        </button>
        <button
          onClick={onDefer}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 700,
            background: "transparent",
            color: "#666",
            border: `1px solid ${RULE}`,
            borderRadius: 4,
            cursor: "pointer",
          }}>
          Defer {decision.decision === "defer" ? "(Recommended)" : ""}
        </button>
      </div>

      {/* Audit Trail Link */}
      <div style={{ fontSize: 9, color: MUT, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>View audit trail & full analysis</summary>
          <div style={{ marginTop: 8, fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 8, borderRadius: 2, lineHeight: 1.4 }}>
            {decision.auditTrail}
          </div>
        </details>
      </div>
    </div>
  );
}

// ============================================================================
// PILLAR 2: INFORMATION RELEASE CURVES
// Shows when each forecast signal becomes observable
// ============================================================================

function InformationReleaseCurves({ decision }: { decision: ApprovalDecision }) {
  const forecast = decision.forecastCurve;

  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUT, textTransform: "uppercase", marginBottom: 12 }}>
        Forecast: 24-Month Growth Curve
      </div>

      {/* Text Graph */}
      <div style={{ marginBottom: 16, fontFamily: "monospace", fontSize: 9, lineHeight: 1.4, background: "#f9f9f9", padding: 8, borderRadius: 2 }}>
        <div>100% │ Optimistic ╱╱╱╱╱────────</div>
        <div> % │</div>
        <div> 50%│ Realistic═══════════════════</div>
        <div> │ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱</div>
        <div> │ Pessimistic</div>
        <div> 0% └──────────────────────────────</div>
        <div> │ 0 4 8 12 16 20 24</div>
        <div> └─ Months (forecast window)</div>
      </div>

      {/* Information Release Windows */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {forecast.informationReleaseWindows.map((window) => (
          <div key={window.phase} style={{ background: "#f5f5f5", padding: 10, borderRadius: 3, fontSize: 10 }}>
            <div style={{ fontWeight: 700, color: INK, marginBottom: 6 }}>
              {window.phase === "setup" ? "Setup" : window.phase === "release" ? "Information Release" : window.phase === "outcome" ? "Outcome Signal" : "Plateau"}
              {" "}
              (Mo {window.weekStart}-{window.weekEnd})
            </div>
            {window.observableSignals.map((signal) => (
              <div key={signal} style={{ marginBottom: 3, color: MUT }}>
                • {signal}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: MUT, marginTop: 12, lineHeight: 1.5 }}>
        <strong>Board Question:</strong> "When do we know if this approval worked?" <br />
        <strong>Answer:</strong> Months 8–12: unit health metrics show profitability trend. Month 16: capital payback clarity.
      </div>
    </div>
  );
}

// ============================================================================
// PILLAR 3: NETWORK TOPOLOGY & CURVATURE
// Discrete graph with bottleneck identification
// ============================================================================

function NetworkTopologyView({ decision }: { decision: ApprovalDecision }) {
  const topo = decision.networkTopology;
  const clusters = topo.clusters[0];

  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUT, textTransform: "uppercase", marginBottom: 12 }}>
        Network Topology & Structural Risk
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK, marginBottom: 6 }}>Network Structure</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10 }}>
            <li>{topo.nodes.length} total nodes</li>
            <li>{topo.edges.length} support edges</li>
            <li>{topo.clusters.length} cluster(s)</li>
            <li>{topo.bottlenecks.length} bottleneck node(s)</li>
            <li>{topo.isolatedNodes.length} isolated node(s)</li>
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK, marginBottom: 6 }}>Cluster Analysis</div>
          <div style={{ fontSize: 10, color: MUT, lineHeight: 1.6 }}>
            <div>
              <strong>Laplacian Curvature:</strong> {clusters.laplacianCurvature.toFixed(2)} ({clusters.laplacianCurvature > 0.6 ? "HIGH (bottleneck)" : "MEDIUM"})
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Risk Level:</strong> <span style={{ color: clusters.riskLevel === "high" ? "#8b0000" : AMB }}>{clusters.riskLevel.toUpperCase()}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Recommendation:</strong> {clusters.recommendation}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: MUT, lineHeight: 1.5, background: "#fff9e6", padding: 10, borderRadius: 3 }}>
        <strong>What this means:</strong> {clusters.laplacianCurvature > 0.6 ? "Funnel is a bottleneck. Adding ops staff to Bay Area would reduce curvature and enable parallel approvals." : "Load is distributed. Territory can absorb additional franchisees safely."}
      </div>
    </div>
  );
}

// ============================================================================
// PILLAR 4: ALIGNMENT HEURISTIC
// Angle-based routing to decide approval tier
// ============================================================================

function AlignmentHeuristicView({ decision }: { decision: ApprovalDecision }) {
  const align = decision.alignmentAnalysis;

  const tierColor = align.tier === "aligned" ? GRN : align.tier === "oblique" ? AMB : "#8b0000";
  const tierLabel = align.tier === "aligned" ? "ALIGNED (Approve)" : align.tier === "oblique" ? "OBLIQUE (Conditional)" : "OPPOSITE (Defer)";

  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUT, textTransform: "uppercase", marginBottom: 12 }}>
        Alignment Heuristic: Growth Vector Analysis
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: tierColor, marginBottom: 8 }}>
            Angle: {align.alignmentAngle}° → {tierLabel}
          </div>
          <div style={{ fontSize: 10, color: MUT, lineHeight: 1.6 }}>
            <div>
              <strong>How aligned is this proposal with network health goals?</strong>
            </div>
            <div style={{ marginTop: 8 }}>• &lt;30°: Existing strong territory, high-capacity franchisee, peer support ready</div>
            <div>• 30-90°: New territory, moderate capacity, requires ops coordination</div>
            <div>• &gt;90°: Saturated territory, weak franchisee, or peer network stretched</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK, marginBottom: 6 }}>Decision Guidance</div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div>
              <strong>Tier:</strong> <span style={{ color: tierColor }}>{tierLabel}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>Support Required:</strong> {align.supportRequired === "minimal" ? "Minimal (mostly self-serve)" : align.supportRequired === "standard" ? "Standard ops coordination" : align.supportRequired === "intensive" ? "Intensive support plan" : "Defer 6-12 months"}
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>Expected ROI:</strong> {align.expectedROI > 0 ? `${align.expectedROI} months to profitability` : "Wait for better market posture"}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: MUT }}>{align.reasoning}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PILLAR 5: INTEGRATION METRICS (Φ)
// Network coherence score: measure system coupling
// ============================================================================

function IntegrationMetricsView({ decision }: { decision: ApprovalDecision }) {
  const metrics = decision.integrationMetrics;

  const phiColor = metrics.phi > 0.75 ? VIO : metrics.phi > 0.55 ? "inherit" : "inherit";

  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUT, textTransform: "uppercase", marginBottom: 12 }}>
        Network Coherence Score (Φ)
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: phiColor, marginBottom: 4 }}>Φ = {metrics.phi.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: MUT, lineHeight: 1.5 }}>
            <div>{metrics.interpretation}</div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>Risk: {metrics.riskAssessment.toUpperCase()}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK, marginBottom: 6 }}>What Φ Means</div>
          <div style={{ fontSize: 9, color: MUT, lineHeight: 1.6 }}>
            <div>
              <strong>High Φ (&gt;0.75):</strong> Tightly coupled network; stable but fragile (cascading risk)
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Medium Φ (0.55–0.75):</strong> Balanced; some shocks isolated, some propagate
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Low Φ (&lt;0.55):</strong> Loose network; unpredictable but resilient
            </div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>Target: Φ = 0.65 (healthy balance)</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: MUT, marginTop: 12, padding: "8px 0", borderTop: `1px solid ${RULE}` }}>
        <strong>Current state:</strong> Φ = {metrics.phi.toFixed(2)}; target = 0.65. {metrics.phi < 0.65 ? "Safe to approve additional franchises; coherence will increase naturally." : "Approach near-term approvals cautiously; monitor for over-tightening."}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN QUANTUM PM COMPONENT
// ============================================================================

export function QuantumPMRefactored() {
  const [selectedFranchisee, setSelectedFranchisee] = useState<string>("jane-doe-portland");
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>("");

  const service = useMemo(() => {
    const s = new FranchiseGovernanceService();

    // Register sample data
    s.registerFranchisee({
      id: "jane-doe-portland",
      name: "Jane Doe",
      territory: "Portland OR",
      state: "OR",
      creditScore: 750,
      experience: "both",
      capitalAvailable: 300000,
      contractStatus: "pending_approval",
    });

    s.registerTerritoryHealth({
      stateCode: "OR",
      centerCount: 5,
      avgConversionRate: 0.12,
      avgRetention: 0.82,
      avgEBITDAMargin: 0.08,
      peerNetworkSize: 5,
      funnelBottleneck: false,
    });

    // Add more territories
    s.registerTerritoryHealth({
      stateCode: "CA",
      centerCount: 34,
      avgConversionRate: 0.08,
      avgRetention: 0.78,
      avgEBITDAMargin: 0.06,
      peerNetworkSize: 20,
      funnelBottleneck: true,
    });

    return s;
  }, []);

  const handleMakeDecision = () => {
    const d = service.makeApprovalDecision(selectedFranchisee);
    setDecision(d);
    setApprovalStatus("");
  };

  const handleApprove = () => {
    setApprovalStatus("✓ Approved. Recording to decision ledger and scheduling board notification.");
  };

  const handleDefer = () => {
    setApprovalStatus("⊙ Deferred. Scheduled for Q4 re-evaluation with updated metrics.");
  };

  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", background: BG, padding: 20, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUT, marginBottom: 12 }}>
            Quantum PM — Franchise Approval Engine
          </div>
          <div style={{ fontSize: 12, color: MUT, lineHeight: 1.6 }}>
            Approval decisions via five pillars: boundary observables, information release curves, network topology, alignment heuristic, integration metrics. All reasoning auditable. No black boxes.
          </div>
        </div>

        {/* Franchisee Selector */}
        <div style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: MUT, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Select Franchisee
          </label>
          <select
            value={selectedFranchisee}
            onChange={(e) => {
              setSelectedFranchisee(e.target.value);
              setDecision(null);
            }}
            style={{ padding: "6px 8px", fontSize: 11, border: `1px solid ${RULE}`, borderRadius: 3, marginBottom: 10 }}>
            <option value="jane-doe-portland">Jane Doe — Portland OR</option>
            <option value="sample-ca">Sample — California</option>
          </select>
          <button
            onClick={handleMakeDecision}
            style={{
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 700,
              background: VIO,
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
            }}>
            Analyze & Generate Decision
          </button>
        </div>

        {/* Decision Output */}
        {decision && (
          <>
            {/* PILLAR 1: Boundary Observables */}
            <BoundaryObservableCard decision={decision} onApprove={handleApprove} onDefer={handleDefer} />

            {/* PILLAR 2: Information Release Curves */}
            <InformationReleaseCurves decision={decision} />

            {/* PILLAR 3: Network Topology */}
            <NetworkTopologyView decision={decision} />

            {/* PILLAR 4: Alignment Heuristic */}
            <AlignmentHeuristicView decision={decision} />

            {/* PILLAR 5: Integration Metrics */}
            <IntegrationMetricsView decision={decision} />

            {/* Status Message */}
            {approvalStatus && (
              <div
                style={{
                  padding: 12,
                  background: approvalStatus.includes("Approved") ? "#f3faf4" : "#f9f5e6",
                  border: `1px solid ${approvalStatus.includes("Approved") ? GRN : AMB}`,
                  borderRadius: 4,
                  color: approvalStatus.includes("Approved") ? "#1e5c2a" : "#6b5400",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                {approvalStatus}
              </div>
            )}
          </>
        )}

        {/* About */}
        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: "#f5f5f5",
            border: `1px solid ${RULE}`,
            borderRadius: 4,
            fontSize: 10,
            lineHeight: 1.6,
            color: MUT,
          }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Design: Five Pillars of Quantum PM</div>
          <ul style={{ margin: "0 0 0 16px", paddingLeft: 0 }}>
            <li style={{ marginBottom: 4 }}>
              <strong>Pillar 1:</strong> Holographic Boundary → Expose minimal observables (SR%, gates, capital, confidence); hide internals
            </li>
            <li style={{ marginBottom: 4 }}>
              <strong>Pillar 2:</strong> Information Release Curves → Show when each forecast signal becomes observable (setup → release → outcome → plateau)
            </li>
            <li style={{ marginBottom: 4 }}>
              <strong>Pillar 3:</strong> Network Topology & Curvature → Discrete graph with Laplacian-based bottleneck identification
            </li>
            <li style={{ marginBottom: 4 }}>
              <strong>Pillar 4:</strong> Light Angles & Alignment → Route decisions via angle-based heuristic (aligned &lt;30°, oblique 30-90°, opposite &gt;90°)
            </li>
            <li>
              <strong>Pillar 5:</strong> Consciousness & Integration (Φ) → Track network coherence score to balance stability with resilience
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default QuantumPMRefactored;
