# GitHub + Claude Code: Multi-Session Coordination Research

**Generated:** July 18, 2026  
**Method:** Deep research workflow (108 agents, 26 sources, adversarial verification — 3-vote threshold)  
**Status:** 11 confirmed findings, 14 refuted claims, 0 unverified  
**Source:** github.com/anthropics/claude-code-action, code.claude.com/docs, GitHub community discussions  

---

## Confirmed Findings (3-0 Vote — High Confidence)

### GitHub Structure

**1. GitHub's permission model operates at repository level; monorepos rely on CODEOWNERS + required reviews for ownership enforcement rather than strict access boundaries.**
- GitHub has no native subdirectory-level write permission model
- In a monorepo, anyone with repo write access can touch any path
- CODEOWNERS + branch-protection required-reviews is the documented and universally practiced substitute
- Sources: [GitHub Community Discussion](https://github.com/orgs/community/discussions/186401), [CODEOWNERS docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

**2. A hybrid monorepo/polyrepo strategy — monorepos for closely related projects, polyrepos for independent services — is the common real-world compromise.**
- Teams like Google, Meta, Babel/Jest/React use monorepos for shared tooling while keeping security-sensitive services separate
- Avoids access-control weakness of single monorepo + dependency-management overhead of full polyrepo fragmentation
- For Claude Code multi-session setups: a single repo lets sessions share CLAUDE.md state; isolated workstreams benefit from separate repos
- Source: [GitHub Community Discussion](https://github.com/orgs/community/discussions/186401)

### Claude Code + GitHub Actions

**3. Claude Code GitHub Actions runs entirely on your own GitHub runner and routes API calls to any of four providers (Anthropic, AWS Bedrock, Google Vertex AI, Microsoft Foundry) with no static credentials required for cloud providers.**
- Execution never leaves your infrastructure
- AWS Bedrock uses GitHub OIDC for keyless authentication (temporary, auto-rotated credentials)
- Google Vertex AI uses Workload Identity Federation (GA June 17, 2026 — no downloadable service account keys)
- Sources: [anthropics/claude-code-action README](https://github.com/anthropics/claude-code-action), [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions)

**4. The claude-code-action accepts all Claude Code CLI flags via a single `claude_args` parameter, including `--max-turns`, `--model`, `--mcp-config`, `--allowedTools`, `--json-schema`, making every CLI capability available inside GitHub Actions.**
- Example: `claude_args: '--max-turns 5 --model claude-sonnet-5 --mcp-config /path/to/config.json'`
- Capabilities like MCP server injection, tool allowlisting, structured JSON output, and model selection are all available in CI
- Trade-off: `claude_args` is a single unstructured string, so workflow YAML authors must handle quoting carefully
- Source: [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions)

**5. Claude Code GitHub Actions can be triggered by @claude mentions in PR/issue comments AND supports fully automated cron-scheduled workflows using the `prompt` parameter, with no human trigger required.**
- Mode 1: `issue_comment` and `pull_request` events listening for @claude mentions (human-in-the-loop)
- Mode 2: `schedule` with cron expression + `prompt` field (fully automated, no human involved)
- Both modes share the same `claude-code-action`; only the GitHub event type and presence of prompt differ
- Cron mode is right for recurring tasks (nightly audits, governance checks, regression testing)
- Source: [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions)

**6. Claude Code GitHub Actions supports structured JSON outputs that become GitHub Action outputs, enabling downstream automation steps to consume Claude's results programmatically.**
- Implementation uses `--json-schema` in `claude_args`; result becomes `steps.<id>.outputs.structured_output`
- Downstream steps can parse it with `fromJSON()`
- Key primitive for reliable automation pipelines: Claude produces a structured verdict (e.g., `is_flaky: true, risk_level: high`) and subsequent steps branch on those values without parsing free-form prose
- Source: [anthropics/claude-code-action README](https://github.com/anthropics/claude-code-action)

### Claude Code Platform

**7. Claude Code GitHub Actions is built on top of the Claude Agent SDK, which enables programmatic integration of Claude Code into custom applications and automation workflows beyond GitHub Actions.**
- The SDK (@anthropic-ai/claude-agent-sdk) provides the same primitives the GitHub Action uses
- Available for teams that need automation triggered by non-GitHub events (Slack bots, internal dashboards, webhooks)
- No need to wrap everything in a GitHub workflow if your trigger is external
- Sources: [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions), [Claude Agent SDK docs](https://code.claude.com/docs/en/agent-sdk)

**8. Agent teams — multiple independent Claude Code sessions that communicate peer-to-peer and share a task list — are experimental and disabled by default.**
- Official status: "Agent teams are experimental and disabled by default. See agent teams for setup and current limitations."
- Agent teams enable sessions to message each other directly and coordinate via a shared task list
- As of July 2026, this is the most sophisticated parallelism primitive available, but experimental status means it should not be relied on for production automation pipelines
- Safe alternative: orchestrator-subagent parallelism (stable) combined with CLAUDE.md and branch/PR serialization
- Source: [Claude Code features overview](https://code.claude.com/docs/en/features-overview)

**9. The quickstart via Claude CLI is only available for Anthropic direct API users; AWS Bedrock, Google Vertex AI, and Microsoft Foundry integrations require manual setup via cloud-providers documentation.**
- Explicit note: "This quickstart method is only available for direct Anthropic API users. For AWS Bedrock, Google Vertex AI, or Microsoft Foundry setup, see docs/cloud-providers.md."
- Practical onboarding friction point for enterprise teams: fast path doesn't work for teams that must route through Bedrock/Vertex for compliance or cost reasons
- Source: [anthropics/claude-code-action README](https://github.com/anthropics/claude-code-action)

**10. Skills with `disable-model-invocation: true` in their frontmatter are hidden from Claude entirely until manually invoked, reducing their context cost to zero between invocations.**
- Useful optimization for large skill libraries in multi-session environments where context window cost compounds across many parallel sessions
- Confidence: Medium (2-1 verification vote; one verifier found edge-case behavior harder to independently confirm)
- Source: [Claude Code features overview](https://code.claude.com/docs/en/features-overview)

---

## For This Repo (Engine.tsx)

**Specific applications to the 8,781-line franchise governance dashboard:**

- **Use CLAUDE.md as the coordination surface** between concurrent Claude Code sessions (already in place). Claim functions by name, not vague feature areas, to avoid merge conflicts.
- **Add a GitHub Actions PR check** running the Node/jsdom test harness on every PR before merge — catches silent broken-build failures.
- **Add `@claude` PR review action** grounded in CLAUDE.md's known bugs and deliberate gaps — enforces invariants (unclamped reversal, composite-key diffing, non-scenario tabs).
- **Add `PreToolUse` hook on `Bash`** that runs `npm run build` before any push, blocking if esbuild fails.
- **Branch protection on `main`** — force all work through PRs, making the automated gate mandatory.
- **Use `--max-turns` in Actions** to cap runaway sessions.

---

## Open Questions

1. When agent teams go stable, what are the exact setup requirements and limitations?
2. How does CLAUDE.md scope conflict resolution work (nearest scope wins vs. additive merge)?
3. What lifecycle management tools exist for stale Claude Code Remote environments at scale?
4. Does GitHub's June 2025 fine-grained permissions GA provide any practical directory-level access control in monorepos?

---

## Refuted / Don't Rely On

Claims about Remote Control bridge environments, CLAUDE.md additive semantics, and stale environment cleanup were adversarially verified and refuted (0-3 votes). Public documentation is sparse in these areas; treat as unconfirmed until official guidance clarifies.

---

**Reference this document when:**
- Wiring up GitHub Actions to run Claude Code sessions
- Setting up multi-session coordination on a single file
- Configuring provider routing (Anthropic / Bedrock / Vertex AI)
- Deciding whether to use agent teams (recommendation: don't yet — they're experimental)
