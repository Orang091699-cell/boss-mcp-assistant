# boss-recruit-pipeline

Bundled search/recruit-page automation skill shipped with `boss-mcp-assistant` 2.x.

Package: `@orang091699/boss-mcp-assistant` (npm)
Source: `https://github.com/Orang091699-cell/boss-mcp-assistant`

This skill intentionally replaces legacy `boss-recruit-mcp` skill installs. It routes Boss search/recruit tasks to the unified CDP-only MCP tools:

- `run_recruit_pipeline`
- `start_recruit_pipeline_run`
- `get_recruit_pipeline_run`
- `pause_recruit_pipeline_run`
- `resume_recruit_pipeline_run`
- `cancel_recruit_pipeline_run`

Do not call the old `@reconcrap/boss-recruit-mcp` package from this skill.
