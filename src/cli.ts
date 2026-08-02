#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config.js';
import type { OutputEnvelope, RunState } from './contracts.js';
import { doctor } from './doctor.js';
import { Orchestrator } from './orchestrator.js';
import { runQa } from './qa-runner.js';

const program = new Command(); const config = loadConfig(); const orchestrator = new Orchestrator(config);

function envelope(run: RunState): OutputEnvelope {
  const nextCommand = run.status === 'ACTION_REQUIRED' && run.action
    ? `node dist/cli.js submit --run ${run.runId} --token ${run.action.submissionToken} --result "${run.action.expectedArtifacts[0]}"`
    : run.status === 'FAILED' || run.status === 'NEEDS_HUMAN' ? `node dist/cli.js retry --run ${run.runId}` : undefined;
  return { success: !['FAILED', 'NEEDS_HUMAN'].includes(run.status), status: run.status, runId: run.runId, stage: run.stage, action: run.action, result: { slug: run.slug, artifacts: run.artifacts, errors: run.errors }, nextCommand };
}

function print(value: unknown) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
async function execute(task: () => Promise<unknown>) {
  try { print(await task()); } catch (error) { print({ success: false, status: 'FAILED', error: { code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) } }); process.exitCode = 1; }
}

program.name('auto-cms').description('Agent-neutral ERP-to-CMS-theme workflow').version('0.1.0');
program.command('run').requiredOption('--task-url <url>').action((options) => execute(async () => envelope(await orchestrator.create(options.taskUrl))));
program.command('next').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.advance(await orchestrator.load(options.run)))));
program.command('submit').requiredOption('--run <id>').requiredOption('--token <token>').requiredOption('--result <file>').action((options) => execute(async () => envelope(await orchestrator.submit(options.run, options.token, options.result))));
program.command('status').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.load(options.run))));
program.command('resume').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.advance(await orchestrator.load(options.run)))));
program.command('retry').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.retry(options.run))));
program.command('cancel').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.cancel(options.run))));
program.command('report').requiredOption('--run <id>').action((options) => execute(async () => { const run = await orchestrator.load(options.run); return run.artifacts.find((item) => item.kind === 'final-report') || { status: run.status, available: false }; }));
program.command('doctor').action(() => execute(async () => ({ success: true, status: 'RUNNING', result: await doctor(config) })));
program.command('qa').requiredOption('--run <id>').requiredOption('--base-url <url>').action((options) => execute(async () => ({ success: true, status: 'ACTION_REQUIRED', runId: options.run, stage: 'THEME_QA', result: await runQa(config, await orchestrator.load(options.run), options.baseUrl) })));
program.command('refresh').requiredOption('--run <id>').action((options) => execute(async () => envelope(await orchestrator.refreshCompleted(options.run))));
program.parseAsync();
