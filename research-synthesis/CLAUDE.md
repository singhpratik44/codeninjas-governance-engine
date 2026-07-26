# CLAUDE.md

Context for Claude Code sessions on this repo.

## What This Is

**Clearline** — a research synthesis website showcasing how 10 cutting-edge papers (Apr–Jul 2026) solve modern AI governance problems through a unified **runtime policy enforcement** framework.

**Not a job-search demo.** Job search is ONE application. The site explains the general methodology.

## The Framing

**Lead:** "Runtime policy enforcement layer for autonomous work — evaluates every action against policy in real time, blocks/routes/logs with audit trail."

**Elevate:** "Treat organization as single unified information state expressed as many universes (scenarios/projections/agents). Governance is the physics keeping them coherent."

## Site Structure

Single React file (`src/RuntimeGovernanceEngine.tsx`, ~1000 lines) with 4 tabs:

1. **Research Landscape** — 10 papers, findings, priority
2. **Modern AI Problems** — Problems papers solve + Clearline answers
3. **Clearline Solutions** — 8 core components, paper mappings
4. **Multi-Domain Architecture** — Same algorithm across job search, product, hiring, ops, business

## Architecture Decisions

- **Single React file** (CodeNinjas pattern) — all logic in one component
- **No backend** — data hardcoded (upgrade: live arXiv/OpenReview API)
- **Pre-built bundle** (`bundle.js`) committed — instant Pages load without rebuild
- **SHA verification** (`.github/workflows/deploy.yml`) — prevents stale deploys

## The 10 Papers

| # | Title | arXiv | Date | Priority |
|---|-------|-------|------|----------|
| 1 | DynaSchedBench | 2605.27566 | May 2026 | HIGH |
| 2 | From Agent Loops to Structured Graphs | 2604.11378 | Apr 2026 | MEDIUM |
| 3 | PlanBench-XL | 2606.22388 | Jun 2026 | HIGH |
| 4 | RACE-Sched | 2605.29262 | May 2026 | LOW |
| 5 | VolDy-VAE | 2603.24254 | Mar 2026 | MEDIUM |
| 6 | Tru-POMDP | 2506.02860 | Jun 2025 | MEDIUM |
| 7 | MCPP | 2605.06110 | May 2026 | LOW |
| 8 | Bayesian-Monte Carlo | 2605.17608 | May 2026 | HIGH |
| 9 | LangGraph | (production) | Jan 2026 | MEDIUM |
| 10 | Hybrid AI Routers | 2504.10519 | Apr 2025 | MEDIUM |

Mapped to components:

- **Runtime Policy Enforcement** (core)
- **Multiverse/Projection Model** (ontology)
- **Hierarchical Belief Generation** (Tru-POMDP)
- **Whittle Index Allocation** (MCPP)
- **Volatility Regime Switching** (VolDy-VAE)
- **Dual-Stream Execution** (RACE-Sched)
- **Checkpoint Recovery** (LangGraph)
- **Tool Health Monitoring** (PlanBench-XL)

## Future Enhancements

- [ ] Live arXiv API integration (fetch paper metadata, links, PDFs)
- [ ] OpenReview metadata (submission status, reviews, acceptance decisions)
- [ ] Papers with Code links + benchmark comparison
- [ ] LangChain Blog posts (RSS feed integration)
- [ ] Auto-send infrastructure (GitHub Actions workflow sends resume + methodology PDF)
- [ ] Clearline PM engine integration (live job search instance running under governance)
- [ ] Dark mode (already supported via CSS media query)

## Branch & Commit Pattern

Work on `main` directly (this is a research site, not core infrastructure).

Always:
1. `npm run build` locally before pushing (generates bundle.js)
2. Commit bundle.js + source together
3. Workflow will verify SHA matches on push

Example:
```bash
npm run build
git add -A
git commit -m "docs: explain runtime governance model"
git push origin main
```

Workflow runs, verifies SHA, deploys to Pages.

## Known Gaps

- Papers hardcoded (upgrade: arXiv API)
- No live OpenReview/NeurIPS metadata
- No Papers with Code integration
- No newsletter archive scraping (MLPapersWeekly)
- No email attachment capability yet

## Repo Access

Public — live at `https://singhpratik44.github.io/runtime-governance/`

---

**Build SHA verification is load-bearing.** Don't remove it even though it looks like overhead — it's caught stale deploys before.
