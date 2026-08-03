import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from './utils.js';

export type QaGate = {
  schemaVersion: '1.0'; generatedBy: 'auto-cms-qa'; runId: string; slug: string;
  passed: boolean; critical: number; high: number; generatedAt: string; durationMs: number;
  themePath: string; themeFingerprint: string; evidence: Array<{ path: string; sha256: string }>;
};

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(candidate) : [candidate];
  }))).flat();
}

export async function sha256File(file: string) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

export async function fingerprintTheme(themePath: string) {
  const hash = crypto.createHash('sha256');
  const files = (await walk(themePath)).sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const relative = path.relative(themePath, file).replaceAll('\\', '/');
    hash.update(relative).update('\0').update(await fs.readFile(file)).update('\0');
  }
  return hash.digest('hex');
}

export async function writeQaGate(file: string, input: Omit<QaGate, 'schemaVersion' | 'generatedBy' | 'generatedAt' | 'themeFingerprint' | 'evidence'> & { evidenceFiles: string[] }) {
  const gate: QaGate = {
    schemaVersion: '1.0', generatedBy: 'auto-cms-qa', generatedAt: new Date().toISOString(),
    runId: input.runId, slug: input.slug, passed: input.passed, critical: input.critical,
    high: input.high, durationMs: input.durationMs, themePath: path.resolve(input.themePath),
    themeFingerprint: await fingerprintTheme(input.themePath),
    evidence: await Promise.all(input.evidenceFiles.map(async (candidate) => ({ path: path.resolve(candidate), sha256: await sha256File(candidate) }))),
  };
  await writeJsonAtomic(file, gate);
  return gate;
}

export async function validateQaGate(gate: QaGate, expectedThemePath: string) {
  if (gate.schemaVersion !== '1.0' || gate.generatedBy !== 'auto-cms-qa') throw new Error('Missing deterministic Auto CMS QA gate');
  if (!gate.passed || gate.critical !== 0 || gate.high !== 0) throw new Error('Deterministic QA gate has blocking findings');
  if (path.resolve(gate.themePath) !== path.resolve(expectedThemePath)) throw new Error('QA gate theme path mismatch');
  if (await fingerprintTheme(expectedThemePath) !== gate.themeFingerprint) throw new Error('Theme changed after deterministic QA; rerun auto-cms qa');
  for (const evidence of gate.evidence) {
    if (await sha256File(evidence.path) !== evidence.sha256) throw new Error(`QA evidence changed after generation: ${evidence.path}`);
  }
  return gate;
}
