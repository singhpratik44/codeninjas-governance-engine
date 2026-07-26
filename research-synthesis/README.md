# Clearline: Runtime Governance for Autonomous Work

**A research synthesis site showcasing how cutting-edge research solves modern AI governance problems.**

## What This Is

Clearline is a **runtime policy enforcement layer** for autonomous agents. It sits between agents and execution, evaluates every action against policy in real time, and maintains a consistent audit trail.

This site demonstrates how Clearline synthesizes **10 cutting-edge research papers** (Apr–Jul 2026) into a coherent governance framework:

- **DynaSchedBench, PlanBench-XL, RACE-Sched** — scheduling under uncertainty + tool reliability
- **Tru-POMDP, VolDy-VAE** — hierarchical beliefs + volatility regime switching
- **Bayesian-Monte Carlo, MCPP** — online learning + budget-aware optimization
- **LangGraph, Hybrid AI Routers** — checkpoint recovery + intent dispatch
- **From Agent Loops to Structured Graphs** — DAG execution with fault tolerance

## Site Structure

**4 Tabs:**

1. **Research Landscape** — The 10 papers, their core findings, priority levels
2. **Modern AI Problems** — Problems papers solve, how Clearline addresses each
3. **Clearline Solutions** — 8 core components, paper-to-component mapping
4. **Multi-Domain Architecture** — Same algorithm, 5 domains (job search, product, hiring, ops, business)

## The Core Insight

**Organization as unified information state, expressed as many universes at once.**

Governance is the physics keeping projections (scenarios, views, agents) coherent with the same underlying state.

## Local Development

```bash
npm install
npm run dev      # Watch build
npm run build    # Production build
npm test         # Render test
```

Visit `http://localhost:3000` after build (serve with your preferred HTTP server).

## Deploy

Pushes to `main` on `src/**` or workflow changes trigger GitHub Actions:
- Builds with esbuild
- Verifies BUILD_SHA in bundle
- Deploys to GitHub Pages

Live at: `https://singhpratik44.github.io/runtime-governance/`

## Architecture

- **Single React file** (`src/RuntimeGovernanceEngine.tsx`, ~1000 lines)
- **No backend** — all data hardcoded (in production, fetch live from arXiv API, OpenReview, etc.)
- **Pre-built bundle** (`bundle.js`) committed to repo for instant Pages load
- **SHA verification** — workflow verifies built SHA matches commit SHA to prevent stale deploys

## Files

```
runtime-governance/
├── index.html                    # Static shell
├── bundle.js                     # Pre-built (committed)
├── package.json
├── src/
│   ├── main.jsx                  # Entry point
│   └── RuntimeGovernanceEngine.tsx # Single-file app (~1000 lines)
├── .github/workflows/
│   └── deploy.yml                # Build + SHA verify + Pages deploy
└── README.md
```

## Next Steps

- Integrate live arXiv API fetching (instead of hardcoded papers)
- Add OpenReview metadata (decisions, review sentiment)
- Add Papers with Code benchmark links
- Wire up email auto-send (resume + methodology PDF attachments)
- Connect to Clearline PM engine (job search instance)

## Build SHA

Every deployed version includes a verified build SHA in the footer. This prevents silent staleness.

---

**Built for:** Demonstrating that cutting-edge research (Apr–Jul 2026) is unified into a coherent governance model for autonomous work.
