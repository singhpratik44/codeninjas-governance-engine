// ============================================================================
// GOVERNANCE INTEGRATION LAYER
// Bridges Code Ninjas franchise operations with QIH-AEE governance engine
//
// Five Pillars (Design Principles):
// 1. Holographic Principle → Boundary Observables: expose SR%, gates, capital, confidence
// 2. Black-Hole Thermodynamics → Light Clocks: information release curves (setup→horizon→ringdown)
// 3. Quantum Geometry → Network Topology: discrete nodes/edges, Laplacian curvature bottlenecks
// 4. Light Angles → Alignment Heuristic: angle-based routing (aligned < 30°, oblique 30-90°, opposite > 90°)
// 5. Consciousness & IIT → Integration Metrics (Φ): mutual information between governors
// ============================================================================

export interface FranchiseeProfile {
  id: string;
  name: string;
  territory: string;
  state: string;
  creditScore: number;
  experience: "edtech" | "franchise" | "both" | "none";
  capitalAvailable: number;
  contractStatus: "prospect" | "qualified" | "pending_approval" | "approved" | "live";
}

export interface TerritoryHealth {
  stateCode: string;
  centerCount: number;
  avgConversionRate: number; // trial-to-paid
  avgRetention: number;
  avgEBITDAMargin: number;
  peerNetworkSize: number;
  funnelBottleneck: boolean; // high curvature = capacity constraint
}

export interface ApprovalGate {
  name: string;
  threshold: number;
  currentValue: number;
  pass: boolean;
  reason: string;
}

// ============================================================================
// PILLAR 1: HOLOGRAPHIC BOUNDARY — Approval observables
// Hide: detailed financials, scenario deltas, historical precedents
// Expose: SR%, gates, capital unlock, confidence
// ============================================================================

export interface BoundaryObservable {
  successRate: number; // probability of franchisee reaching profitability
  capitalUnlock: number; // franchise fee + build-out commitment
  gates: ApprovalGate[];
  confidence: number; // 0-1, based on historical precedent count
  recommendation: "approve" | "conditional" | "defer";
  estimatedMonthsToEBITDAPositive: number;
}

// ============================================================================
// PILLAR 2: BLACK-HOLE THERMODYNAMICS — Information release curves
// When does each forecast signal become observable?
// ============================================================================

export interface InformationReleaseWindow {
  phase: "setup" | "release" | "outcome" | "plateau";
  weekStart: number;
  weekEnd: number;
  observableSignals: string[]; // what metrics become visible in this window
  decisionWindow: boolean; // can we make decisions based on this signal?
}

export interface ForecastCurve {
  franchiseeId: string;
  optimistic: number[]; // unit count by week (24 weeks)
  realistic: number[];
  pessimistic: number[];
  informationReleaseWindows: InformationReleaseWindow[];
}

// ============================================================================
// PILLAR 3: QUANTUM GEOMETRY — Network topology & curvature
// Discrete graph with typed nodes/edges
// Laplacian curvature identifies bottlenecks
// ============================================================================

export interface NetworkNode {
  id: string; // center ID or franchisee ID
  type: "center" | "franchisee" | "cluster" | "region";
  state: string;
  degree: number; // number of edges
  laplacianCurvature: number; // high = bottleneck, low = distributed
}

export interface NetworkEdge {
  from: string;
  to: string;
  type: "peer_review" | "territory_adjacency" | "funnel_sharing" | "support";
  strength: number; // 0-1, weight of connection
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clusters: Cluster[];
  bottlenecks: NetworkNode[]; // high curvature nodes
  isolatedNodes: NetworkNode[];
}

export interface Cluster {
  id: string;
  members: string[];
  laplacianCurvature: number;
  riskLevel: "stable" | "medium" | "high";
  recommendation: string;
}

// ============================================================================
// PILLAR 4: LIGHT ANGLES — Alignment heuristic
// Compute angle between proposal vector and network constraint vector
// ============================================================================

export type AlignmentTier = "aligned" | "oblique" | "opposite";

export interface AlignmentAnalysis {
  franchiseeId: string;
  alignmentAngle: number; // 0-180 degrees
  tier: AlignmentTier; // < 30° = aligned, 30-90° = oblique, > 90° = opposite
  reasoning: string;
  supportRequired: "minimal" | "standard" | "intensive" | "defer";
  expectedROI: number; // months to profitability
}

// ============================================================================
// PILLAR 5: CONSCIOUSNESS & IIT — Integration metrics
// Φ proxy: mutual information between governor modules
// ============================================================================

export interface IntegrationMetrics {
  phi: number; // 0-1, network coherence score
  phiHistory: Array<{ week: number; phi: number }>;
  clusterPhis: Record<string, number>; // per-cluster coherence
  trend: "increasing" | "stable" | "decreasing";
  interpretation: string; // "high coherence = stable/fragile", "low = unpredictable/resilient"
  riskAssessment: "balanced" | "overtightened" | "fragmented";
}

// ============================================================================
// APPROVAL DECISION — integrates all five pillars
// ============================================================================

export interface ApprovalDecision {
  franchiseeId: string;
  timestamp: number;
  boundaryObservable: BoundaryObservable;
  alignmentAnalysis: AlignmentAnalysis;
  forecastCurve: ForecastCurve;
  networkTopology: NetworkTopology;
  integrationMetrics: IntegrationMetrics;
  decision: "approve" | "conditional" | "defer";
  confidence: number;
  auditTrail: string; // why and when the decision was made
}

// ============================================================================
// GOVERNANCE SERVICE — Computes all five pillars
// ============================================================================

export class FranchiseGovernanceService {
  private franchisees: Map<string, FranchiseeProfile> = new Map();
  private territories: Map<string, TerritoryHealth> = new Map();
  private network: NetworkTopology | null = null;
  private integrationMetrics: IntegrationMetrics | null = null;

  // Register a franchisee profile
  registerFranchisee(profile: FranchiseeProfile): void {
    this.franchisees.set(profile.id, profile);
  }

  // Register territory health metrics
  registerTerritoryHealth(health: TerritoryHealth): void {
    this.territories.set(health.stateCode, health);
  }

  // PILLAR 1: Compute boundary observables
  computeBoundaryObservable(franchiseeId: string): BoundaryObservable {
    const franchisee = this.franchisees.get(franchiseeId);
    if (!franchisee) throw new Error(`Franchisee ${franchiseeId} not found`);

    const territory = this.territories.get(franchisee.state);
    if (!territory) throw new Error(`Territory ${franchisee.state} not found`);

    // Success Rate = f(credit, experience, territory health, peer support)
    const creditBoost = Math.min(1, franchisee.creditScore / 750);
    const expBoost = franchisee.experience === "both" ? 1 : franchisee.experience === "edtech" || franchisee.experience === "franchise" ? 0.8 : 0.5;
    const territoryBoost = territory.centerCount > 5 ? 1 : territory.centerCount > 2 ? 0.8 : 0.6;
    const peerBoost = territory.peerNetworkSize > 10 ? 1 : territory.peerNetworkSize > 5 ? 0.8 : 0.6;
    const successRate = (0.65 * creditBoost + 0.15 * expBoost + 0.10 * territoryBoost + 0.10 * peerBoost);

    // Capital Unlock = franchise fee + estimated build-out
    const capitalUnlock = 50000 + 200000; // franchise fee + build-out estimate

    // Approval Gates (must pass all 4)
    const gates: ApprovalGate[] = [
      {
        name: "Franchisee Fit",
        threshold: 700,
        currentValue: franchisee.creditScore,
        pass: franchisee.creditScore >= 700 && franchisee.experience !== "none",
        reason: franchisee.creditScore >= 700 ? "Credit and experience meet threshold" : "Credit or experience insufficient",
      },
      {
        name: "Territory Health",
        threshold: 0.75,
        currentValue: territory.avgRetention,
        pass: territory.centerCount >= 3 && territory.avgRetention >= 0.75,
        reason: territory.centerCount >= 3 ? "Territory has peer network and healthy retention" : "Territory underdeveloped",
      },
      {
        name: "Conversion Funnel",
        threshold: 0.08,
        currentValue: territory.avgConversionRate,
        pass: territory.avgConversionRate >= 0.08 || territory.funnelBottleneck === false,
        reason: territory.avgConversionRate >= 0.08 ? "Conversion rate healthy" : "Watch: seasonal or structural issue",
      },
      {
        name: "Board Approval",
        threshold: 1,
        currentValue: 1,
        pass: true,
        reason: "Q3 allocation available",
      },
    ];

    const gatesPassed = gates.filter(g => g.pass).length;
    const recommendation = gatesPassed === 4 ? "approve" : gatesPassed >= 3 ? "conditional" : "defer";

    // Confidence based on historical precedent count (simulated: 40+ prior approvals in same posture)
    const confidence = Math.min(0.95, 0.70 + 0.05 * Math.min(4, gatesPassed));

    return {
      successRate,
      capitalUnlock,
      gates,
      confidence,
      recommendation,
      estimatedMonthsToEBITDAPositive: successRate > 0.75 ? 15 : 20,
    };
  }

  // PILLAR 2: Information release curves
  computeForecastCurve(franchiseeId: string): ForecastCurve {
    const franchisee = this.franchisees.get(franchiseeId);
    if (!franchisee) throw new Error(`Franchisee ${franchiseeId} not found`);

    const weeks = 24;
    const optimistic: number[] = [];
    const realistic: number[] = [];
    const pessimistic: number[] = [];

    for (let w = 0; w < weeks; w++) {
      // Ramp-up curves (S-curves)
      const progress = w / 12;
      const sigmoid = 1 / (1 + Math.exp(-5 * (progress - 0.5)));

      optimistic.push(Math.round(50 * sigmoid));
      realistic.push(Math.round(30 * sigmoid));
      pessimistic.push(Math.round(15 * sigmoid));
    }

    return {
      franchiseeId,
      optimistic,
      realistic,
      pessimistic,
      informationReleaseWindows: [
        {
          phase: "setup",
          weekStart: 0,
          weekEnd: 4,
          observableSignals: ["baseline franchisee pipeline", "network state"],
          decisionWindow: false,
        },
        {
          phase: "release",
          weekStart: 4,
          weekEnd: 8,
          observableSignals: ["first cohort unit count", "are they ramping on schedule?"],
          decisionWindow: true,
        },
        {
          phase: "outcome",
          weekStart: 8,
          weekEnd: 12,
          observableSignals: ["unit health profitability trend", "franchisee sustainability"],
          decisionWindow: true,
        },
        {
          phase: "plateau",
          weekStart: 12,
          weekEnd: 24,
          observableSignals: ["network support load", "capital payback trajectory"],
          decisionWindow: true,
        },
      ],
    };
  }

  // PILLAR 3: Network topology
  computeNetworkTopology(franchiseeId: string): NetworkTopology {
    const franchisee = this.franchisees.get(franchiseeId);
    if (!franchisee) throw new Error(`Franchisee ${franchiseeId} not found`);

    const territory = this.territories.get(franchisee.state);
    if (!territory) throw new Error(`Territory ${franchisee.state} not found`);

    // Simplified: create nodes for existing centers + new franchisee
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];

    // Existing centers in territory
    for (let i = 0; i < territory.centerCount; i++) {
      const nodeId = `center_${franchisee.state}_${i}`;
      nodes.push({
        id: nodeId,
        type: "center",
        state: franchisee.state,
        degree: territory.peerNetworkSize,
        laplacianCurvature: territory.funnelBottleneck ? 0.8 : 0.3,
      });
    }

    // New franchisee node
    nodes.push({
      id: franchiseeId,
      type: "franchisee",
      state: franchisee.state,
      degree: territory.peerNetworkSize,
      laplacianCurvature: 0.0, // new node
    });

    // Create peer-review and territory adjacency edges
    for (let i = 0; i < Math.min(3, territory.centerCount); i++) {
      edges.push({
        from: `center_${franchisee.state}_${i}`,
        to: franchiseeId,
        type: "peer_review",
        strength: 0.8,
      });
    }

    // Compute cluster
    const cluster: Cluster = {
      id: `cluster_${franchisee.state}`,
      members: [...nodes.map(n => n.id)],
      laplacianCurvature: territory.funnelBottleneck ? 0.7 : 0.5,
      riskLevel: territory.funnelBottleneck ? "high" : "medium",
      recommendation: territory.funnelBottleneck ? "Add ops staff to unblock funnel" : "Stable, safe to approve",
    };

    return {
      nodes,
      edges,
      clusters: [cluster],
      bottlenecks: territory.funnelBottleneck ? nodes.filter(n => n.laplacianCurvature > 0.5) : [],
      isolatedNodes: nodes.filter(n => n.degree === 0),
    };
  }

  // PILLAR 4: Alignment heuristic
  computeAlignmentAnalysis(franchiseeId: string): AlignmentAnalysis {
    const franchisee = this.franchisees.get(franchiseeId);
    if (!franchisee) throw new Error(`Franchisee ${franchiseeId} not found`);

    const territory = this.territories.get(franchisee.state);
    if (!territory) throw new Error(`Territory ${franchisee.state} not found`);

    // Compute alignment angle: how much does approving this franchisee align with network health goals?
    // Aligned: existing territory with strong funnel, high capacity franchisee, peer support available
    // Oblique: new territory, weak funnel, requires ops support
    // Opposite: saturated territory, weak franchisee, peer support stretched

    let angle = 0;
    let reasoning = "";

    if (franchisee.capitalAvailable >= 300000 && territory.avgRetention >= 0.80 && territory.funnelBottleneck === false) {
      angle = 20;
      reasoning = "Strong franchisee in healthy territory with available peer support";
    } else if (franchisee.capitalAvailable >= 250000 && territory.avgRetention >= 0.70) {
      angle = 60;
      reasoning = "Adequate franchisee in developing territory, requires ops coordination";
    } else {
      angle = 120;
      reasoning = "Weak franchisee or saturated territory, defer for 6-12 months";
    }

    const tier: AlignmentTier = angle < 30 ? "aligned" : angle < 90 ? "oblique" : "opposite";
    const supportRequired = tier === "aligned" ? "minimal" : tier === "oblique" ? "standard" : "defer";

    return {
      franchiseeId,
      alignmentAngle: angle,
      tier,
      reasoning,
      supportRequired: supportRequired as "minimal" | "standard" | "intensive" | "defer",
      expectedROI: angle < 30 ? 15 : angle < 90 ? 22 : 0,
    };
  }

  // PILLAR 5: Integration metrics (Φ proxy)
  computeIntegrationMetrics(): IntegrationMetrics {
    // Φ = mutual information between franchisee clusters
    // High Φ (>0.75) = stable but fragile (cascading risk)
    // Medium Φ (0.55-0.75) = balanced
    // Low Φ (<0.55) = unpredictable but resilient
    // Target: Φ = 0.65 (balance stability with resilience)

    const phi = 0.61; // Current state from brief
    const phiHistory = [
      { week: 0, phi: 0.55 },
      { week: 12, phi: 0.61 },
      { week: 24, phi: 0.61 },
    ];

    const clusterPhis: Record<string, number> = {};
    this.territories.forEach((t) => {
      clusterPhis[t.stateCode] = t.centerCount > 10 ? 0.72 : t.centerCount > 5 ? 0.60 : 0.48;
    });

    const trend = phi > 0.60 ? "increasing" : phi > 0.55 ? "stable" : "decreasing";
    const interpretation = phi > 0.75 ? "high coherence—tight coupling via funnel" : phi > 0.55 ? "medium coherence—some clusters decouple" : "low coherence—scattered network";
    const riskAssessment = phi > 0.75 ? "overtightened" : phi > 0.55 ? "balanced" : "fragmented";

    return {
      phi,
      phiHistory,
      clusterPhis,
      trend,
      interpretation,
      riskAssessment,
    };
  }

  // INTEGRATED APPROVAL DECISION
  makeApprovalDecision(franchiseeId: string): ApprovalDecision {
    const boundaryObservable = this.computeBoundaryObservable(franchiseeId);
    const alignmentAnalysis = this.computeAlignmentAnalysis(franchiseeId);
    const forecastCurve = this.computeForecastCurve(franchiseeId);
    const networkTopology = this.computeNetworkTopology(franchiseeId);
    const integrationMetrics = this.computeIntegrationMetrics();

    // Decision logic: integrate all five pillars
    let decision: "approve" | "conditional" | "defer" = boundaryObservable.recommendation;
    let confidence = boundaryObservable.confidence;

    // Adjust based on alignment tier
    if (alignmentAnalysis.tier === "aligned") {
      // reinforces approval
      decision = "approve";
      confidence = Math.min(0.95, confidence + 0.10);
    } else if (alignmentAnalysis.tier === "oblique") {
      // suggests conditional
      decision = decision === "approve" ? "conditional" : decision;
      confidence = Math.max(0.50, confidence - 0.05);
    } else if (alignmentAnalysis.tier === "opposite") {
      // suggests deferral
      decision = "defer";
      confidence = Math.max(0.30, confidence - 0.15);
    }

    // Adjust based on network coherence
    if (integrationMetrics.phi > 0.70 && decision === "approve") {
      // network is tight; be conservative
      decision = "conditional";
      confidence = Math.max(0.50, confidence - 0.10);
    }

    const auditTrail = `Decision: ${decision} (confidence ${confidence.toFixed(2)}) based on five pillars:
1. Boundary Observable: ${boundaryObservable.recommendation} (SR ${(boundaryObservable.successRate * 100).toFixed(1)}%, ${boundaryObservable.gates.filter(g => g.pass).length}/4 gates)
2. Forecast: ${forecastCurve.informationReleaseWindows[1].weekEnd}-${forecastCurve.informationReleaseWindows[2].weekEnd} weeks to outcome signal
3. Network: ${networkTopology.clusters.length} cluster(s), ${networkTopology.bottlenecks.length} bottleneck(s)
4. Alignment: ${alignmentAnalysis.tier} (${alignmentAnalysis.alignmentAngle}°)
5. Integration: Φ ${integrationMetrics.phi.toFixed(2)} (${integrationMetrics.riskAssessment})`;

    return {
      franchiseeId,
      timestamp: Date.now(),
      boundaryObservable,
      alignmentAnalysis,
      forecastCurve,
      networkTopology,
      integrationMetrics,
      decision,
      confidence,
      auditTrail,
    };
  }
}

export default FranchiseGovernanceService;
