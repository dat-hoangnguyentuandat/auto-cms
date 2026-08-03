# Development roadmap

## Current status — 2026-08-03

- Protocol/CLI/state: complete.
- ERP Edge CDP ingestion: complete and verified with task 5089.
- Sitemap action/validation: complete and verified with five-page output.
- Stitch action/manifest validation: live verified; foundation-first resumable batching added.
- Theme generation action/static gates: live verified and packaged.
- QA evidence ownership, deterministic static/HTTP/SEO/link/browser audit, PHP lint, runtime lease, package/ZIP audit and SHA-256: live verified.
- Sitemap-focused action runbooks and stage/context metrics: implemented and tested.
- Agent onboarding/docs: complete.
- Theme quality skill script, source/evidence fingerprinted QA gate, stale-evidence rejection, and fast representative screenshot strategy: implemented and benchmarked.

## Next milestone

1. Convert the remaining mutable database fixtures into transaction-backed CMS commands where model contracts are stable.
2. Add locale coverage scoring and template-family route sampling to deterministic QA.
3. Add recorded sanitized Stitch contract tests and automatic plan status updates when MCP hosts expose a portable invocation API.

## Deferred by design

- Parallel non-Stitch workers and SQLite state.
- Direct Odoo API adapter.
- Browser fallback for Stitch.
- Production deployment or ERP write-back.
