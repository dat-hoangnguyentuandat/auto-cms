# System architecture

## Purpose

`auto-cms` is an agent-neutral, resumable protocol that turns an authorized ERP task into a packaged Laravel CMS theme. Deterministic code owns state and validation; the host coding agent owns reasoning-heavy actions through project skills and Stitch MCP.

## Components

- CLI: command parsing and JSON envelopes.
- Orchestrator: strict stage transitions and retry state.
- Run store: atomic `run.json` persistence under `runs/<run-id>`.
- ERP adapter: read-only Edge CDP extraction; no session persistence.
- Agent actions: prompt, skills, allowed roots, expected artifacts, submission token.
- Focused runbooks: generated from sitemap capabilities so each action loads only applicable CMS references.
- Stitch plan: foundation-first, concurrency-limited screen plan whose statuses survive resume.
- QA runner: deterministic static, rendered HTTP/SEO/link and six-viewport browser evidence with an explicit mutable-fixture remainder.
- Validators: sitemap contract, design coverage, theme structure/PHP syntax, QA evidence.
- CMS adapter: Artisan theme packaging and ZIP audit.
- Run lease: reserves the shared CMS from `THEME_QA` action creation through validated submission, surviving agent restarts.
- Process lock: serializes package execution and rejects a live competing process.
- Metrics: stage duration, retry count and action-context bytes are recorded in final evidence.

## State flow

```text
ERP_READ → SITEMAP → STITCH_DESIGN → THEME_BUILD
         → THEME_QA → PACKAGE → FINAL_REPORT
```

AI stages return `ACTION_REQUIRED`. The agent executes the focused prompt/runbook and submits a file. Invalid submissions keep the stage retryable and never advance silently. QA automation creates a draft only; upload, persistence, pagination and review fixtures remain required when sitemap capabilities call for them.

## Source hierarchy

ERP facts override sitemap inference. Sitemap controls routes, models, capabilities, and content intent. Approved Stitch artifacts control presentation. Stitch code is reference only. CMS theme contracts control implementation and QA.

## Security boundaries

- Supported ERP host/model are allowlisted.
- CDP connects only to configured local endpoint.
- Paths are checked against allowed artifact/theme roots.
- API keys, headers, cookies, and local storage are never persisted.
- Static PHP checks and package forbidden-file checks run independently of agent claims.
- Production database reset/cleanup is not part of the automation.

## External dependency

Stitch remains host-MCP controlled because credentials must not enter the run. The persisted plan prevents completed screen variants from being regenerated after a host restart or rate-limit failure.
