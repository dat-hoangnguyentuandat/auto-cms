import fs from 'node:fs/promises';
import path from 'node:path';

type LockData = { pid: number; acquiredAt: string; runId: string };

function processAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export class FileLock {
  constructor(private readonly file: string) {}
  async acquire(runId: string): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const handle = await fs.open(this.file, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString(), runId } satisfies LockData));
      await handle.close(); return;
    } catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
    }
    const current = JSON.parse(await fs.readFile(this.file, 'utf8')) as LockData;
    if (processAlive(current.pid)) throw new Error(`CMS_LOCKED by run ${current.runId} (PID ${current.pid})`);
    await fs.rm(this.file, { force: true });
    return this.acquire(runId);
  }
  async release(runId: string) {
    try { const current = JSON.parse(await fs.readFile(this.file, 'utf8')) as LockData; if (current.runId === runId) await fs.rm(this.file, { force: true }); } catch {}
  }
}
