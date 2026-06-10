# AGENTS.md — boss-mcp-assistant

## What this is

MCP server that automates BOSS直聘 (zhipin.com) via Chrome DevTools Protocol (CDP). Three domains: **recommend** (推荐页筛选), **chat** (聊天自动沟通), **recruit** (招聘搜索页批量处理).

## Entrypoints

- **MCP server**: `src/index.js` — started via `boss-mcp-assistant start` or `npm start`
- **CLI**: `src/cli.js` — subcommands via `boss-mcp-assistant <command>`
- **Bin**: `bin/boss-mcp-assistant.js` → `import { runCli } from "../src/cli.js"`

## Dev commands

```bash
npm start                       # node src/index.js (MCP server)
npm run cli                     # node src/cli.js (CLI)
npm run test:<name>             # individual test scripts in src/
npm run live:<name>             # live smoke tests (need Chrome + BOSS login)
npm run scan:runtime            # scan for forbidden Runtime.evaluate calls
npm run scan:runtime:strict     # same, exits non-zero on findings
npm run scan:legacy-boundary    # scan legacy package boundary
npm run scan:package-boundary   # scan new package boundary
npm run gate:phase9-static      # phase 9 static analysis gate
npm run gate:phase10-complete   # phase 10 completion gate
```

Tests are plain Node scripts in `src/` — no test framework. No lint/typecheck/formatter configured.

## CLI subcommands

| Command | Purpose |
|---------|---------|
| `config set --base-url --api-key --model` | Configure LLM API |
| `launch-chrome --port 9222` | Launch Chrome in debug mode |
| `start` | Start MCP server |
| `doctor` | Environment check |
| `where` | Show install/config paths |
| `init-config` | Create template config |
| `list-jobs` | List recommend jobs |
| `install` | Install skills/config (postinstall) |

## Architecture

```
src/
├── index.js              # MCP server (JSON-RPC, tool definitions)
├── cli.js                # CLI entry (all subcommands)
├── chat-mcp.js           # Chat MCP tool handlers
├── recommend-mcp.js      # Recommend MCP tool handlers
├── recruit-mcp.js        # Recruit MCP tool handlers
├── parser.js             # NL instruction parser for recommend
├── chat-runtime-config.js # screening-config resolution + LLM calls
├── run-state.js          # Run state persistence
├── core/                 # Shared automation modules
│   ├── browser/          # CDP connection, navigation, login
│   ├── run/              # Run statuses, RunCanceledError
│   ├── screening/        # Candidate screening logic
│   ├── self-heal/        # Page drift detection
│   ├── infinite-list/    # Infinite list scroll
│   ├── capture/          # Page capture/screenshots
│   ├── cv-acquisition/   # CV/resume acquisition
│   ├── greet-quota/      # Greet quota tracking
│   └── reporting/        # CSV report generation
└── domains/              # Domain-specific automation
    ├── recommend/        # (actions, cards, detail, filters, jobs, refresh, run-service)
    ├── chat/             # (cards, detail, jobs, page-guard, run-service)
    └── recruit/          # (actions, cards, detail, search, refresh, run-service)
```

## Critical constraints

- **NO `Runtime.evaluate`** — all browser automation uses CDP only (DOM, Network, Input, Accessibility, Page). Each tool output asserts `runtime_evaluate_used: false`. Enforced via `scripts/scan-forbidden-runtime.js`.
- Node >= 18, ESM (`"type": "module"`).

## Run lifecycle

Statuses: `queued` → `running` → `paused|completed|canceled|failed`
Stages: `preflight` → `page_ready` → `job_list` → `search` → `screen` → `chat_followup` → `finalize`

## Pipeline gates

Recommend/chat/recruit tools return `NEED_CONFIRMATION` with `pending_questions`. After user answers, re-call with `confirmation` fields set. Confirm only once per run; do not re-confirm per-candidate.

## Target count

`target_count` = **processed candidates** (not passed). "扫到底" / "all" / "unlimited" / "全部候选人" all canonicalize to `"all"`. Supports object form: `{ value: "all" }`. Pass `target_count="all"` when user says scan to end.

## Config: screening-config.json

Resolved from env var → `~/.boss-mcp-assistant/` → workspace `config/` → `~/.codex/boss-mcp-assistant/`. Key fields beyond baseUrl/apiKey/model:

- `llmThinkingLevel`: `"off" | "low" | "medium" | "high"`
- `dimensions`: weighted criteria array (name, weight, pass_score, criteria[])
- `score_thresholds`: `{ strong_recommend: 8.5, pass: 6.0 }`
- `recommend.on_pass` / `recommend.on_fail`: `"greet" | "favorite" | "close"`
- `chat.greeting_text` / `chat.rejection_text`

Update via `set_screening_config` tool or `boss-mcp-assistant config set` — no restart needed.

## State directories

| State | Default path | Override env var |
|-------|-------------|-----------------|
| Recommend runs | `~/.boss-mcp-assistant/runs/` | `BOSS_RECOMMEND_HOME` |
| Chat runtime | `~/.boss-mcp-assistant/boss-chat/` | `BOSS_CHAT_HOME` |
| Recruit runs | `~/.boss-recruit-mcp/runs/` | `BOSS_RECRUIT_HOME` |

## Env vars

- `BOSS_RECOMMEND_CHROME_PATH` — Chrome executable path for `launch-chrome`
- `BOSS_RECOMMEND_POLL_AFTER_SEC` — default poll interval (default 1800)
- `BOSS_RECOMMEND_LONG_POLL_AFTER_SEC` — long poll interval for recommend+chat (default 1800)
- `BOSS_RECOMMEND_MCP_CONFIG_TARGETS` — MCP config targets
- `BOSS_RECOMMEND_EXTERNAL_SKILL_DIRS` — external skill directories

## Skills

`skills/` contains SKILL.md + README for each domain. Auto-installed to `~/.codex/skills/` on postinstall.

## Tools

All names `snake_case`. Key tools by domain:
- **Recommend**: `start_recommend_pipeline_run`, `get_*`, `pause_*`, `resume_*`, `cancel_*`, `list_recommend_jobs`, `run_featured_calibration`, `get_featured_calibration_status`, `run_recommend_self_heal`
- **Chat**: `boss_chat_health_check`, `prepare_boss_chat_run`, `start_boss_chat_run`, `get_*`, `pause_*`, `resume_*`, `cancel_*`
- **Recruit**: `run_recruit_pipeline` (sync compat), `start_recruit_pipeline_run`, `get_*`, `pause_*`, `resume_*`, `cancel_*`
- **Config**: `set_screening_config`

## Dependencies

Three runtime deps: `chrome-remote-interface`, `sharp`, `ws`. Zero devDependencies.

## Notes

- `boss-mcp-assistant/` dir at repo root is pre-published package copy (has own node_modules, package.json) — not the source of truth.
- Postinstall runs `node src/cli.js install` (global) or `init-config` (local).
- Recruit domain uses `search.zhipin.com`, not the recommend chat page.
- No CI workflows, no opencode.json config in this repo.
