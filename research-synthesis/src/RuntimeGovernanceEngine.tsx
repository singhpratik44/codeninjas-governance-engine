import React, { useState, useEffect, useMemo } from 'react';

const PAPERS = [
  {
    id: 1,
    title: "DynaSchedBench",
    arxiv: "2605.27566",
    date: "2026-05-01",
    problem: "LLM-based agents fail at dynamic scheduling due to 'Observability Paradox'—cannot extract actionable rules from high-dimensional structural data.",
    finding: "Fallback to symbolic heuristics for recurring patterns, LLM only for novel cases.",
    clearlineComponent: "Hybrid proposal generation (symbolic rules + LLM escalation)",
    priority: "HIGH",
  },
  {
    id: 2,
    title: "From Agent Loops to Structured Graphs",
    arxiv: "2604.11378",
    date: "2026-04-01",
    problem: "Traditional agent loops fail under recovery pressure—no explicit dependencies, immutable plans, or escalation protocols.",
    finding: "Structured DAG execution with explicit dependencies enables reliable multi-step workflows.",
    clearlineComponent: "Governance as DAG with checkpoint recovery (LangGraph integration)",
    priority: "MEDIUM",
  },
  {
    id: 3,
    title: "PlanBench-XL",
    arxiv: "2606.22388",
    date: "2026-06-01",
    problem: "Tool-use agents fail catastrophically (11.36% accuracy) when tools fail, block, or misdirect.",
    finding: "Real-world tool integration requires dynamic discovery, implicit sub-goal inference, and runtime adaptation.",
    clearlineComponent: "Tool health monitoring + fallback heuristics + escalation",
    priority: "HIGH",
  },
  {
    id: 4,
    title: "RACE-Sched",
    arxiv: "2605.29262",
    date: "2026-05-01",
    problem: "LLM latency (100s–1000s ms) incompatible with real-time control loops (ms scale).",
    finding: "Dual-stream architecture: reactive symbolic (fast) + deliberative LLM (slow).",
    clearlineComponent: "Fast stream (symbolic routing) + Slow stream (LLM rule synthesis)",
    priority: "LOW",
  },
  {
    id: 5,
    title: "Beyond Static Uncertainty (VolDy-VAE)",
    arxiv: "2603.24254",
    date: "2026-03-01",
    problem: "Real project timelines exhibit volatility clustering. Static uncertainty modeling misses crisis detection.",
    finding: "Regime-switching tau: stable→normal, crisis→faster decay, recovery→slower increase.",
    clearlineComponent: "Volatility regime detection + dynamic tau adjustment",
    priority: "MEDIUM",
  },
  {
    id: 6,
    title: "Tru-POMDP",
    arxiv: "2506.02860",
    date: "2025-06-01",
    problem: "Open-ended planning with unbounded object space, hidden states, ambiguous instructions.",
    finding: "Hierarchical belief generation (L1: domain, L2: drivers, L3: decisions) + particle beliefs.",
    clearlineComponent: "Hierarchical belief tree (Optimistic/Realistic/Pessimistic projections)",
    priority: "MEDIUM",
  },
  {
    id: 7,
    title: "On Time, Within Budget (MCPP)",
    arxiv: "2605.06110",
    date: "2026-05-01",
    problem: "Multi-model workflows face hard budget (cost) and time (deadline) constraints.",
    finding: "Monte Carlo Portfolio Planning dynamically allocates resources, replans after outcomes.",
    clearlineComponent: "Budget-aware scenario planning + Whittle index allocation",
    priority: "LOW",
  },
  {
    id: 8,
    title: "Bayesian-Monte Carlo Schedule Updating",
    arxiv: "2605.17608",
    date: "2026-05-01",
    problem: "Activity-duration uncertainty is non-Gaussian and time-varying. Static priors miss real dynamics.",
    finding: "Bayesian recursive updating + Monte Carlo uncertainty propagation through critical path.",
    clearlineComponent: "Online Bayesian belief updates over response times + lognormal modeling",
    priority: "HIGH",
  },
  {
    id: 9,
    title: "LangGraph (LangChain)",
    arxiv: "production",
    date: "2026-01-01",
    problem: "Stateful workflow orchestration without crash recovery loses state and audit trail.",
    finding: "Checkpointed workflows with explicit pause/resume and human-in-the-loop gates.",
    clearlineComponent: "Checkpoint-based governance gates + Chainlit UI for visualization",
    priority: "MEDIUM",
  },
  {
    id: 10,
    title: "Toward Super Agent System (Hybrid AI Routers)",
    arxiv: "2504.10519",
    date: "2025-04-01",
    problem: "Monolithic agents handle all tasks. Single failure mode. No intent-aware dispatch.",
    finding: "Intent-aware routing + hybrid execution (on-device fast + cloud deliberative).",
    clearlineComponent: "Intent classifier → specialized sub-agents + runtime dispatch",
    priority: "MEDIUM",
  },
];

const PROBLEMS = [
  {
    title: "Observability Paradox",
    description: "Agents cannot extract actionable rules from high-dimensional data.",
    papers: [1],
    clearlineAnswer: "Hybrid symbolic + LLM: rules handle 90% of recurring patterns, LLM escalates novel cases.",
  },
  {
    title: "Recovery & Fault Tolerance",
    description: "Agent loops fail under crashes. No checkpoint recovery.",
    papers: [2, 9],
    clearlineAnswer: "DAG-based execution with explicit checkpoints. Restart from last checkpoint, not from scratch.",
  },
  {
    title: "Tool Integration Under Uncertainty",
    description: "Tools fail silently, block, or misdirect. Agents have no fallback.",
    papers: [3],
    clearlineAnswer: "Tool health monitoring, dynamic discovery, fallback heuristics. Escalate after 2 failures.",
  },
  {
    title: "Latency & Real-Time Control",
    description: "LLM latency (100s ms) incompatible with real-time loops (ms scale).",
    papers: [4],
    clearlineAnswer: "Dual-stream: fast symbolic stream (daily), slow LLM stream (weekly). Both integrated.",
  },
  {
    title: "Uncertainty Evolution",
    description: "Static confidence models miss crisis regimes and volatility clustering.",
    papers: [5],
    clearlineAnswer: "Regime detection: stable/crisis/recovery. Dynamically adjust tau. Monitor signal degradation.",
  },
  {
    title: "Hidden States & Beliefs",
    description: "Unbounded state spaces, ambiguous instructions, multiple hidden causes.",
    papers: [6],
    clearlineAnswer: "Hierarchical beliefs: L1 (domain), L2 (drivers), L3 (decisions). Projections enforce coherence.",
  },
  {
    title: "Budget-Constrained Optimization",
    description: "Hard limits on time, cost, effort. Static allocation ignores realization dynamics.",
    papers: [7, 8],
    clearlineAnswer: "Whittle index scoring per opportunity. Monte Carlo replan as outcomes arrive. Bayesian belief updates.",
  },
  {
    title: "Intent Dispatch",
    description: "Monolithic agents bottle-neck. No specialized routing.",
    papers: [10],
    clearlineAnswer: "Intent classifier → specialized handlers. On-device fast path + cloud deliberation.",
  },
];

const DOMAINS = [
  {
    name: "Job Search",
    description: "Allocate ~15h/week across 5 buckets (contract, AI governance, federal, ops, differentiator) to maximize closing probability in 6 weeks.",
    components: [
      "Whittle index scoring per opportunity (priority queue)",
      "Bayesian belief over conversion prob + timeline",
      "Dual-stream: daily mechanical refresh + weekly LLM triage",
      "Volatility regime detection (crisis vs. calm)",
      "Policy gates: rate floor, Kaiser framing, staleness checks",
    ],
  },
  {
    name: "Product Launch",
    description: "Allocate eng effort across features under deadline + quality constraints. Navigate feature dependencies.",
    components: [
      "Whittle index over feature urgency (deadline vs. priority)",
      "DAG execution with checkpoint recovery (deploy halt on critical bug)",
      "Tool health: CI/CD monitoring, test infrastructure",
      "Dual-stream: fast CI flow + slow design review",
      "Volatility: track velocity/burndown; crisis mode → tighter reviews",
    ],
  },
  {
    name: "Hiring Pipeline",
    description: "Manage candidate pipeline under time pressure. Navigate culture fit, role fit, compensation.",
    components: [
      "Whittle index over candidate urgency (deadline vs. quality bar)",
      "Bayesian belief over candidate acceptance prob",
      "Policy gates: offer level, vesting, start date flexibility",
      "Dual-stream: fast screen + slow negotiation",
      "Regime detection: market hardening → crisis mode (broader sourcing)",
    ],
  },
  {
    name: "Franchise Operations",
    description: "Allocate ops support across 348 centers under health targets + capacity constraints.",
    components: [
      "Whittle index over center urgency (health + margin threat)",
      "Hierarchical beliefs: center health, market position, team readiness",
      "Checkpoint recovery: ops intervention mid-course correction",
      "Tool health: payroll, enrollment systems, reporting",
      "Volatility: detect cohort shifts; crisis → rapid response",
    ],
  },
  {
    name: "Business OKRs",
    description: "Allocate team capacity across strategic initiatives under quarterly deadline.",
    components: [
      "Whittle index over OKR urgency (deadline vs. strategic impact)",
      "Regime detection: market condition shift → replanning",
      "Policy gates: investment thresholds, market restrictions",
      "Dual-stream: fast execution + slow strategy review",
      "Checkpoint gates before major bets",
    ],
  },
];

export default function RuntimeGovernanceEngine({ initialTab }) {
  const [tab, setTab] = useState(initialTab || 'research');
  const [papers, setPapers] = useState(PAPERS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.location.hash = tab;
  }, [tab]);

  // Simulate fetching paper metadata from arXiv (in production, use live API)
  useEffect(() => {
    const enrichPapers = async () => {
      setLoading(true);
      // In production: fetch from arXiv API, OpenReview, etc.
      // For now, use hardcoded data
      await new Promise(r => setTimeout(r, 300));
      setLoading(false);
    };
    enrichPapers();
  }, []);

  const stats = useMemo(() => {
    const highPriority = papers.filter(p => p.priority === 'HIGH').length;
    const problems = PROBLEMS.length;
    const domains = DOMAINS.length;
    return { highPriority, problems, domains };
  }, [papers]);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e8e8e2',
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Clearline
          </h1>
          <p style={{ fontSize: 14, color: '#8a8a86', marginBottom: 16 }}>
            Runtime Governance for Autonomous Work. Synthesizing 10 cutting-edge research papers (Apr–Jul 2026) into a coherent policy enforcement framework.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2c2c2a' }}>{papers.length}</div>
              <div style={{ color: '#8a8a86' }}>Research Papers</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2c2c2a' }}>{stats.highPriority}</div>
              <div style={{ color: '#8a8a86' }}>High Priority</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2c2c2a' }}>{stats.domains}</div>
              <div style={{ color: '#8a8a86' }}>Domains</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e8e8e2',
        padding: '0 32px',
        display: 'flex',
        gap: 32,
      }}>
        <div style={{ maxWidth: 1400, width: '100%', display: 'flex', gap: 32 }}>
          {[
            { id: 'research', label: 'Research Landscape' },
            { id: 'problems', label: 'Modern AI Problems' },
            { id: 'solutions', label: 'Clearline Solutions' },
            { id: 'architecture', label: 'Multi-Domain Architecture' },
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
                color: tab === t.id ? '#2c2c2a' : '#8a8a86',
                borderBottom: tab === t.id ? '2px solid #2c2c2a' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#8a8a86' }}>Loading...</div>}

        {tab === 'research' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>10 Research Papers (Apr–Jul 2026)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {papers.map(p => (
                <div key={p.id} style={{
                  background: '#fff',
                  border: '1px solid #e8e8e2',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.title}</h3>
                    <span style={{
                      fontSize: 10,
                      background: p.priority === 'HIGH' ? '#fee2e2' : '#fef3c7',
                      color: p.priority === 'HIGH' ? '#991b1b' : '#92400e',
                      padding: '4px 8px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      marginLeft: 8,
                    }}>
                      {p.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#8a8a86', marginBottom: 12, lineHeight: 1.5 }}>
                    {p.problem}
                  </p>
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #e8e8e2', fontSize: 11, color: '#8a8a86' }}>
                    {p.arxiv !== 'production' && <div>arXiv:{p.arxiv}</div>}
                    <div>{new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'problems' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Modern AI Governance Problems</h2>
            <div style={{ display: 'grid', gap: 24 }}>
              {PROBLEMS.map((prob, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: '1px solid #e8e8e2',
                  borderRadius: 10,
                  padding: 24,
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{prob.title}</h3>
                  <p style={{ fontSize: 14, color: '#8a8a86', marginBottom: 16, lineHeight: 1.6 }}>
                    {prob.description}
                  </p>
                  <div style={{
                    background: '#f5f5f3',
                    padding: 16,
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: '#2c2c2a' }}>Clearline's Answer:</strong>
                    <div style={{ marginTop: 8, color: '#2c2c2a' }}>{prob.clearlineAnswer}</div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#8a8a86' }}>
                    Addressed by papers: {prob.papers.map(id => PAPERS.find(p => p.id === id)?.title).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'solutions' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Clearline's Integrated Solution</h2>
            <div style={{
              background: '#fff',
              border: '1px solid #e8e8e2',
              borderRadius: 10,
              padding: 24,
              marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Core Components</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>1. Runtime Policy Enforcement</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Evaluates every action against policy gates in real time. Blocks, routes, or logs with audit trail.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>2. Multiverse/Projection Model</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Organization as single unified state, projected as many universes (Opt/Real/Pess). Governance enforces coherence.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>3. Hierarchical Belief Generation</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>L1 (domain), L2 (drivers), L3 (decisions). Bayesian updates as outcomes arrive.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>4. Whittle Index Allocation</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Optimal resource allocation under uncertainty + deadline. Urgency scoring per opportunity.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>5. Volatility Regime Switching</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Detect crisis/calm/recovery. Dynamically adjust confidence decay tau and scenario deltas.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>6. Dual-Stream Execution</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Fast symbolic stream (daily, ms scale) + slow LLM stream (weekly, s scale).</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>7. Checkpoint Recovery</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>DAG execution with LangGraph checkpoints. Crash recovery from last checkpoint.</div>
                </div>
                <div style={{
                  background: '#f5f5f3',
                  padding: 16,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 8, textTransform: 'uppercase' }}>8. Tool Health Monitoring</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Dynamic fallback + escalation. Detect tool failures, adapt sub-goal inference.</div>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Paper-to-Component Mapping</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {PAPERS.map(p => (
                <div key={p.id} style={{
                  background: '#fff',
                  border: '1px solid #e8e8e2',
                  borderRadius: 6,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: '200px 1fr 300px',
                  gap: 16,
                  fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ color: '#8a8a86' }}>{p.finding}</div>
                  <div style={{ color: '#2c2c2a', fontWeight: 500 }}>{p.clearlineComponent}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'architecture' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Multi-Domain Architecture</h2>
            <p style={{ fontSize: 14, color: '#8a8a86', marginBottom: 32, lineHeight: 1.6 }}>
              Same governance model, different domains. Parameters shift; algorithm stays constant.
            </p>
            <div style={{ display: 'grid', gap: 24 }}>
              {DOMAINS.map((domain, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: '1px solid #e8e8e2',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: 20,
                    borderBottom: '1px solid #e8e8e2',
                  }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{domain.name}</h3>
                    <p style={{ fontSize: 13, color: '#8a8a86', lineHeight: 1.6 }}>
                      {domain.description}
                    </p>
                  </div>
                  <div style={{ padding: 20, background: '#fafaf8' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a86', marginBottom: 12, textTransform: 'uppercase' }}>Components</div>
                    <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
                      {domain.components.map((comp, j) => (
                        <li key={j} style={{
                          fontSize: 13,
                          paddingLeft: 20,
                          position: 'relative',
                        }}>
                          <span style={{ position: 'absolute', left: 0 }}>•</span>
                          {comp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        background: '#fff',
        borderTop: '1px solid #e8e8e2',
        padding: '24px 32px',
        marginTop: 64,
        fontSize: 12,
        color: '#8a8a86',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div>
            <strong style={{ color: '#2c2c2a' }}>Clearline: Runtime Governance for Autonomous Work</strong>
          </div>
          <div style={{ marginTop: 8 }}>
            Synthesizes 10 cutting-edge papers (Apr–Jul 2026) into a coherent policy enforcement framework for autonomous agents.
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8e8e2' }}>
            Build SHA: <code style={{ background: '#f5f5f3', padding: '2px 6px', borderRadius: 3 }}>{window.__BUILD_SHA__}</code>
          </div>
        </div>
      </footer>
    </div>
  );
}
