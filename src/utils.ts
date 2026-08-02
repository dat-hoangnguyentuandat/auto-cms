import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const now = () => new Date().toISOString();
export const randomId = () => crypto.randomUUID();
export const randomToken = () => crypto.randomBytes(24).toString('hex');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export async function sha256File(file: string) {
  const content = await fs.readFile(file); return crypto.createHash('sha256').update(content).digest('hex');
}

export async function writeJsonAtomic(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

export function assertInside(root: string, candidate: string) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes allowed root: ${candidate}`);
}

export function redact(message: string) {
  return message.replace(/(api[-_ ]?key|authorization|token)(["' :=]+)[^\s,"']+/gi, '$1$2[REDACTED]');
}
