# CLAUDE.md

Context for Claude Code sessions working on this repo. Read this before editing `src/Engine.tsx` — several things that look like bugs or missing features are deliberate, and the reasoning here is what keeps you from undoing them by accident.

## What this is

A single-file React governance dashboard for a CodeNinjas franchise network (348 modeled centers), built as a submission artifact for a Director of Franchise Development application. Deadline: July 26, 2026. The centerpiece is a "Quantum PM" scenario-governance system: approving a network posture (Optimistic/Realistic/Pessimistic) actually recomputes the network — health scores, gate outcomes, proposal viability, a live map, graph-theoretic clustering — not just labels.

## Active work claims — check before editing `src/Engine.tsx`

Multiple Claude Code sessions sometimes work on this repo concurrently and independently, with no direct channel to message each other. This file is the one thing every session reads at start, so it's also the coordination surface. Before starting work:

1. Check open PRs and active branches (list PRs against `main`, `git ls-remote --heads origin`) for work already claimed — don't duplicate or collide with it.
2. Add a line below naming your branch and what you're touching before you start editing, so the next session doesn't collide with you either.
3. Keep PRs small and merge to `main` (or rebase onto it) frequently. This is a single ~6,500-line file — long-lived branches drift into unresolvable conflicts fast. Prefer opening a PR over pushing straight to `main`.
4. Remove your line once merged (or abandoned) so this list reflects reality, not history.

**Currently claimed** (as of 2026-07-17 — verify against actual PR/branch state, this goes stale):
- `claude/new-session-7sihmx` (PR #1, open) — local scenario override for the `team` tab.
- `claude/autonomous-quantum-development-5blmms` (no PR yet) — Map3D drill-down fixes.

## Architecture

- `src/Engine.tsx` — the entire application. One file, ~6,500 lines. `export default function Engine(props)` wraps `EngineInner`, which holds essentially all state.
- `src/main.jsx` — mounts `<Engine initialTab={...}>`, reading the initial tab from `window.location.hash` for deep-linking.
- No build step needed to deploy — `bundle.js` at repo root is pre-built. `index.html` at root is static and essentially never needs to change (it's just a shell with a `#root` div and a `<script src="./bundle.js">` tag) — the build script only ever regenerates `bundle.js`.

## Deploy pipeline (already set up — read this before touching it)

`.github/workflows/deploy.yml` triggers on push to `main` when `src/**`, `package.json`, or the workflow file itself changes. It runs `npm ci && npm run build`, copies the freshly-built `dist/bundle.js` to the repo root, **verifies the copy actually contains the triggering commit's SHA**, then commits/pushes that back using GitHub's own `GITHUB_TOKEN` — no PAT needed. Live at `https://singhpratik44.github.io/codeninjas-governance-engine/`.

**The self-verification step is load-bearing, not decorative — don't remove it.** An earlier version of this workflow tried to `cp dist/index.html ./index.html`, but the build script (`esbuild src/main.jsx --bundle ...`) never actually generates `dist/index.html` — only `dist/bundle.js`. That `cp` failed every single run, which failed the whole step, which meant the workflow silently never committed anything for two consecutive pushes. The job's status page correctly showed "failure" both times, but nobody was polling for it, so the live site quietly stayed on stale content — missing a real bug fix and a real feature — while every conversation about it assumed the fixes were live. It was only caught by accident, investigating an unrelated question.

Worse: the verification method used to "confirm" those fixes were live (`grep`-ing the deployed bundle for `hashchange` and `targetIds.includes`) gave false positives — both strings already existed in the codebase for unrelated reasons (`hashchange` is a native DOM event name React DOM's own internals reference; `targetIds.includes(...)` was already a common pattern used in four other unrelated places). **Don't verify a deployment by grepping for a hand-picked string unless you've first confirmed that exact string doesn't already exist in the pre-change version.** A blob-hash diff against a known-previous commit, or — what's actually built into the pipeline now — a build-time-injected, guaranteed-unique marker, are the reliable methods.

The fix: `src/main.jsx` sets `window.__BUILD_SHA__` via `esbuild --define:__BUILD_SHA__`, fed the triggering commit's real SHA (`${{ github.sha }}`) as a `BUILD_SHA` env var during the `npm run build` step in CI (falls back to `"local"` for local dev builds where the env var isn't set). A dedicated "Verify build output actually contains this commit" step then greps the freshly-copied `bundle.js` for that exact SHA and `exit 1`s with an `::error::` annotation if it's missing — refusing to let a broken build silently commit. A commit SHA can't coincidentally already exist elsewhere the way a hand-picked string can, so this check is actually trustworthy. Proven working live: when a manually-built local commit had the wrong (`"local"`) marker instead of the real SHA, CI detected the mismatch on its own and pushed a corrective commit authored by `github-actions[bot]`, no human intervention needed.

If you ever need to push a change to `.github/workflows/deploy.yml` itself, that specific push needs a token with `workflow` scope in addition to `repo` — GitHub blocks workflow-file changes from tokens that only have `repo`. Changes to `src/` alone only need `repo`.

## The scenario system — how it actually works

- `SCENARIO_DELTAS` (top-level const): per-posture deltas to `conv`/`ret`/`chem`/`eb`. Realistic is the zero-delta baseline.
- `WEEKLY_DRIFT_STEP` + `weekCompound(posture, week)`: makes the "Run live" week simulator **compound** a posture over time instead of replaying a static snapshot. Realistic's direction is always 0, so it never drifts regardless of week — this matters for the reversal math below.
- `computeCentersForPosture(base, adj, posture, week)`: the single source of truth for "raw center + posture + week + manual adjustment → adjusted center." The main `centers` useMemo, and every governed-tab override, call this same function. **Don't duplicate this logic inline again** — it was hand-duplicated three times earlier in the build and caused a real near-regression when only some copies got updated. If you need a variant, extend this function, don't copy it.
- `computeOverrideView(rawCenters, adj, posture, week, leads)`: wraps `computeCentersForPosture` and also rebuilds `states` and `railData` (via `runAllAgents`) for a given posture. Used by any tab that needs a full recomputed view, not just adjusted centers.
- `QuantumPMView`'s `diff`/`baselineRailData` useMemos **reverse** the scenario+week delta to reconstruct a Realistic baseline for comparison. This reversal is deliberately **unclamped** — clamping during reversal was tried and rejected because it doesn't exactly invert the forward transform for centers near a clamp boundary. Verified exact (0 mismatches) against real generated data at weeks 0/1/12/24. Don't add clamping back into this specific reversal without re-verifying.

## Deliberate gaps — do not "fix" these without understanding why first

- **`table` (3D WebGL map) and `team` (single-center detail) tabs have no local scenario override.** Not an oversight. `table` uses Three.js and can't be verified in this repo's Node/jsdom-based test harness; `team` is dense enough (many derived fields) that wiring it in was judged higher-risk than the remaining time justified. Both correctly inherit the *global* posture already — only the per-tab override is missing.
- **`compliance` and `fdd` tabs deliberately have no override buttons at all**, not even inherit-only styling — they show plain explanatory text instead. `compliance` reads `c.compliance`/`c.staffCleared`, which no `SCENARIO_DELTAS` field touches (these are the child-safety governor's own fields, and child safety should never be scenario-dependent — that's a design principle, not a limitation). `fdd`'s 244-unit count is the actual FDD legal disclosure figure; it must never appear to shift based on a hypothetical scenario.
- **Financials tab's revenue/royalty/brand-fund figures do not change with scenario overrides — only "summed unit margin" does.** Verified: `royaltyOf(c)` is purely a function of `c.students`, which no scenario delta touches. This is correct, not a bug — revenue tracks enrollment, not a hypothetical governance posture. The UI banner says this explicitly; don't "fix" it by making revenue scenario-sensitive without a real product reason to add an enrollment dimension to `SCENARIO_DELTAS`.
- **`engageOf(c)` is a pure function of center name** (seeded RNG), not of `conv`/`ret`/`chem`/`eb`. This means the `engagement_integrity` governor never moves with posture, and the graph-theory at-risk clustering panel may often show 0 clusters even under Pessimistic, because the state-level "at-risk" tier classification (`qAmp`/`qResolve`) only partially depends on scenario-sensitive fields. This is pre-existing v3 calibration, not something introduced by the quantum system — don't retune `qAmp` to "make the demo more dramatic" without knowing it affects other tabs that already depend on its current calibration.
- **`onDecide` in `DecisionRailTab` hard-gates territory-scope (Growth agent) proposals behind a global posture approval**, both in the UI (disabled button) and again inside the function itself (defense in depth — re-checks the same condition even if called directly). Unit/cluster-scope proposals (Unit Health, Retention, Network Propagation) are never gated by posture. If you add a new agent/proposal type, decide deliberately whether it represents new capital commitment (should gate) or a routine intervention (shouldn't) — don't default to gating everything.

## Known bugs already fixed here — don't reintroduce

- Risk Register's `owner`/`status` used to always show "—"/"no proposal" because it matched `r.center`, a field that doesn't exist on recommendation objects. Fixed to check `r.targetIds.includes(c.name)` — membership, not a fixed index, because `targetIds` shape differs by agent (Growth: `[leadId,region,anchorName]`; Unit Health/Retention: `[centerName]`; Network Propagation: `[source,target]`, two centers).
- The week simulator's `setInterval` tick used to do `return {run:true,week,...}` — a full state replacement instead of `{...o,run:true,week,...}`. Harmless before the quantum system existed; would have silently deleted `opt.quantum` on every tick once it was added. Fixed to spread `...o` first. If you see a `setOpt(o => ...)` call anywhere that doesn't spread `...o`, that's very likely the same class of bug.
- Recommendation `id`s are minted from a module-level `_recSeq` counter (`buildRecommendation`), so **two separate `runAllAgents()` calls never produce matching ids for "the same" proposal.** Anything that diffs proposals across two computed states (baseline vs. scenario) must match on a stable composite key (`agent+scope+targetIds.join(",")`), never on `.id`.
- Proposal *creation* is not health-independent — verified against real data that Growth-agent proposals can be added, removed, or re-anchored (same lead, different target unit) as center health shifts under a posture, not just have their governance verdict flip. Any diff logic comparing two `runAllAgents()` outputs needs `added`/`removed`/`changed` buckets, not just a changed-verdict filter, or it silently drops proposals that only exist in one of the two states.

## Testing approach used in this build

No real browser was available during development — verification used:
- `esbuild --bundle` for syntax checking
- A Node harness with `react`/`react-dom` marked `--external` (not bundled) so a single React instance is shared between the compiled component and the test script — bundling React into the compiled output while also requiring a separate copy causes a "two React instances" hook-call error that looks like a real crash but isn't
- `react-dom/server`'s `renderToStaticMarkup` for component-level checks
- `jsdom` for anything involving `window.location`, `hashchange`, or other browser-only APIs that server-side rendering can't exercise — and note effects in a component this large can take meaningfully longer to flush than in a small test component; a 150ms wait was too short and produced a false failure, 800ms–1s was reliable
- The live deployment can be checked without a real browser via `raw.githubusercontent.com/singhpratik44/codeninjas-governance-engine/main/{path}` for repo content, or the GitHub Actions/Pages API for build status — but neither confirms what the Pages CDN is actually serving; only an actual browser load does that
- **When checking whether a change actually deployed, don't grep the built bundle for a string you picked because it "sounds specific."** Verify the string doesn't already exist in the pre-change version first (`git show <old-commit>:bundle.js | grep ...`), or diff blob hashes across commits, or — best — reuse the build's own `window.__BUILD_SHA__` marker, which is guaranteed unique by construction. This isn't a theoretical caution: two hand-picked markers used earlier in this build (`hashchange`, `targetIds.includes`) both already existed in the codebase for unrelated reasons, and a "12/12 passed" verification result was wrong for roughly two hours as a result.

If you have real browser access (a real Claude Code cloud sandbox, Playwright, etc.), that's strictly better than any of the above — use it.
