import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { assertInside } from './utils.js';
import { validateQaGate, type QaGate } from './qa-gate.js';

const sitemapSubmission = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), sitemapPath: z.string() });
const designSubmission = z.object({
  projectId: z.string().min(1), slug: z.string().min(1), designMd: z.string(),
  screens: z.array(z.object({ pageId: z.string(), desktop: z.string(), mobile: z.string() })).min(1),
});
const themeSubmission = z.object({ slug: z.string(), themePath: z.string(), compilePassed: z.literal(true) });
const qaSubmission = z.object({ passed: z.literal(true), critical: z.literal(0), high: z.literal(0), checks: z.array(z.unknown()).min(1), evidence: z.array(z.string()).min(1) });

async function readJson(file: string) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function requireFiles(files: string[]) { for (const file of files) await fs.access(file); }
function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false }); let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Sitemap validation failed: ${output}`)));
  });
}

export async function validateSitemapSubmission(file: string, cmsRoot: string) {
  const data = sitemapSubmission.parse(await readJson(file));
  assertInside(path.join(cmsRoot, 'artifacts', 'sitemaps'), data.sitemapPath);
  const dir = path.dirname(data.sitemapPath);
  if (path.basename(dir) !== data.slug) throw new Error('Sitemap folder must match slug');
  await requireFiles([data.sitemapPath, path.join(dir, 'sitemap.md'), path.join(dir, 'stitch-prompt.md')]);
  const validator = path.join(cmsRoot, '.agents', 'skills', 'website-sitemap', 'scripts', 'validate_sitemap.js');
  await run('node', [validator, data.sitemapPath, '--project-root', cmsRoot], cmsRoot);
  const sitemap = await readJson(data.sitemapPath);
  if (sitemap.schemaVersion !== '2.0' || sitemap.site?.slug !== data.slug || !Array.isArray(sitemap.pages) || !sitemap.pages.length) throw new Error('Invalid sitemap contract');
  return { ...data, sitemap };
}

export async function validateDesignSubmission(file: string, cmsRoot: string, expectedSlug: string, expectedScreens: string[]) {
  const data = designSubmission.parse(await readJson(file));
  if (data.slug !== expectedSlug) throw new Error('Design slug mismatch');
  const root = path.join(cmsRoot, 'artifacts', 'designs', data.slug);
  assertInside(root, data.designMd);
  const files = [data.designMd, ...data.screens.flatMap((screen) => [screen.desktop, screen.mobile])];
  for (const candidate of files) assertInside(root, candidate);
  await requireFiles(files);
  const submitted = new Set(data.screens.map((screen) => screen.pageId));
  const missing = expectedScreens.filter((screen) => !submitted.has(screen));
  if (missing.length) throw new Error(`Missing Stitch screens: ${missing.join(', ')}`);
  return data;
}

export async function validateThemeSubmission(file: string, cmsRoot: string, expectedSlug: string) {
  const data = themeSubmission.parse(await readJson(file));
  if (data.slug !== expectedSlug) throw new Error('Theme slug mismatch');
  const expected = path.join(cmsRoot, 'themes', data.slug);
  if (path.resolve(data.themePath) !== path.resolve(expected)) throw new Error('Unexpected theme path');
  await requireFiles([path.join(expected, 'theme.json'), path.join(expected, 'widgets.php'), path.join(expected, 'seed.php')]);
  return data;
}

export async function validateQaSubmission(file: string, allowedEvidenceRoot: string, expectedThemePath: string) {
  const data = qaSubmission.parse(await readJson(file));
  for (const evidence of data.evidence) { assertInside(allowedEvidenceRoot, evidence); await fs.access(path.resolve(evidence)); }
  const gateFile = path.join(allowedEvidenceRoot, 'reports', 'qa', 'qa-gate.json');
  if (!data.evidence.some((item) => path.resolve(item) === path.resolve(gateFile))) throw new Error('QA report must include deterministic qa-gate.json evidence');
  const gate = await validateQaGate(await readJson(gateFile) as QaGate, expectedThemePath);
  const submitted = new Set(data.evidence.map((item) => path.resolve(item)));
  const missing = gate.evidence.filter((item) => !submitted.has(path.resolve(item.path)));
  if (missing.length) throw new Error(`QA report omitted deterministic evidence: ${missing.map((item) => item.path).join(', ')}`);
  return data;
}
