import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from './config.js';
import { stages, type AgentAction, type RunState, type Stage } from './contracts.js';
import { readErpTask } from './erp-reader.js';
import { packageTheme } from './package-theme.js';
import { FileLock } from './file-lock.js';
import { RunLease } from './run-lease.js';
import { writeStagePrompt } from './prompts.js';
import { RunStore } from './run-store.js';
import { parseTaskUrl } from './task-url.js';
import { now, randomId, randomToken, redact, writeJsonAtomic } from './utils.js';
import { validateDesignSubmission, validateQaSubmission, validateSitemapSubmission, validateThemeSubmission } from './validators.js';
import { checkThemeStatic } from './theme-static-check.js';
import { writeActionRunbook } from './action-runbooks.js';
import { completeStitchPlan, writeStitchPlan } from './stitch-plan.js';

const nextStage: Record<Stage, Stage | null> = { ERP_READ: 'SITEMAP', SITEMAP: 'STITCH_DESIGN', STITCH_DESIGN: 'THEME_BUILD', THEME_BUILD: 'THEME_QA', THEME_QA: 'PACKAGE', PACKAGE: 'FINAL_REPORT', FINAL_REPORT: null };
const actionStages = new Set<Stage>(['SITEMAP', 'STITCH_DESIGN', 'THEME_BUILD', 'THEME_QA']);

export class Orchestrator {
  private store: RunStore;
  private cmsLock: FileLock;
  private cmsLease: RunLease;
  constructor(private config: AppConfig) {
    this.store = new RunStore(config.runsRoot);
    this.cmsLock = new FileLock(path.join(config.projectRoot, 'data', 'cms-package.lock'));
    this.cmsLease = new RunLease(path.join(config.projectRoot, 'data', 'cms-runtime.lease'));
  }

  async create(taskUrl: string) {
    const task = parseTaskUrl(taskUrl); const existing = await this.store.findByTask(task.taskId);
    if (existing && existing.status !== 'CANCELLED') return existing;
    const timestamp = now();
    const run: RunState = { protocolVersion: '1.0', runId: `${task.taskId}-${Date.now()}`, taskId: task.taskId, taskUrl: task.url, stage: 'ERP_READ', status: 'RUNNING', attempts: {}, artifacts: [], errors: [], metrics: [], stageStartedAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
    await this.store.save(run); return this.advance(run);
  }

  async load(runId: string) { return this.store.load(runId); }

  async advance(run: RunState): Promise<RunState> {
    if (['COMPLETED', 'CANCELLED', 'NEEDS_HUMAN', 'FAILED'].includes(run.status)) return run;
    try {
      if (run.stage === 'ERP_READ') {
        await readErpTask(this.config.cdpUrl, run.taskUrl, run.taskId, this.store.directory(run.runId));
        return this.move(run, 'SITEMAP');
      }
      if (actionStages.has(run.stage)) return this.ensureAction(run);
      if (run.stage === 'PACKAGE') {
        if (!run.slug) throw new Error('Missing theme slug');
        await this.cmsLock.acquire(run.runId);
        try {
          await checkThemeStatic(path.join(this.config.cmsRoot, 'themes', run.slug));
          const result = await packageTheme(this.config.cmsRoot, run.slug);
          run.artifacts.push({ kind: 'theme-package', path: result.packagePath, sha256: result.sha256 });
          return this.move(run, 'FINAL_REPORT');
        } finally { await this.cmsLock.release(run.runId); }
      }
      if (run.stage === 'FINAL_REPORT') return this.finish(run);
      return run;
    } catch (error) { return this.failAttempt(run, error); }
  }

  async submit(runId: string, token: string, resultFile: string) {
    const run = await this.store.load(runId);
    if (run.status !== 'ACTION_REQUIRED' || !run.action) throw new Error('Run has no pending action');
    if (run.action.submissionToken !== token) throw new Error('Invalid submission token');
    try {
      const stage = run.stage;
      if (stage === 'SITEMAP') { const result = await validateSitemapSubmission(resultFile, this.config.cmsRoot); run.slug = result.slug; run.artifacts.push({ kind: 'sitemap', path: result.sitemapPath }); }
      else if (stage === 'STITCH_DESIGN') {
        const sitemapArtifact = run.artifacts.find((item) => item.kind === 'sitemap'); if (!sitemapArtifact) throw new Error('Missing sitemap artifact');
        const sitemap = JSON.parse(await fs.readFile(sitemapArtifact.path, 'utf8')); const expectedScreens = Array.isArray(sitemap.stitch?.screens) ? sitemap.stitch.screens : [];
        const result = await validateDesignSubmission(resultFile, this.config.cmsRoot, run.slug!, expectedScreens); await completeStitchPlan(this.store.directory(run.runId), result); run.artifacts.push({ kind: 'design', path: result.designMd });
      }
      else if (stage === 'THEME_BUILD') { const result = await validateThemeSubmission(resultFile, this.config.cmsRoot, run.slug!); await checkThemeStatic(result.themePath); run.artifacts.push({ kind: 'theme-source', path: result.themePath }); }
      else if (stage === 'THEME_QA') { await validateQaSubmission(resultFile, this.store.directory(run.runId), path.join(this.config.cmsRoot, 'themes', run.slug!)); await checkThemeStatic(path.join(this.config.cmsRoot, 'themes', run.slug!)); run.artifacts.push({ kind: 'qa-report', path: path.resolve(resultFile) }); await this.cmsLease.release(run.runId); }
      const completedAction = run.action; run.action = undefined; run.status = 'RUNNING'; return this.move(run, nextStage[stage]!, completedAction);
    } catch (error) { return this.failAttempt(run, error); }
  }

  private async move(run: RunState, stage: Stage, completedAction?: AgentAction) {
    const completedAt = now(); const startedAt = run.stageStartedAt || run.updatedAt;
    const action = completedAction || run.action;
    run.metrics ||= []; run.metrics.push({ stage: run.stage, startedAt, completedAt, durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), attempts: run.attempts[run.stage] || 0, actionContextBytes: action ? await this.actionContextBytes(action) : undefined });
    run.stage = stage; run.stageStartedAt = completedAt; run.status = 'RUNNING'; run.updatedAt = completedAt; await this.store.save(run); return this.advance(run);
  }
  private async ensureAction(run: RunState) {
    if (run.action) return run;
    if (run.stage === 'THEME_QA') await this.cmsLease.acquire(run.runId);
    const runDir = this.store.directory(run.runId);
    const stitchPlan = run.stage === 'STITCH_DESIGN' ? await writeStitchPlan(run, runDir) : undefined;
    const promptFile = await writeStagePrompt(run.stage as 'SITEMAP' | 'STITCH_DESIGN' | 'THEME_BUILD' | 'THEME_QA', run, this.config.cmsRoot, runDir, stitchPlan);
    const expected: Record<string, string[]> = { SITEMAP: [path.join(runDir, 'submissions', 'sitemap.json')], STITCH_DESIGN: [path.join(runDir, 'submissions', 'design-manifest.json')], THEME_BUILD: [path.join(runDir, 'submissions', 'theme-build.json')], THEME_QA: [path.join(runDir, 'submissions', 'qa-report.json')] };
    const focusedRunbook = await writeActionRunbook(run.stage, run, this.config.cmsRoot, runDir);
    const skills: Record<string, string[]> = { SITEMAP: focusedRunbook ? [focusedRunbook] : [], STITCH_DESIGN: [], THEME_BUILD: focusedRunbook ? [focusedRunbook] : [], THEME_QA: focusedRunbook ? [focusedRunbook] : [] };
    const action: AgentAction = { id: randomId(), stage: run.stage, promptFile, skills: skills[run.stage], allowedWriteRoots: [runDir, this.config.cmsRoot], expectedArtifacts: expected[run.stage], submissionToken: randomToken() };
    await fs.mkdir(path.join(runDir, 'submissions'), { recursive: true }); run.action = action; run.status = 'ACTION_REQUIRED'; run.updatedAt = now(); await this.store.save(run); return run;
  }

  private async actionContextBytes(action: AgentAction) {
    const size = async (candidate: string): Promise<number> => {
      const stat = await fs.stat(candidate).catch(() => null); if (!stat) return 0; if (stat.isFile()) return stat.size;
      const entries = await fs.readdir(candidate); return (await Promise.all(entries.map((entry) => size(path.join(candidate, entry))))).reduce((sum, value) => sum + value, 0);
    };
    return size(action.promptFile).then(async (promptBytes) => promptBytes + (await Promise.all(action.skills.map(size))).reduce((sum, value) => sum + value, 0));
  }

  private async failAttempt(run: RunState, error: unknown) {
    const message = redact(error instanceof Error ? error.message : String(error)); const attempts = (run.attempts[run.stage] || 0) + 1; run.attempts[run.stage] = attempts;
    run.errors.push({ code: message.split(':')[0].replace(/\W+/g, '_').toUpperCase(), message, stage: run.stage, at: now() }); run.status = attempts >= this.config.maxRetries ? 'NEEDS_HUMAN' : 'FAILED'; run.updatedAt = now(); await this.store.save(run); return run;
  }

  private async finish(run: RunState) {
    const completedAt = now(); const startedAt = run.stageStartedAt || run.updatedAt; run.metrics ||= [];
    run.metrics.push({ stage: 'FINAL_REPORT', startedAt, completedAt, durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), attempts: run.attempts.FINAL_REPORT || 0 });
    const report = { runId: run.runId, taskId: run.taskId, taskUrl: run.taskUrl, slug: run.slug, status: 'COMPLETED', artifacts: run.artifacts, metrics: run.metrics, totalDurationMs: Math.max(0, Date.parse(completedAt) - Date.parse(run.createdAt)), completedAt, errors: run.errors };
    const reportFile = path.join(this.store.directory(run.runId), 'reports', 'final-report.json'); await writeJsonAtomic(reportFile, report); run.artifacts.push({ kind: 'final-report', path: reportFile }); run.status = 'COMPLETED'; run.completedAt = completedAt; run.updatedAt = completedAt; await this.store.save(run); return run;
  }

  async retry(runId: string) { const run = await this.store.load(runId); if (!['FAILED', 'NEEDS_HUMAN'].includes(run.status)) throw new Error('Only failed or human-blocked runs can retry'); run.status = 'RUNNING'; run.action = undefined; run.updatedAt = now(); await this.store.save(run); return this.advance(run); }
  async refreshCompleted(runId: string) {
    const run = await this.store.load(runId); if (run.status !== 'COMPLETED' || !run.slug) throw new Error('Only a completed run with a theme can refresh');
    await this.cmsLock.acquire(run.runId);
    try {
      await checkThemeStatic(path.join(this.config.cmsRoot, 'themes', run.slug));
      const result = await packageTheme(this.config.cmsRoot, run.slug);
      run.artifacts = run.artifacts.filter((item) => item.kind !== 'theme-package' && item.kind !== 'qa-automated-draft');
      run.artifacts.push({ kind: 'theme-package', path: result.packagePath, sha256: result.sha256 });
      const draft = path.join(this.store.directory(run.runId), 'reports', 'qa', 'qa-draft.json');
      if (await fs.access(draft).then(() => true).catch(() => false)) run.artifacts.push({ kind: 'qa-automated-draft', path: draft });
      const report = { runId: run.runId, taskId: run.taskId, taskUrl: run.taskUrl, slug: run.slug, status: 'COMPLETED', artifacts: run.artifacts, metrics: run.metrics || [], totalDurationMs: Math.max(0, Date.parse(run.completedAt || run.updatedAt) - Date.parse(run.createdAt)), completedAt: run.completedAt || run.updatedAt, refreshedAt: now(), errors: run.errors, note: 'Package and deterministic QA evidence refreshed after theme-owned changes. Any pending mutable fixture remains explicitly listed in qa-draft.json.' };
      const reportFile = path.join(this.store.directory(run.runId), 'reports', 'final-report.json'); await writeJsonAtomic(reportFile, report); run.artifacts = run.artifacts.filter((item) => item.kind !== 'final-report'); run.artifacts.push({ kind: 'final-report', path: reportFile }); run.updatedAt = now(); await this.store.save(run); return run;
    } finally { await this.cmsLock.release(run.runId); }
  }
  async cancel(runId: string) { const run = await this.store.load(runId); run.status = 'CANCELLED'; run.updatedAt = now(); run.action = undefined; await this.cmsLease.release(run.runId); await this.store.save(run); return run; }
}
