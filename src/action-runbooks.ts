import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunState, Stage } from './contracts.js';

type Sitemap = { pages?: Array<{ template?: string; sections?: Array<{ type?: string }> }>; cms?: { capabilities?: string[] } };

async function loadSitemap(run: RunState): Promise<Sitemap> {
  const artifact = run.artifacts.find((item) => item.kind === 'sitemap');
  if (!artifact) return {};
  return JSON.parse(await fs.readFile(artifact.path, 'utf8')) as Sitemap;
}

export async function writeActionRunbook(stage: Stage, run: RunState, cmsRoot: string, runDir: string) {
  if (stage === 'SITEMAP') return path.join(cmsRoot, '.agents', 'skills', 'website-sitemap');
  if (!['THEME_BUILD', 'THEME_QA'].includes(stage)) return null;

  const sitemap = await loadSitemap(run);
  const serialized = JSON.stringify(sitemap).toLowerCase();
  const hasListings = /listing|services|products|news|reviews|testimonials/.test(serialized);
  const hasReviews = /review|testimonial|danh-gia/.test(serialized);
  const hasCommerce = /products|commerce|san-pham|sản phẩm|shop|store/.test(serialized);
  const references = stage === 'THEME_BUILD'
    ? ['core-runtime.md', 'theme-structure.md', 'cms-data-routes.md', 'internal-links.md', 'widgets-registry.md', 'widget-schema.md', 'seed-data.md', 'global-shell.md', 'frontend-quality.md', 'assets-cache.md']
    : ['validation.md', 'seo-gate.md'];
  if (hasListings) references.push('pagination.md');
  if (hasReviews) references.push('review-cards.md');
  if (hasCommerce) references.push('commerce-sell.md');

  const dir = path.join(runDir, 'runbooks', stage.toLowerCase());
  const referenceDir = path.join(dir, 'references');
  await fs.mkdir(referenceDir, { recursive: true });
  for (const item of references) await fs.copyFile(path.join(cmsRoot, '.agents', 'skills', 'theme-cms', 'references', item), path.join(referenceDir, item));
  const title = stage === 'THEME_BUILD' ? 'Focused CMS theme build' : 'Focused CMS theme QA';
  const workflow = stage === 'THEME_BUILD'
    ? `Build only themes/${run.slug}. Read the brief, sitemap, DESIGN.md and approved images. Inspect themes/default and widget variants before implementation. Create the manifest, registry, seed, shared layout, route views and versioned assets. Keep content editable, URLs subfolder-safe and CMS core unchanged. Compile before submission.`
    : `Run the deterministic audit first:\n\n    node dist/cli.js qa --run ${run.runId} --base-url <PUBLIC_BASE_URL>\n\nRead its evidence and fix every Critical/High issue inside theme ownership. Then perform only the pending mutable-data fixtures listed in qa-draft.json (uploads, form persistence/cleanup, pagination and review edge cases when applicable). Merge real fixture evidence into submissions/qa-report.json. Never claim a check that was not executed.`;
  const content = `---\nname: auto-cms-${stage.toLowerCase()}\ndescription: Run-specific compact contract generated from the validated sitemap.\n---\n\n# ${title}\n\n${workflow}\n\n## Applicable references\n\nRead only these copied phase-specific CMS contracts completely:\n${references.map((item) => `- references/${item}`).join('\n')}\n\n## Release invariants\n\n- Preserve factual ERP content; do not invent claims.\n- Keep one shared header/footer shell, editable widget data and valid internal routes.\n- Primary navigation includes Tin tức (/tin-tuc) unless the ERP explicitly opts out.\n- Homepage hero is a full-bleed image banner with readable overlay, never a half-width split image.\n- Treat ERP images as factual evidence, not the complete media library. Add generated or licensed web assets for complete service/news content and record every source in assets/ASSET-SOURCES.json.\n- Require zero Critical and zero High findings. Medium/Low findings must be recorded.\n- Do not modify CMS core, bypass Stitch, reset the database or fabricate evidence.\n`;
  await fs.writeFile(path.join(dir, 'SKILL.md'), content, 'utf8');
  return dir;
}
