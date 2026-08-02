import fs from 'node:fs/promises';
import path from 'node:path';
import { runSchema, type RunState } from './contracts.js';
import { assertInside, writeJsonAtomic } from './utils.js';

export class RunStore {
  constructor(private readonly root: string) {}
  directory(runId: string) { const dir = path.join(this.root, runId); assertInside(this.root, dir); return dir; }
  file(runId: string) { return path.join(this.directory(runId), 'run.json'); }
  async save(run: RunState) { runSchema.parse(run); await writeJsonAtomic(this.file(run.runId), run); }
  async load(runId: string) {
    const data = JSON.parse(await fs.readFile(this.file(runId), 'utf8'));
    return runSchema.parse(data);
  }
  async findByTask(taskId: string) {
    try {
      const entries = await fs.readdir(this.root); const matches: RunState[] = [];
      for (const runId of entries) { const run = await this.load(runId).catch(() => null); if (run?.taskId === taskId) matches.push(run); }
      return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
    } catch { return null; }
  }
}
