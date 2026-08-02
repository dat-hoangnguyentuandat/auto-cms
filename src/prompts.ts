import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunState, Stage } from './contracts.js';

const stageInstructions: Record<Exclude<Stage, 'ERP_READ' | 'PACKAGE' | 'FINAL_REPORT'>, (run: RunState, cms: string, runDir: string) => string> = {
  SITEMAP: (run, cms, dir) => `Use the website-sitemap skill at ${cms}\\.agents\\skills\\website-sitemap.\nRead ${dir}\\brief.json and ERP evidence. Create and validate ${cms}\\artifacts\\sitemaps\\<site-slug>\\sitemap.json, sitemap.md, and stitch-prompt.md. Include the CMS Tin tức listing in primary navigation and page coverage unless the ERP task explicitly opts out. ERP images are evidence, not a complete media library. Write ${dir}\\submissions\\sitemap.json containing {"slug":"<site-slug>","sitemapPath":"<absolute-path>"}.`,
  STITCH_DESIGN: (run, cms, dir) => `Read ${path.join(dir, 'submissions', 'sitemap.json')} and ${path.join(dir, 'brief.json')}. Use the configured Stitch MCP and the persisted batch plan supplied below. Generate the foundation screen first, reuse its design system, then execute independent desktop/mobile screens up to the plan concurrency. Update plan status and attempts after each call so resume retries only missing/failed variants. Save approved artifacts under ${cms}\\artifacts\\designs\\<site-slug>. Submit ${dir}\\submissions\\design-manifest.json with projectId, slug, designMd, and screens[{pageId,desktop,mobile}]. Do not include credentials.`,
  THEME_BUILD: (run, cms, dir) => `Read the focused theme runbook. Read brief, validated sitemap, approved DESIGN.md, and screen images. Build only ${cms}\\themes\\${run.slug || '<slug>'}. Use ERP images for factual identity, then generate or source licensed web images to complete service/news/editorial surfaces. Store local files and provenance in assets/ASSET-SOURCES.json. The homepage hero must be a full-bleed banner, not a split half-image layout. Do not modify CMS core. Compile and write ${dir}\\submissions\\theme-build.json containing {"slug":"...","themePath":"...","compilePassed":true}.`,
  THEME_QA: (run, cms, dir) => `Validate the theme with the theme-cms completion gates: static/runtime routes, links, pagination, footer, reviews, responsive viewports, uploads, SEO, and package readiness. Fix failures within theme ownership and rerun. Store screenshots/logs under ${dir}\\reports\\qa and write ${dir}\\submissions\\qa-report.json containing {"passed":true,"critical":0,"high":0,"checks":[...],"evidence":["absolute paths under the run directory"]}. Never mark passed without running checks.`,
};

export async function writeStagePrompt(stage: keyof typeof stageInstructions, run: RunState, cmsRoot: string, runDir: string, stitchPlan?: string) {
  const dir = path.join(runDir, 'prompts');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${stage.toLowerCase()}.md`);
  const header = `# Auto CMS action: ${stage}\n\nRun ID: ${run.runId}\nERP task: ${run.taskUrl}\n\n`;
  const plan = stitchPlan ? `\nPersisted Stitch plan: ${stitchPlan}\n` : '';
  await fs.writeFile(file, `${header}${stageInstructions[stage](run, cmsRoot, runDir)}${plan}\n`, 'utf8');
  return file;
}
