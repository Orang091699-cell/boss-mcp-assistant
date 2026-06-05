# AGENTS.md — @reconcrap/boss-recommend-mcp

## Hard rules

- **CDP-only**: No `Runtime.evaluate`, `Runtime.callFunctionOn`, `page.evaluate`, or any page-JS execution. All browser automation uses CDP domains `DOM`, `Input`, `Page`, `Network`, `Accessibility`, `Target` via `src/core/browser/index.js`.
- **Legacy quarantine**: `legacy/research/` is research-only archive. Active code must not import from it. `npm run scan:runtime:strict` must pass with 0 reachable active findings.
- **Legacy `follow_up.chat`**: The recommend→chat chain is intentionally fenced in the CDP-only path. Use explicit `prepare_boss_chat_run` / `start_boss_chat_run` instead.

## Entry points

| Purpose | File |
|---------|------|
| MCP server | `src/index.js` |
| CLI | `src/cli.js` |
| Bin shim | `bin/boss-recommend-mcp.js` |
| Installer (auto-run by postinstall) | `scripts/postinstall.cjs` |

Three domain services: `src/domains/recommend/`, `src/domains/recruit/`, `src/domains/chat/` — each exports constants, CDP-only helpers, run-service, and an index. Wired into MCP tools via `src/recommend-mcp.js`, `src/recruit-mcp.js`, `src/chat-mcp.js`.

## Commands

```bash
# Run MCP server (stdio)
node src/index.js

# CLI
node src/cli.js start|install|doctor|list-jobs|launch-chrome|set-port|config|chat health-check|chat prepare-run

# Tests (individual scripts, not a test framework)
npm run test:<name>           # e.g. test:parser, test:recommend-mcp, test:chat-domain

# Live tests (against real Chrome on port 9222, SLOW)
npm run live:<name>           # e.g. live:cdp-smoke, live:recommend-mcp

# Static gates (must pass before PR)
npm run scan:runtime          # inventory mode
npm run scan:runtime:strict   # fail on active findings
npm run gate:phase9-static    # aggregate static gates
npm run gate:phase10-complete # 20+ candidate live completion gate
```

## Key paths

- Runtime state: `~/.boss-recommend-mcp/runs/<run_id>.json`
- Config (required): `~/.boss-recommend-mcp/screening-config.json` (or `BOSS_RECOMMEND_SCREEN_CONFIG`)
- Legacy migration backup: `mcp.json.boss-mcp-migration-*.bak`
- Skills bundled in `skills/` — synced to codex home on install

## Quirks

- **Config must have** `baseUrl`, `apiKey`, `model` set before any pipeline run. Default `replace-with-openai-api-key` triggers a config prompt.
- `__reset*StateForTests` / `__set*ForTests` exports exist for mocking in test files (e.g. `__resetRecommendMcpStateForTests`).
- `normalizeText()` strips whitespace aggressively — use it for all user-facing string comparison.
- `target_count` accepts `"all"`, `-1`, `"不限"`, `"扫到底"`, etc. via `isUnlimitedTargetCountToken()`.
- Live tests need `--slow-live` on VPN. Chrome remote debug port defaults to 9222.
- `scan:runtime` uses `ALLOWLIST` and `LEGACY_QUARANTINE` — if adding a file that legitimately references forbidden patterns, add it to one of those in `scripts/scan-forbidden-runtime.js`.
- Startup docs: read `docs/SESSION_START.md` first, then `docs/CDP_ONLY_CONTRACT.md`, `docs/REWRITE_STATUS.md`.
