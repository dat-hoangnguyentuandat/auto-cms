import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { sha256File } from './utils.js';

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr || stdout}`)));
  });
}

export async function packageTheme(cmsRoot: string, slug: string) {
  await run('php', ['artisan', 'theme:package', slug], cmsRoot);
  const expected = path.join(cmsRoot, 'storage', 'app', 'themes', `${slug}.zip`);
  await fs.access(expected);
  const stat = await fs.stat(expected);
  if (stat.size < 100) throw new Error('Theme package is unexpectedly small');
  const entries = new AdmZip(expected).getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
  if (!entries.includes('theme.json')) throw new Error('Theme package is missing theme.json');
  if (!entries.includes('assets/ASSET-SOURCES.json')) throw new Error('Theme package is missing asset provenance');
  const forbidden = entries.filter((entry) => entry.includes('..') || /(^|\/)\.env($|\.)|\.log$/i.test(entry));
  if (forbidden.length) throw new Error(`Theme package contains forbidden entries: ${forbidden.join(', ')}`);
  return { packagePath: expected, bytes: stat.size, entries: entries.length, sha256: await sha256File(expected) };
}
