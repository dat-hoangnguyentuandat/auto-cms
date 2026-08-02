import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Orchestrator } from '../src/orchestrator.js';
import { RunStore } from '../src/run-store.js';
import type { AgentAction, RunState, Stage } from '../src/contracts.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));
const json = (file: string, value: unknown) => fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, JSON.stringify(value)));

function action(stage: Stage, runDir: string, file: string): AgentAction {
  return { id: `${stage}-action`, stage, promptFile: path.join(runDir, 'prompt.md'), skills: [], allowedWriteRoots: [runDir], expectedArtifacts: [file], submissionToken: `${stage}-submission-token-123456` };
}

describe('full downstream lifecycle', () => {
  it('validates submissions, packages a real ZIP, and completes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-e2e-')); roots.push(root);
    const cms = path.join(root, 'cms'); const runs = path.join(root, 'runs'); const runId = '5089-e2e'; const runDir = path.join(runs, runId); const slug = 'demo-theme';
    const sitemapDir = path.join(cms, 'artifacts', 'sitemaps', slug); const designDir = path.join(cms, 'artifacts', 'designs', slug); const themeDir = path.join(cms, 'themes', slug);
    await fs.mkdir(path.join(cms, '.agents', 'skills', 'website-sitemap', 'scripts'), { recursive: true });
    await fs.writeFile(path.join(cms, '.agents', 'skills', 'website-sitemap', 'scripts', 'validate_sitemap.js'), "const fs=require('fs');const x=JSON.parse(fs.readFileSync(process.argv[2]));process.exit(x.schemaVersion==='2.0'?0:1)");
    await fs.writeFile(path.join(cms, '.agents', 'skills', 'website-sitemap', 'scripts', 'package.json'), '{"type":"commonjs"}');
    const themeReferences = path.join(cms, '.agents', 'skills', 'theme-cms', 'references'); await fs.mkdir(themeReferences, { recursive: true });
    for (const name of ['core-runtime.md', 'theme-structure.md', 'cms-data-routes.md', 'internal-links.md', 'widgets-registry.md', 'widget-schema.md', 'seed-data.md', 'global-shell.md', 'frontend-quality.md', 'assets-cache.md', 'pagination.md', 'validation.md', 'seo-gate.md']) await fs.writeFile(path.join(themeReferences, name), `# ${name}`);
    const sitemapPath = path.join(sitemapDir, 'sitemap.json');
    await json(sitemapPath, { schemaVersion: '2.0', site: { slug }, pages: [{ id: 'home' }], stitch: { screens: ['home'] } });
    await fs.writeFile(path.join(sitemapDir, 'sitemap.md'), '# sitemap'); await fs.writeFile(path.join(sitemapDir, 'stitch-prompt.md'), '# prompt');
    await fs.mkdir(designDir, { recursive: true });
    for (const file of ['DESIGN.md', 'home-desktop.png', 'home-mobile.png']) await fs.writeFile(path.join(designDir, file), 'evidence');
    await fs.mkdir(themeDir, { recursive: true }); await json(path.join(themeDir, 'theme.json'), { name: 'Demo', slug });
    await fs.writeFile(path.join(themeDir, 'widgets.php'), '<?php return [];'); await fs.writeFile(path.join(themeDir, 'seed.php'), '<?php return [];');
    await fs.mkdir(path.join(themeDir, 'assets', 'images'), { recursive: true }); await fs.writeFile(path.join(themeDir, 'assets', 'images', 'erp.jpg'), 'erp'); await fs.writeFile(path.join(themeDir, 'assets', 'images', 'generated.jpg'), 'generated');
    await json(path.join(themeDir, 'assets', 'ASSET-SOURCES.json'), { version: 1, assets: [{ path: 'images/erp.jpg', sourceType: 'erp', sourceUrl: 'ERP evidence' }, { path: 'images/generated.jpg', sourceType: 'generated', sourceUrl: 'host image tool' }] });
    const artisan = `<?php
$slug=$argv[2];$out=__DIR__.DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'app'.DIRECTORY_SEPARATOR.'themes'.DIRECTORY_SEPARATOR.$slug.'.zip';
@mkdir(dirname($out),0777,true);$zip=new ZipArchive();$zip->open($out,ZipArchive::CREATE|ZipArchive::OVERWRITE);
$base=__DIR__.DIRECTORY_SEPARATOR.'themes'.DIRECTORY_SEPARATOR.$slug;foreach(['theme.json','widgets.php','seed.php'] as $f){$zip->addFile($base.DIRECTORY_SEPARATOR.$f,$f);}$zip->addFile($base.DIRECTORY_SEPARATOR.'assets'.DIRECTORY_SEPARATOR.'ASSET-SOURCES.json','assets/ASSET-SOURCES.json');$zip->close();
`;
    await fs.writeFile(path.join(cms, 'artisan'), artisan);
    const sitemapSubmission = path.join(runDir, 'submissions', 'sitemap.json'); await json(sitemapSubmission, { slug, sitemapPath });
    const timestamp = new Date().toISOString(); const firstAction = action('SITEMAP', runDir, sitemapSubmission);
    const run: RunState = { protocolVersion: '1.0', runId, taskId: '5089', taskUrl: 'https://erp.19t.vn/web#id=5089&model=project.task', slug: undefined, stage: 'SITEMAP', status: 'ACTION_REQUIRED', attempts: {}, artifacts: [], errors: [], action: firstAction, createdAt: timestamp, updatedAt: timestamp };
    const store = new RunStore(runs); await store.save(run);
    const orchestrator = new Orchestrator({ projectRoot: root, cmsRoot: cms, runsRoot: runs, cdpUrl: 'http://127.0.0.1:9222', maxRetries: 3 });
    let current = await orchestrator.submit(runId, firstAction.submissionToken, sitemapSubmission); expect(current.stage).toBe('STITCH_DESIGN');
    const designSubmission = path.join(runDir, 'submissions', 'design-manifest.json'); await json(designSubmission, { projectId: 'stitch-project', slug, designMd: path.join(designDir, 'DESIGN.md'), screens: [{ pageId: 'home', desktop: path.join(designDir, 'home-desktop.png'), mobile: path.join(designDir, 'home-mobile.png') }] });
    current = await orchestrator.submit(runId, current.action!.submissionToken, designSubmission); expect(current.stage).toBe('THEME_BUILD');
    const themeSubmission = path.join(runDir, 'submissions', 'theme-build.json'); await json(themeSubmission, { slug, themePath: themeDir, compilePassed: true });
    current = await orchestrator.submit(runId, current.action!.submissionToken, themeSubmission); expect(current.stage).toBe('THEME_QA');
    const evidence = path.join(runDir, 'reports', 'qa', 'result.txt'); await fs.mkdir(path.dirname(evidence), { recursive: true }); await fs.writeFile(evidence, 'routes and responsive checks passed');
    const qaSubmission = path.join(runDir, 'submissions', 'qa-report.json'); await json(qaSubmission, { passed: true, critical: 0, high: 0, checks: ['routes', 'responsive'], evidence: [evidence] });
    current = await orchestrator.submit(runId, current.action!.submissionToken, qaSubmission);
    expect(current.status).toBe('COMPLETED'); expect(current.artifacts.some((item) => item.kind === 'theme-package' && item.sha256)).toBe(true); expect(current.artifacts.some((item) => item.kind === 'final-report')).toBe(true);
    expect(current.metrics?.map((item) => item.stage)).toEqual(['SITEMAP', 'STITCH_DESIGN', 'THEME_BUILD', 'THEME_QA', 'PACKAGE', 'FINAL_REPORT']);
    expect(current.metrics?.find((item) => item.stage === 'THEME_QA')?.actionContextBytes).toBeGreaterThan(0);
  }, 30000);
});
