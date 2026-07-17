#!/bin/bash

# ============================================================================
# QUANTUM PM — Automated Deployment Script
# Choose your deployment method and go live instantly
# ============================================================================

set -e

DIST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/dist" && pwd)"
BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  QUANTUM PM — Governance Engine Auto-Deployment              ║"
echo "║  Five Pillars Franchise Approval System                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Show menu
echo "Choose deployment method:"
echo ""
echo "  1) Netlify (Recommended - auto-deploy on git push)"
echo "  2) Vercel (Fast, same benefits as Netlify)"
echo "  3) GitHub Pages (Traditional)"
echo "  4) Local Web Server (Demo only)"
echo "  5) Show all options"
echo ""
read -p "Select (1-5): " choice

case $choice in
  1)
    echo ""
    echo "📦 Netlify Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Netlify will:"
    echo "  • Auto-detect your git repository"
    echo "  • Run 'npm run build' on every push"
    echo "  • Deploy the 'dist' folder"
    echo "  • Assign a live URL automatically"
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://app.netlify.com"
    echo "  2. Click 'New site from Git'"
    echo "  3. Authorize GitHub"
    echo "  4. Select your repository"
    echo "  5. Netlify auto-configures the rest"
    echo ""
    echo "Your site will be live in ~60 seconds"
    echo "Auto-redeploys on every git push"
    echo ""
    read -p "Open Netlify now? (y/n): " open_netlify
    if [[ $open_netlify == "y" ]]; then
      if command -v xdg-open > /dev/null; then
        xdg-open "https://app.netlify.com/start"
      elif command -v open > /dev/null; then
        open "https://app.netlify.com/start"
      else
        echo "Visit: https://app.netlify.com/start"
      fi
    fi
    ;;

  2)
    echo ""
    echo "⚡ Vercel Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Vercel will:"
    echo "  • Auto-detect your git repository"
    echo "  • Run 'npm run build'"
    echo "  • Deploy the 'dist' folder"
    echo "  • Assign a live URL"
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://vercel.com/new"
    echo "  2. Authorize GitHub"
    echo "  3. Import your project"
    echo "  4. Click Deploy"
    echo ""
    echo "Your site will be live in ~30 seconds"
    echo "Auto-redeploys on every git push"
    echo ""
    read -p "Open Vercel now? (y/n): " open_vercel
    if [[ $open_vercel == "y" ]]; then
      if command -v xdg-open > /dev/null; then
        xdg-open "https://vercel.com/new"
      elif command -v open > /dev/null; then
        open "https://vercel.com/new"
      else
        echo "Visit: https://vercel.com/new"
      fi
    fi
    ;;

  3)
    echo ""
    echo "📘 GitHub Pages Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -p "Enter GitHub username: " github_user
    read -p "Enter repository name (default: codeninjas-governance-engine): " repo_name
    repo_name=${repo_name:-codeninjas-governance-engine}

    echo ""
    echo "Deploying to GitHub Pages..."
    echo ""

    cd "$DIST_DIR"

    if [ -d .git ]; then
      echo "Git repo already exists, updating..."
      git add -A
      git commit -m "Update: Quantum PM deployment" || true
    else
      echo "Initializing git repository..."
      git init
      git add -A
      git commit -m "Deploy: Quantum PM Governance Engine

Five Pillars Franchise Approval System
- Boundary Observables (SR%, gates, capital, confidence)
- Information Release Curves (24-month forecast)
- Network Topology (cluster analysis, bottlenecks)
- Alignment Heuristic (angle-based routing)
- Integration Metrics (Φ network coherence)

Ready for GitHub Pages deployment."
    fi

    git branch -M main

    remote_url="https://github.com/${github_user}/${repo_name}.git"

    if git remote | grep -q origin; then
      git remote set-url origin "$remote_url"
    else
      git remote add origin "$remote_url"
    fi

    echo ""
    echo "Pushing to GitHub..."
    git push -u origin main

    echo ""
    echo "✓ Code pushed to GitHub!"
    echo ""
    echo "Next step: Enable GitHub Pages"
    echo "  1. Go to https://github.com/${github_user}/${repo_name}"
    echo "  2. Settings → Pages"
    echo "  3. Branch: main, Folder: /(root)"
    echo "  4. Save"
    echo ""
    echo "Your site will be live in ~60 seconds at:"
    echo "  https://${github_user}.github.io/${repo_name}/"
    ;;

  4)
    echo ""
    echo "🌐 Local Web Server"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    cd "$DIST_DIR"

    echo "Starting web server..."
    echo ""
    echo "Access at: http://localhost:8080"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    python3 -m http.server 8080
    ;;

  5)
    echo ""
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║               ALL DEPLOYMENT OPTIONS                             ║
╚══════════════════════════════════════════════════════════════════╝

🟢 NETLIFY (Recommended)
   • Auto-deploy on every git push
   • Custom domain support
   • Live in ~60 seconds
   • https://app.netlify.com
   • Free tier: ✓ Unlimited sites, builds, bandwidth

⚡ VERCEL
   • Auto-deploy on git push
   • Global CDN
   • Live in ~30 seconds
   • https://vercel.com/new
   • Free tier: ✓ Same as Netlify

📘 GITHUB PAGES
   • Traditional GitHub hosting
   • Custom domain support
   • Live in ~60 seconds
   • https://YOUR_USERNAME.github.io/repo/
   • Free tier: ✓ Yes

🌐 LOCAL SERVER
   • Demo only (not public)
   • Run locally: python3 -m http.server 8080
   • Access: http://localhost:8080
   • Perfect for testing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDATION:
Use Netlify or Vercel for best experience
(auto-deploy, fast, free, no configuration)

SETUP TIME:
Netlify/Vercel: 2 minutes
GitHub Pages: 5 minutes
Local: 30 seconds

AUTO-REDEPLOY:
Netlify ✓ (on git push)
Vercel ✓ (on git push)
GitHub Pages ✗ (manual)
Local ✗ (demo only)

EOF
    ;;

  *)
    echo "Invalid choice. Please run again and select 1-5."
    exit 1
    ;;
esac

echo ""
echo "✅ Deployment setup complete!"
echo ""
