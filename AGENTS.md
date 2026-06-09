# AGENTS.md — boss-mcp-assistant

## What this is

MCP server that automates BOSS直聘 (zhipin.com) via Chrome DevTools Protocol (CDP). Three domains: **recommend** (推荐页筛选), **chat** (聊天自动沟通), **recruit** (招聘渠道批量处理).

## Entrypoints

- MCP server: `src/index.js` — started via `boss-mcp-assistant start`
- CLI: `src/cli.js` — subcommands via `boss-mcp-assistant <command>`
- Bin: `bin/boss-mcp-assistant.js` → `import { runCli } from "../src/cli.js"`

## Dev commands

```bash
npm start              # node src/index.js (MCP server)
npm run cli            # node src/cli.js (CLI)
npm run test:<name>    # individual test scripts, no test framework
npm run live:<name>    # live smoke tests (need Chrome + BOSS login)
```

Tests are plain Node scripts in `src/` — no Jest/Mocha. No lint/typecheck/formatter configured.

## Architecture

```
src/
├── index.js            # MCP server (JSON-RPC, tool definitions)
├── cli.js              # CLI entry (install, config, launch-chrome, start)
├── chat-mcp.js         # Chat MCP tools
├── recommend-mcp.js    # Recommend MCP tools
├── recruit-mcp.js      # Recruit MCP tools
├── parser.js           # NL instruction parser for recommend
├── chat-runtime-config.js  # screening-config.json resolution, LLM config
├── run-state.js        # Run state persistence (~/.boss-mcp-assistant/runs/)
├── core/               # Shared browser automation modules
│   ├── browser/        # CDP connection, navigation, login detection
│   ├── run/            # Run service base (status constants)
│   ├── screening/      # Candidate screening logic
│   ├── self-heal/      # Page health checks / drift detection
│   ├── infinite-list/  # Infinite list scrolling
│   └── ...
└── domains/            # Domain-specific automation
    ├── recommend/
    ├── chat/
    └── recruit/
```

## Critical constraints

- **NO `Runtime.evaluate`** — all browser automation is CDP-only (DOM, Network, Input, Accessibility, Page). Each tool output includes `runtime_evaluate_used: false` (asserted via `assertNoForbiddenCdpCalls`).
- Run state lives at `~/.boss-mcp-assistant/runs/<uuid>.json` (or `BOSS_RECOMMEND_HOME`).
- Config is `screening-config.json` — resolved from env var, `~/.boss-mcp-assistant/`, workspace `config/`, or legacy `~/.codex/boss-mcp-assistant/`.
- Chat runtime data at `~/.boss-mcp-assistant/boss-chat/` (or `BOSS_CHAT_HOME`).
- Recruit state at `~/.boss-recruit-mcp/runs/` (or `BOSS_RECRUIT_HOME`).
- Node >= 18 required.

## Target count semantics

`target_count` means **processed candidates** (not passed). "扫到底" / "all" / "unlimited" / "全部候选人" all canonicalize to `"all"`. Always pass `target_count="all"` when user says scan to end.

## Run lifecycle

States: `queued` → `running` → `paused|completed|failed|canceled`
Stages: `preflight` → `page_ready` → `job_list` → `search` → `screen` → `chat_followup` → `finalize`

## Pipeline gates

Recommend/chat/recruit tools require confirmation step before execution. The gate returns `NEED_CONFIRMATION` with `pending_questions`. After user answers, re-call with `confirmation` fields set.

## Tools (23 total)

All tool names are `snake_case`. Key tools:
- `start_recommend_pipeline_run`, `start_boss_chat_run`, `start_recruit_pipeline_run` (async)
- Corresponding `get_*`, `pause_*`, `resume_*`, `cancel_*` for each
- `list_recommend_jobs` — lists available positions from dropdown
- `run_featured_calibration` / `get_featured_calibration_status` — 精选页 calibration
- `run_recommend_self_heal` — page drift detection
- `set_screening_config` — update API key/model online

## Skills (bundled)

`skills/` contains SKILL.md + README for each domain: `boss-recommend-pipeline`, `boss-chat`, `boss-recruit-pipeline`. Auto-installed to `~/.codex/skills/` on postinstall.

## Dependencies

Only three runtime deps: `chrome-remote-interface`, `sharp`, `ws`. Zero devDependencies.
