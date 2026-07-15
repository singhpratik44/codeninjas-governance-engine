# CodeNinjas Franchise Governance Engine — Deploy to GitHub Pages

This folder is a complete, self-contained static site. `dist/index.html` +
`dist/bundle.js` are all that's needed to serve it — no build step required
to deploy (it's already built).

## Get a real online link in ~2 minutes

**1. Create an empty repo on GitHub**
Go to https://github.com/new — name it anything (e.g. `codeninjas-engine`),
leave it empty (no README/license), click Create.

**2. From this folder, run:**

```bash
cd dist
git init
git add -A
git commit -m "CodeNinjas governance engine — quantum PM"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

(Replace `YOUR_USERNAME`/`YOUR_REPO_NAME` with what you picked in step 1.)

**3. Turn on GitHub Pages**
In the repo on github.com: **Settings → Pages → Source → Deploy from a
branch → Branch: `main`, folder: `/ (root)` → Save.**

GitHub will give you a live URL, typically:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```
It usually takes 30–60 seconds to go live after the first push.

## If you want to rebuild after editing Engine.tsx

The source is in `src/Engine.tsx`. To rebuild:

```bash
npm install
npm run build
```

This regenerates `dist/bundle.js`. Then `git add -A && git commit && git push`
from inside `dist/` again (or set up a proper CI step later if you keep
iterating).

## What's in here

- `dist/index.html`, `dist/bundle.js` — the deployable static site (React,
  ReactDOM, and Three.js all bundled in, ~1.1MB minified)
- `src/Engine.tsx` — the full governance engine source (same file you already
  have as CodeNinjas_FranchiseGovernance_Engine_v3_QUANTUM_MERGED.tsx)
- `src/main.jsx` — the tiny entry point that mounts `<Engine />` into the page
- `package.json` — dependencies (react, react-dom, three) and the build script
