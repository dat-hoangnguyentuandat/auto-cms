import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileLock } from '../src/file-lock.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('FileLock', () => {
  it('serializes live owners and releases by run ID', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-lock-')); roots.push(root); const lock = new FileLock(path.join(root, 'lock.json'));
    await lock.acquire('run-a'); await expect(lock.acquire('run-b')).rejects.toThrow('CMS_LOCKED'); await lock.release('run-a'); await expect(lock.acquire('run-b')).resolves.toBeUndefined();
  });
});
