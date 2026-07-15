# Quantum Development Methodology

This is not the in-app "Quantum PM" governance feature (that's product content — see `CLAUDE.md`, untouched by this doc). This is how *this repository itself* gets built and maintained: four quantum-computing concepts mapped to concrete, enforced engineering practice, specifically for a single 6,500+ line file with no committed test framework and a strict, self-verifying deploy pipeline.

## 1. Superposition — explore before you commit

Before touching any symbol listed in `entanglement-registry.md`, or before converting an inline tab into a standalone component, write a short candidate note: 2-4 bullet alternatives considered, which one was chosen, and why. Drop it in `docs/engine/decisions/<slug>.md`. This isn't a heavyweight ADR process — it's a forced pause to consider more than one approach before writing code, so the first idea that compiles isn't automatically the one that ships.

Concrete standing rule for this codebase: when a governed tab needs a scenario override, the candidate is always **"receive the already-computed override view as a prop / value, don't recompute it locally"** — weighed explicitly against "compute it inline" and rejected, because `computeCentersForPosture` was hand-duplicated three times before being consolidated (see `CLAUDE.md`, "Known bugs already fixed here"). Don't re-litigate that choice per-tab; the registry exists so nobody has to rediscover it.

## 2. Entanglement — shared state and shared functions are load-bearing everywhere at once

`entanglement-registry.md` lists every function/state value read by more than one tab or call site in `src/Engine.tsx`. The rule: **touching the definition of a listed symbol requires re-verifying every listed call site**, not just the one you meant to change. This is the exact bug class `CLAUDE.md` documents twice (the triplicated `computeCentersForPosture`, the Risk Register's `owner`/`status` matching on the wrong field) — both were a change at one entangled point that silently broke a different, unverified one.

When you move or edit an entangled symbol, update its "last verified" entry in `verification-ledger.md` in the same commit.

## 3. Measurement / collapse — nothing is done until it's been measured

A change is not real until it passes all three verification tiers (`scripts/verify-gate.mjs`, run via `npm run verify`):

1. **Syntax** — `esbuild` bundles it without error.
2. **Logic** — a Node script exercises the underlying pure functions directly (via the `_layer1`/`_layer2` test-support exports) and asserts real invariants, not just "didn't throw."
3. **Render** — a jsdom + `react-dom/client` mount of the actual component proves the rendered output does what's claimed — not just that it doesn't crash.

Passing all three *is* the collapse: the superposition of "did this work or not" resolves to a definite state, and only then does a real `git commit` happen. A slice that fails tier 2 or 3 does not get committed "to fix later" — fix it first, or don't move that slice yet.

## 4. Decoherence — untouched code's confidence decays

The app's own `qCoherence(days) = max(0.12, exp(-days/42))` models how confidence in a measurement decays the longer a center goes unmeasured. Apply the same idea to the codebase: `verification-ledger.md` tracks when each module/symbol was last actually verified. Code that hasn't been touched or re-verified in a while isn't assumed correct just because it once was — it gets re-checked before being trusted as a dependency for new work, the same way the app itself won't treat a stale center's health score as gospel.

## Why this exists now

This methodology was adopted alongside a real structural decomposition of `src/Engine.tsx` (see `docs/engine/entanglement-registry.md` and the migration history in `git log`) — splitting a single 6,500-line file into `src/engine/*` modules. That refactor is exactly the kind of change where silent entanglement breakage is easiest to introduce and hardest to notice, which is why the methodology was formalized at the same time rather than after the fact.
