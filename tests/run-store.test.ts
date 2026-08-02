import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RunStore } from '../src/run-store.js';
import type { RunState } from '../src/contracts.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('RunStore', () => {
  it('atomically saves and validates state', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-')); roots.push(root); const store = new RunStore(root);
    const run: RunState = { protocolVersion: '1.0', runId: 'run-1', taskId: '5089', taskUrl: 'https://erp.19t.vn/web#id=5089&model=project.task', stage: 'ERP_READ', status: 'RUNNING', attempts: {}, artifacts: [], errors: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await store.save(run); expect((await store.load('run-1')).taskId).toBe('5089'); expect(await store.findByTask('5089')).not.toBeNull();
  });
});

