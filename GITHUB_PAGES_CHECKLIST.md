# GitHub Pages Deployment — Step-by-Step Checklist

## ✅ What's Ready

- ✓ `dist/index.html` (436 bytes)
- ✓ `dist/bundle.js` (851 KB, fully bundled React app)
- ✓ All five pillars implemented and tested
- ✓ All iterations saved in git history

## 📋 3-Step Deployment

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `codeninjas-governance-engine`
3. Description: `Quantum PM — Five-Pillars Franchise Governance Engine`
4. Choose: Public (so others can see)
5. Leave empty: No README, license, .gitignore
6. Click **Create repository**

**You'll see:**
```
git remote add origin https://github.com/YOUR_USERNAME/codeninjas-governance-engine.git
```

### Step 2: Push to GitHub Pages

Copy-paste this into your terminal:

```bash
cd /workspace/codeninjas-governance-engine/dist

git init
git add -A
git commit -m "Deploy: Quantum PM governance engine with five pillars

- Boundary Observables (SR%, gates, capital, confidence)
- Information Release Curves (24-month forecast)
- Network Topology (cluster analysis, bottlenecks)
- Alignment Heuristic (angle-based routing)
- Integration Metrics (Φ network coherence)

Ready for live deployment to GitHub Pages."

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/codeninjas-governance-engine.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3: Enable GitHub Pages

1. Go to GitHub: `github.com/YOUR_USERNAME/codeninjas-governance-engine`
2. Click **Settings** (top right)
3. Scroll to **Pages** (left sidebar, near bottom)
4. Under "Source":
   - Branch: select **main**
   - Folder: select **/(root)**
   - Click **Save**

**GitHub will show you:**
```
Your site is live at:
https://YOUR_USERNAME.github.io/codeninjas-governance-engine/
```

⏱️ **Wait 30-60 seconds** for the site to go live.

---

## 🧪 Test After Deployment

1. Open the live URL in your browser
2. You should see:
   - Left sidebar with tabs (Quantum PM, Action Queue, Decision Rail, etc.)
   - Quantum PM tab selected by default
   - Franchisee selector (Jane Doe — Portland OR)
   - "Analyze & Generate Decision" button

3. Click the button to see all five pillars:
   - ◆ Boundary Observable Card
   - 📈 Information Release Curves
   - 🔗 Network Topology
   - 📐 Alignment Heuristic
   - Φ Integration Metrics

4. Switch to other tabs (they should work normally)

---

## 📚 All Saved Iterations

Your git repository now contains:

### In `/home/user/vm/` (source code repo)
```
engine/                                  # QIH-AEE engine (complete)
├── QUANTUM_FOUNDATIONS.md (2500+ lines)
├── DESIGN_PRINCIPLES_REFERENCE.md
├── VALIDATION_AND_DEPLOYMENT.md
├── INTEGRATION_PATTERNS.md
└── src/ (10,000+ lines of TS)

governance-integration.ts               # FranchiseGovernanceService
QuantumPMRefactored.tsx                 # React UI (all five pillars)
main-integrated.jsx                     # Entry point

CODE_NINJAS_FRANCHISE_BRIEF.md          # Executive brief
QUANTUM_PM_REDESIGN.md                  # Design doc
GOVERNANCE_INTEGRATION_GUIDE.md         # Integration manual
REBUILD_SUMMARY.md                      # Complete summary
DEPLOYMENT_INSTRUCTIONS.md              # Detailed deploy guide
ITERATION_HISTORY.md                    # This iteration log

.git/                                   # Full history (10+ commits)
```

### In `/workspace/codeninjas-governance-engine/` (built app)
```
dist/
├── index.html                          # Deployed HTML
└── bundle.js                           # Complete React app (851 KB)

src/
├── governance-integration.ts           # Source
├── QuantumPMRefactored.tsx            # Source
├── main-integrated.jsx                # Source
└── Engine.tsx                         # Original (preserved)

package.json                            # Build config
npm run build                           # Rebuild command
```

---

## 🔄 Updating After Deployment

When you make changes:

```bash
# In codeninjas-governance-engine root
npm run build

# Push to GitHub Pages
cd dist
git add -A
git commit -m "Update: [description]"
git push origin main
```

GitHub auto-redeploys within 30 seconds.

---

## 📖 View Iterations

Access any previous version:

```bash
# In /home/user/vm/ (source repo)
git log --oneline                    # See all commits
git show <commit-hash>              # View specific commit
git checkout <commit-hash>          # Go back to that version

# View complete history
git log --graph --all --oneline
```

Commits (newest first):
- `fb21c37` — Deployment instructions & iteration history
- `db11782` — Complete franchise governance rebuild ← **Current version**
- `d6786fa` — Code Ninjas executive brief
- `ad94ad6` — Weave design principles
- `5ebcc68` — Branch summary
- `83b9aeb` — Integration patterns
- `9627703` — Validation framework
- `2d55ca6` — Tool distillation & evolution
- `d0ccc53` — Quantum foundations
- `a837f01` — QIH-AEE engine build

---

## ✨ What You're Deploying

### Quantum PM Tab (New)
Five-pillars approval engine for franchise governance:

| Pillar | What | UI Component |
|--------|------|---|
| 1 | Boundary Observables (SR%, gates, capital, confidence) | BoundaryObservableCard |
| 2 | Information Release Curves (24-month forecast) | InformationReleaseCurves |
| 3 | Network Topology (cluster analysis, bottlenecks) | NetworkTopologyView |
| 4 | Alignment Heuristic (angle-based routing) | AlignmentHeuristicView |
| 5 | Integration Metrics (Φ network coherence) | IntegrationMetricsView |

### Original Tabs (Preserved)
All existing operations tabs work normally:
- Action Queue, Decision Rail, Operations Board, Command Table, Six Lens, System Alignment, Optimization Layer, Network Signals

---

## 💡 Next Steps After Going Live

1. **Share the URL** with stakeholders
2. **Gather feedback** on the Five Pillars UI
3. **Plan Phase 2** — Connect to live MyStudio data
4. **Train operations** team on new approval workflow
5. **Monitor metrics** — Track approval cycle speed, re-work reduction

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Pages not showing** | Wait 1-2 min, hard-refresh (Ctrl+Shift+R), check Pages settings |
| **Blank white screen** | Open F12 console, check for 404 errors on bundle.js |
| **Buttons don't work** | Verify dist/bundle.js deployed correctly (851 KB) |
| **Want to revert** | `cd dist && git reset --hard <old-commit>` |
| **Want old bundle** | `git show <old-commit>:bundle.js > bundle-backup.js` |

---

## 📞 Key Files to Reference

| File | Purpose |
|------|---------|
| `DEPLOYMENT_INSTRUCTIONS.md` | Detailed deployment guide |
| `REBUILD_SUMMARY.md` | What was built & why |
| `GOVERNANCE_INTEGRATION_GUIDE.md` | How it all fits together |
| `ITERATION_HISTORY.md` | Complete development timeline |
| `CODE_NINJAS_FRANCHISE_BRIEF.md` | Executive brief for stakeholders |

---

**Status:** ✅ Ready to deploy  
**Time to go live:** ~5 minutes  
**Next:** Follow the 3 steps above
