# Development roadmap

## Current status — 2026-08-02

- Protocol/CLI/state: complete.
- ERP Edge CDP ingestion: complete and verified with task 5089.
- Sitemap action/validation: complete and verified with five-page output.
- Stitch action/manifest validation: live verified; foundation-first resumable batching added.
- Theme generation action/static gates: live verified and packaged.
- QA evidence ownership, deterministic static/HTTP/SEO/link/browser audit, PHP lint, runtime lease, package/ZIP audit and SHA-256: live verified.
- Sitemap-focused action runbooks and stage/context metrics: implemented and tested.
- Agent onboarding/docs: complete.

## Next milestone

1. Run a second ERP task through the optimized workflow and compare final-report duration/context metrics with the first run.
2. Convert the remaining mutable database fixtures into transaction-backed CMS commands where model contracts are stable.
3. Add recorded sanitized Stitch contract tests and automatic plan status updates when MCP hosts expose a portable invocation API.

## Deferred by design

- Parallel non-Stitch workers and SQLite state.
- Direct Odoo API adapter.
- Browser fallback for Stitch.
- Production deployment or ERP write-back.
