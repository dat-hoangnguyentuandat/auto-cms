import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeActionRunbook } from '../src/action-runbooks.js';
import { writeStitchPlan } from '../src/stitch-plan.js';
import type { RunState } from '../src/contracts.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-opt-')); roots.push(root);
  const cms = path.join(root, 'cms'); const runDir = path.join(root, 'runs', 'run-1'); const sitemap = path.join(cms, 'artifacts', 'sitemaps', 'demo', 'sitemap.json');
  await fs.mkdir(path.dirname(sitemap), { recursive: true });
  await fs.writeFile(sitemap, JSON.stringify({ pages: [{ id: 'home', route: '/' }, { id: 'reviews', route: '/danh-gia', template: 'review-listing' }], cms: { capabilities: ['testimonials'] }, stitch: { screens: ['home', 'reviews'] } }));
  const references = path.join(cms, '.agents', 'skills', 'theme-cms', 'references'); await fs.mkdir(references, { recursive: true });
  for (const name of ['validation.md', 'seo-gate.md', 'pagination.md', 'review-cards.md']) await fs.writeFile(path.join(references, name), `# ${name}`);
  const timestamp = new Date().toISOString();
  const run: RunState = { protocolVersion: '1.0', runId: 'run-1', taskId: '1', taskUrl: 'https://erp.19t.vn/web#id=1&model=project.task', slug: 'demo', stage: 'THEME_QA', status: 'RUNNING', attempts: {}, artifacts: [{ kind: 'sitemap', path: sitemap }], errors: [], createdAt: timestamp, updatedAt: timestamp };
  return { cms, runDir, run };
}

describe('optimization artifacts', () => {
  it('creates a focused QA runbook without the monolithic SEO skill', async () => {
    const { cms, runDir, run } = await fixture();
    const skill = await writeActionRunbook('THEME_QA', run, cms, runDir);
    const content = await fs.readFile(path.join(skill!, 'SKILL.md'), 'utf8');
    expect(content).toContain('node dist/cli.js qa');
    expect(content).toContain('seo-gate.md');
    expect(content).toContain('review-cards.md');
    expect(content).not.toContain('skills\\seo\\SKILL.md');
    await expect(fs.access(path.join(skill!, 'references', 'seo-gate.md'))).resolves.toBeUndefined();
  });

  it('persists Stitch screen status and configurable batch strategy', async () => {
    const { runDir, run } = await fixture(); run.stage = 'STITCH_DESIGN';
    const file = await writeStitchPlan(run, runDir); const initial = JSON.parse(await fs.readFile(file, 'utf8'));
    initial.screens[0] = { pageId: 'home', desktop: 'complete', mobile: 'complete', attempts: 1 };
    await fs.writeFile(file, JSON.stringify(initial));
    await writeStitchPlan(run, runDir); const resumed = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(resumed.foundationScreen).toBe('home'); expect(resumed.concurrency).toBeGreaterThanOrEqual(1);
    expect(resumed.screens[0]).toMatchObject({ pageId: 'home', desktop: 'complete', attempts: 1 });
    expect(resumed.screens[1]).toMatchObject({ pageId: 'reviews', desktop: 'pending' });
  });
});
