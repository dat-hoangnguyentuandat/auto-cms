import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RunLease } from '../src/run-lease.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('RunLease', () => {
  it('survives processes conceptually by keying ownership to run ID', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-lease-')); roots.push(root); const file = path.join(root, 'lease.json');
    await new RunLease(file).acquire('run-a'); await expect(new RunLease(file).acquire('run-a')).resolves.toBeUndefined(); await expect(new RunLease(file).acquire('run-b')).rejects.toThrow('run-a');
    await new RunLease(file).release('run-a'); await expect(new RunLease(file).acquire('run-b')).resolves.toBeUndefined();
  });
});
