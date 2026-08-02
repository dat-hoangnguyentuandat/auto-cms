import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunState } from './contracts.js';
import { writeJsonAtomic } from './utils.js';

export async function writeStitchPlan(run: RunState, runDir: string) {
  const sitemapArtifact = run.artifacts.find((item) => item.kind === 'sitemap');
  if (!sitemapArtifact) throw new Error('Missing sitemap artifact for Stitch plan');
  const sitemap = JSON.parse(await fs.readFile(sitemapArtifact.path, 'utf8'));
  const screens: string[] = Array.isArray(sitemap.stitch?.screens) ? sitemap.stitch.screens : [];
  const file = path.join(runDir, 'plans', 'stitch-plan.json');
  const existing = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null);
  const previous = new Map((existing?.screens || []).map((item: { pageId: string }) => [item.pageId, item]));
  const concurrency = Math.max(1, Math.min(6, Number(process.env.AUTO_CMS_STITCH_CONCURRENCY || 3)) || 3);
  await writeJsonAtomic(file, {
    version: 1, foundationScreen: screens.includes('home') ? 'home' : screens[0], concurrency,
    strategy: 'Generate the foundation first, reuse its design system, then batch independent screens. Retry only failed or missing variants.',
    screens: screens.map((pageId) => previous.get(pageId) || { pageId, desktop: 'pending', mobile: 'pending', attempts: 0 }),
  });
  return file;
}

export async function completeStitchPlan(runDir: string, submission: { projectId: string; screens: Array<{ pageId: string; desktop: string; mobile: string }> }) {
  const file = path.join(runDir, 'plans', 'stitch-plan.json');
  const plan = JSON.parse(await fs.readFile(file, 'utf8'));
  const completed = new Map(submission.screens.map((screen) => [screen.pageId, screen]));
  plan.projectId = submission.projectId; plan.completedAt = new Date().toISOString();
  plan.screens = plan.screens.map((item: { pageId: string; attempts?: number }) => {
    const screen = completed.get(item.pageId); return screen ? { ...item, desktop: 'complete', mobile: 'complete', attempts: Math.max(1, item.attempts || 0), artifacts: { desktop: screen.desktop, mobile: screen.mobile } } : item;
  });
  await writeJsonAtomic(file, plan);
}
