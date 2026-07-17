# Auto-Deploy Options — No Manual GitHub Steps Required

Choose the option that works best for you:

---

## 🟢 Option 1: Netlify (Recommended — Instant, No Auth)

### 1. Visit Netlify
Go to https://app.netlify.com

### 2. Click "New site from Git"

### 3. Authorize GitHub
Connect your GitHub account (one-time)

### 4. Select Repository
- Choose: `singhpratik44/vm` or the codeninjas-governance-engine repo
- Branch: `claude/branch-contents-dbyyzv`

### 5. Netlify Auto-Detects
- Build command: `npm run build`
- Publish directory: `dist`
- ✓ Auto-deploys on every git push

### Your Live URL
```
https://codeninjas-governance-engine.netlify.app
```

**Auto-redeploys** every time you push to the branch.

---

## 🔵 Option 2: Vercel (Fast Deployment)

### 1. Visit Vercel
Go to https://vercel.com/new

### 2. Authorize GitHub
Connect your GitHub account

### 3. Import Project
- Paste: `https://github.com/singhpratik44/vm`
- Root directory: `./workspace/codeninjas-governance-engine`

### 4. Vercel Auto-Configures
- Framework: React
- Build: `npm run build`
- Output: `dist`

### Your Live URL
```
https://codeninjas-governance-engine.vercel.app
```

---

## 🟡 Option 3: GitHub Pages (Traditional)

### If you have GitHub credentials:

```bash
cd /workspace/codeninjas-governance-engine/dist

git init
git add -A
git commit -m "Quantum PM deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/codeninjas-governance-engine.git
git push -u origin main
```

Then: GitHub Settings → Pages → Deploy from branch `main`

Your URL:
```
https://YOUR_USERNAME.github.io/codeninjas-governance-engine/
```

---

## 🟠 Option 4: Local Web Server (Demo Only)

For testing locally:

```bash
cd /workspace/codeninjas-governance-engine/dist
python3 -m http.server 8080
```

Visit: http://localhost:8080

---

## 📊 Comparison

| Feature | Netlify | Vercel | GitHub Pages | Local |
|---------|---------|--------|--------------|-------|
| Setup Time | 2 min | 2 min | 5 min | 30 sec |
| Auto-Deploy | ✓ Yes | ✓ Yes | Manual | No |
| Custom Domain | ✓ Yes | ✓ Yes | ✓ Yes | No |
| Free Tier | ✓ Yes | ✓ Yes | ✓ Yes | ✓ Yes |
| No Auth Needed | ✗ GitHub required | ✗ GitHub required | ✗ GitHub token | ✓ Yes |
| Live URL | 60 sec | 30 sec | 60 sec | Local only |

---

## 🚀 Recommended Path

1. **Best Experience:** Use Netlify or Vercel (auto-redeploy on git push)
2. **Quick Demo:** Use local server
3. **Pure GitHub:** Use GitHub Pages option

---

## What Gets Deployed

All options deploy the same files:
```
dist/
├── index.html (436 bytes)
└── bundle.js (851 KB)
```

Complete, self-contained React app. No build needed on hosting platform.

---

## Auto-Redeploy on Code Changes

Once deployed to Netlify/Vercel:

```bash
# Make changes to source code
# Rebuild locally
npm run build

# Push to git
git add -A
git commit -m "Update: [description]"
git push origin claude/branch-contents-dbyyzv

# Netlify/Vercel auto-detects and redeploys (30-60 sec)
```

---

## Need Help?

- **Netlify stuck?** → Visit your dashboard, check deploy logs
- **Vercel issue?** → Check vercel.json config
- **Local server not working?** → Try `python -m http.server 8000`

---

**Pick one option above and go live in 2 minutes!**
