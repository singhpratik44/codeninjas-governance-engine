#!/usr/bin/env node
// Tier 3 of scripts/verify-gate.mjs — invoked with the path to a CJS bundle
// of src/Engine.tsx (react/react-dom/three kept external). Mounts the real
// Engine component in jsdom and asserts every essential tab renders visible
// content without throwing. Effects in a component this large take
// meaningfully longer to flush than in a small test component — 800ms-1s
// is reliable, 150ms produced a false failure during this repo's history
// (see CLAUDE.md's testing-approach section).

import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsPath = process.argv[2];
if (!cjsPath) {
  console.error('usage: render-check.mjs <path-to-cjs-bundle>');
  process.exit(1);
}

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  // Node 22 ships a getter-only global `navigator` — redefine it instead of
  // assigning, or this throws "Cannot set property navigator".
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  const { default: Engine } = require(cjsPath);

  const container = document.getElementById('root');
  const root = createRoot(container);
  const failures = [];

  // A representative slice, not every tab — full ESSENTIAL_TABS coverage is
  // a Phase-1-completion check, not every incremental slice's job.
  const tabsToCheck = ['quantum', 'exec', 'team', 'network', 'financials', 'risk', 'board', 'rail'];

  for (const t of tabsToCheck) {
    await act(async () => {
      root.render(React.createElement(Engine, { initialTab: t }));
    });
    await new Promise(r => setTimeout(r, 900));
    const html = container.innerHTML;
    if (!html || html.length < 200) {
      failures.push(`Tab "${t}" rendered suspiciously little content (${html.length} chars).`);
    }
  }

  await act(async () => { root.unmount(); });

  if (failures.length) {
    failures.forEach(f => console.error('FAIL:', f));
    throw new Error(`Tier 3 render: ${failures.length} tab(s) failed to render.`);
  }
  console.log(`OK: ${tabsToCheck.length} tabs mounted and rendered visible content (${tabsToCheck.join(', ')}).`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
