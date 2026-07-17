# Quick Start — Go Live in 2 Minutes

## Instant Demo (Test Locally)

```bash
cd /workspace/codeninjas-governance-engine/dist
python3 -m http.server 8080
```

Then open: **http://localhost:8080**

---

## Auto-Deploy (Choose One)

### Option 1: Netlify (Recommended)
```bash
cd /workspace/codeninjas-governance-engine
./deploy.sh
# Select: 1
```

Then visit https://app.netlify.com and connect GitHub.
**Site live in ~60 seconds**

### Option 2: Vercel
```bash
cd /workspace/codeninjas-governance-engine
./deploy.sh
# Select: 2
```

Then visit https://vercel.com/new and connect GitHub.
**Site live in ~30 seconds**

### Option 3: GitHub Pages
```bash
cd /workspace/codeninjas-governance-engine
./deploy.sh
# Select: 3
# Enter: your GitHub username
```

**Site live in ~60 seconds at:** `https://YOUR_USERNAME.github.io/codeninjas-governance-engine/`

---

## What You Get

✓ **Live Quantum PM Tab**
- Franchisee selector (Jane Doe Portland OR)
- Analyze button → Shows all five pillars instantly
- Boundary observables, forecasts, topology, alignment, Φ metrics

✓ **All Original Tabs**
- Action Queue, Decision Rail, Operations Board, etc.

✓ **Auto-Redeploy** (Netlify/Vercel only)
- Change code → Push to git → Auto-deploys in ~30 seconds
- No manual deployment steps needed

---

## Files Included

- **dist/index.html** - Static HTML
- **dist/bundle.js** - Complete React app (851 KB)
- **netlify.toml** - Netlify auto-config
- **deploy.sh** - Interactive deployment script

That's it. No build needed on hosting platform.

---

## Demo Links (After Deployment)

**Netlify:** `https://YOUR-PROJECT.netlify.app`  
**Vercel:** `https://YOUR-PROJECT.vercel.app`  
**GitHub Pages:** `https://YOUR-USERNAME.github.io/codeninjas-governance-engine/`

---

## Next Steps

1. Run: `./deploy.sh`
2. Choose: Netlify or Vercel (easiest)
3. Connect GitHub (one-time)
4. Go live (30-60 seconds)
5. Share URL with team

---

**Done!** You're live with Quantum PM governance engine.
