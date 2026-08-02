import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from './utils.js';

type Lease = { runId: string; acquiredAt: string };

export class RunLease {
  constructor(private readonly file: string) {}
  async acquire(runId: string) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const current = await this.read();
    if (current && current.runId !== runId) throw new Error(`CMS_RUNTIME_LEASED by run ${current.runId}`);
    if (!current) await writeJsonAtomic(this.file, { runId, acquiredAt: new Date().toISOString() } satisfies Lease);
  }
  async release(runId: string) { const current = await this.read(); if (current?.runId === runId) await fs.rm(this.file, { force: true }); }
  private async read(): Promise<Lease | null> { try { return JSON.parse(await fs.readFile(this.file, 'utf8')) as Lease; } catch { return null; } }
}

