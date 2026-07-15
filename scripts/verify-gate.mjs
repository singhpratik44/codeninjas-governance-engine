#!/usr/bin/env node
// The "measurement/collapse" tier of docs/engine/QUANTUM_METHODOLOGY.md.
// A change isn't done until all three tiers pass. Run via `npm run verify`.
//
// Tier 1 (syntax): esbuild bundles the real entry point without error.
// Tier 2 (logic): the _layer1/_layer2 test-support exports (src/Engine.tsx)
//   are exercised directly, asserting real invariants documented in
//   CLAUDE.md and the entanglement registry — not just "didn't throw."
// Tier 3 (render): the actual Engine component is mounted in jsdom via
//   react-dom/client + act() (see scripts/render-check.mjs), proving
//   rendered output, not just absence of a crash. react/react-dom/three
//   are kept external and resolved from this project's own node_modules to
//   avoid a "two React instances" error (see CLAUDE.md's testing-approach
//   section) — bundling react into the test build while also requiring a
//   separate copy breaks hooks.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tiersArg = process.argv.slice(2);
const runTier = (n) => tiersArg.length === 0 || tiersArg.includes(String(n));

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function tier1Syntax() {
  section('Tier 1 — syntax');
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'esbuild'),
    ['src/main.jsx', '--bundle', '--outfile=/dev/null', '--loader:.tsx=tsx', '--jsx=automatic', '--define:__BUILD_SHA__="verify"'],
    { cwd: root, stdio: 'inherit' }
  );
  console.log('OK: esbuild bundles src/main.jsx without error.');
}

function buildCjs(outfile) {
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'esbuild'),
    [
      'src/Engine.tsx', '--bundle', '--format=cjs', '--platform=node',
      '--loader:.tsx=tsx', '--jsx=automatic',
      '--external:react', '--external:react-dom', '--external:react-dom/client', '--external:react-dom/test-utils', '--external:three',
      '--define:__BUILD_SHA__="verify"',
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: 'inherit' }
  );
}

function tier2Logic(tmp) {
  section('Tier 2 — logic');
  const cjsPath = path.join(tmp, 'EngineLogic.cjs');
  buildCjs(cjsPath);
  const { _layer1, _layer2 } = require(cjsPath);
  const { buildCenters, computeCentersForPosture, weekCompound, royaltyOf, engageOf, SCENARIO_DELTAS } = _layer1;

  const rawCenters = buildCenters();
  const failures = [];

  // Invariant: Realistic posture never drifts with week (CLAUDE.md — this
  // is what makes the QuantumPMView baseline-reversal math exact).
  for (const week of [0, 1, 12, 24]) {
    const wk = weekCompound('realistic', week);
    if (wk.conv !== 0 || wk.ret !== 0 || wk.chem !== 0 || wk.eb !== 0) {
      failures.push(`weekCompound('realistic', ${week}) drifted: ${JSON.stringify(wk)}`);
    }
  }

  // Invariant: royaltyOf depends only on students (CLAUDE.md — financials
  // tab's revenue/royalty/brand-fund must not move with scenario overrides).
  const sample = rawCenters[10];
  const scenarioAdjusted = computeCentersForPosture(rawCenters, {}, 'optimistic', 0).find(c => c.name === sample.name);
  const royaltyBefore = royaltyOf(sample);
  const royaltyAfter = royaltyOf(scenarioAdjusted);
  if (sample.students === scenarioAdjusted.students && JSON.stringify(royaltyBefore) !== JSON.stringify(royaltyAfter)) {
    failures.push(`royaltyOf changed under a scenario override despite unchanged students: ${JSON.stringify(royaltyBefore)} vs ${JSON.stringify(royaltyAfter)}`);
  }

  // Invariant: engageOf is a pure function of center name — posture-invariant.
  const pes = computeCentersForPosture(rawCenters, {}, 'pessimistic', 0).find(c => c.name === sample.name);
  if (JSON.stringify(engageOf(sample)) !== JSON.stringify(engageOf(pes))) {
    failures.push(`engageOf changed with posture for ${sample.name} — must stay a pure function of center name.`);
  }

  // Structural check: SCENARIO_DELTAS.realistic is still the documented
  // zero-delta baseline that every override reversal in QuantumPMView relies on.
  const rd = SCENARIO_DELTAS.realistic;
  if (rd.conv !== 0 || rd.ret !== 0 || rd.chem !== 0 || rd.eb !== 0) {
    failures.push(`SCENARIO_DELTAS.realistic is not zero-delta: ${JSON.stringify(rd)}`);
  }

  if (!_layer2 || typeof _layer2.runAllAgents !== 'function') {
    failures.push('_layer2.runAllAgents is missing — the _layer1/_layer2 test-support contract changed.');
  }

  if (failures.length) {
    failures.forEach(f => console.error('FAIL:', f));
    throw new Error(`Tier 2 logic: ${failures.length} invariant(s) failed.`);
  }
  console.log('OK: all logic invariants held (realistic no-drift, royaltyOf student-purity, engageOf posture-invariance, _layer1/_layer2 contract intact).');
}

function tier3Render(tmp) {
  section('Tier 3 — render');
  const cjsPath = path.join(tmp, 'EngineRender.cjs');
  buildCjs(cjsPath);
  execFileSync(process.execPath, [path.join(__dirname, 'render-check.mjs'), cjsPath], { cwd: root, stdio: 'inherit' });
}

function main() {
  // Built under node_modules/ (not the OS tmpdir) so require('react') etc.
  // resolve via normal node_modules walk-up instead of failing to resolve.
  const base = path.join(root, 'node_modules', '.verify-gate-tmp');
  mkdirSync(base, { recursive: true });
  const tmp = mkdtempSync(path.join(base, 'run-'));
  try {
    if (runTier(1)) tier1Syntax();
    if (runTier(2)) tier2Logic(tmp);
    if (runTier(3)) tier3Render(tmp);
    console.log('\nALL TIERS PASSED — safe to collapse (commit).');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error('\nVERIFY GATE FAILED:', e.message);
  process.exit(1);
}
