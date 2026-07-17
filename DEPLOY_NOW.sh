#!/bin/bash

# ============================================================================
# ULTIMATE DEPLOY SCRIPT — One Command to Go Live
# ============================================================================

set -e

DIST_DIR="/workspace/codeninjas-governance-engine/dist"
REPO_DIR="/workspace/codeninjas-governance-engine"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  QUANTUM PM — One-Command Deployment to GitHub Pages         ║"
echo "║  Five Pillars Franchise Governance Engine                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER

if [ -z "$GITHUB_USER" ]; then
  echo "❌ GitHub username is required"
  exit 1
fi

REPO_NAME="codeninjas-governance-engine"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo ""
echo "📦 DEPLOYMENT PLAN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Repository: ${REPO_URL}"
echo "  Branch: main"
echo "  Deploy folder: dist/"
echo "  Live URL: https://${GITHUB_USER}.github.io/${REPO_NAME}/"
echo ""

read -p "Ready to deploy? (y/n): " confirm

if [[ $confirm != "y" ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🚀 DEPLOYING..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Make sure dist/ is up to date
cd "$REPO_DIR"
echo "1️⃣  Building latest bundle..."
npm run build > /dev/null 2>&1
echo "   ✓ Bundle built ($(du -h dist/bundle.js | cut -f1))"

# Step 2: Create/update dist git repo
cd "$DIST_DIR"

if [ -d .git ]; then
  echo "2️⃣  Updating existing dist repo..."
  git add -A
  git commit -m "Deploy: Quantum PM $(date +%Y-%m-%d\ %H:%M:%S)" || true
else
  echo "2️⃣  Initializing dist git repo..."
  git init
  git add -A
  git commit -m "Initial: Quantum PM Governance Engine - Five Pillars Franchise Approval System"
fi

# Step 3: Configure remote and push
git branch -M main

if git remote | grep -q origin; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "3️⃣  Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 FINAL STEP: Enable GitHub Pages"
echo ""
echo "  1. Go to: https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo "  2. Click: Settings (top right)"
echo "  3. Select: Pages (left sidebar)"
echo "  4. Source: Branch 'main', Folder '/(root)'"
echo "  5. Click: Save"
echo ""
echo "⏱️  Wait 30-60 seconds for site to go live"
echo ""
echo "🌐 LIVE URL: https://${GITHUB_USER}.github.io/${REPO_NAME}/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 TIPS:"
echo "  • Bookmark your live URL for easy access"
echo "  • Share with team: paste the URL"
echo "  • To update: npm run build → git push"
echo ""
