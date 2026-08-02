# Project changelog

## 2026-08-02

### Optimized

- Replaced monolithic build/QA skill loading with run-specific sitemap-focused runbooks.
- Added resumable Stitch foundation/batch plans with configurable concurrency and retry-only-missing guidance.
- Added `qa --run --base-url` for deterministic static, HTTP/SEO, internal-link and six-viewport browser evidence.
- Added explicit pending mutable-data fixtures so generated QA output remains a draft until real persistence/cleanup checks finish.
- Added per-stage duration, retry and action-context byte metrics to final reports.
- Restricted Vitest discovery to the automation test suite; 14 tests now cover the optimized lifecycle.
- Measured focused reference payloads: QA 12,467 bytes versus 711,657 bytes previously (98.25% lower); build 38,388 bytes versus 68,521 bytes (43.98% lower).
- Added product-completeness gates: Tin tức navigation/route coverage, full-bleed homepage hero, local asset provenance, non-ERP media supplementation, complete service/news grids, and settled lazy-image browser screenshots.
- Upgraded the verified Nha Khoa Kim Ngân theme to v1.1.0 with 7 services, 7 educational posts, licensed local imagery and a full-width identity hero.

### Added

- Agent-neutral TypeScript CLI with run, next, submit, status, resume, retry, cancel, report, and doctor commands.
- Atomic run state, strict task URL parsing, retry tracking, action protocol, and CMS lock.
- Authenticated Edge CDP ERP reader with redacted local evidence.
- Sitemap, Stitch design, theme build, QA, package, and final-report stages.
- Deterministic sitemap validation, design screen coverage, PHP lint, QA evidence, and ZIP content gates.
- Run-owned CMS runtime lease, package process lock, and package SHA-256 evidence.
- Provider-neutral `AGENTS.md`, MCP guide, ERP guide, README, architecture, and roadmap.
- Unit tests and dependency audit workflow.

### Verified

- Task 5089 ERP Description extracted successfully.
- Five-page Nha Khoa Kim Ngân sitemap validated successfully.
- TypeScript typecheck and build pass.
- Twelve unit/integration tests pass, including a real PHP subprocess and ZIP lifecycle from sitemap submission through final report.
- NPM audit reports zero vulnerabilities.

### Live completion

- Run `5089-1785670854880` completed with verified theme ZIP and SHA-256; no credentials are stored in the repository.
