# Auto CMS

Agent-neutral automation CMS theme package.

## Requirements

- Node.js 22+, PHP 8.2+, Composer, MySQL.
- CMS at `E:\Project\cms` unless `CMS_ROOT` overrides it.
- Edge running with CDP on `127.0.0.1:9222` tab open.
- Stitch MCP connected in the host coding agent; see `mcp-setup.md`.

## Install and verify

```powershell
cd E:\Project\auto-cms
npm install
npm run build
npm test
node dist/cli.js doctor
```

## Run

```powershell
node dist/cli.js run --task-url "https://erp.xxx.xx/..."
```

Follow the returned `ACTION_REQUIRED` prompt and `nextCommand`. Runs live under `runs/<task-id>-<timestamp>` and can resume after a client restart.

## Commands

- `run --task-url <url>`: create or reuse a live task run.
- `next --run <id>` / `resume --run <id>`: continue deterministic stages.
- `submit --run <id> --token <token> --result <file>`: validate an agent result.
- `status --run <id>`: read-only status.
- `retry --run <id>`: retry failed/human-blocked stage.
- `cancel --run <id>`: stop the run.
- `report --run <id>`: locate final report.
- `qa --run <id> --base-url <url>`: run deterministic static, HTTP/SEO/link and responsive browser audits; emit run-owned evidence and a draft QA report.
- `refresh --run <id>`: revalidate/package a completed theme-owned repair and refresh its final report without changing submission tokens or stage history.
- `doctor`: environment diagnostics without credentials.

Stitch uses a resumable foundation-first batch plan. Set `AUTO_CMS_STITCH_CONCURRENCY` from 1 to 6 (default 3) to match MCP rate limits. Theme build and QA actions receive sitemap-focused runbooks instead of loading unrelated monolithic skills.

## Output

The completed run produces sitemap/design artifacts in CMS, theme source under `themes/<slug>`, a QA report, and `storage/app/themes/<slug>.zip`.
The final report also records stage durations, retry counts, action-context byte estimates, and total elapsed time.
