# Verification Ledger

Confidence decays the longer a module goes unverified — same idea as the app's own `qCoherence(days)`. Update the relevant row (add one if new) in the same commit as any change to that module/symbol. "Tier reached" is the highest of syntax(1)/logic(2)/render(3) actually run for that change — see `scripts/verify-gate.mjs`.

| Path / symbol | Last verified commit | Date | Tier reached | Notes |
|---|---|---|---|---|
| `src/Engine.tsx` — `team` tab override (`computeCentersForPosture`, `teamOv`) | d58c523 | 2026-07-15 | 3 (render) | jsdom mount proved radar-chart polygon differs baseline vs. pessimistic override |
| `docs/engine/QUANTUM_METHODOLOGY.md` | 631ddf4 | 2026-07-15 | n/a (docs) | — |
| `docs/engine/entanglement-registry.md` | (pending commit) | 2026-07-15 | n/a (docs) | seeded from Explore-agent structural map, spot-checked against source line numbers |
