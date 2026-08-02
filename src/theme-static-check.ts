import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertInside } from './utils.js';

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }); const files: string[] = [];
  for (const entry of entries) { const full = path.join(directory, entry.name); if (entry.isDirectory()) files.push(...await walk(full)); else files.push(full); }
  return files;
}

function lintPhp(file: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('php', ['-l', file], { shell: false, windowsHide: true }); let output = '';
    child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`PHP lint failed for ${file}: ${output}`)));
  });
}

export async function checkThemeStatic(themePath: string) {
  const required = ['theme.json', 'widgets.php', 'seed.php', path.join('assets', 'ASSET-SOURCES.json')];
  for (const file of required) await fs.access(path.join(themePath, file));
  const manifest = JSON.parse(await fs.readFile(path.join(themePath, 'theme.json'), 'utf8'));
  if (!manifest.name || !manifest.slug) throw new Error('theme.json requires name and slug');
  const assetManifest = JSON.parse(await fs.readFile(path.join(themePath, 'assets', 'ASSET-SOURCES.json'), 'utf8'));
  if (!Array.isArray(assetManifest.assets) || assetManifest.assets.length < 2) throw new Error('ASSET-SOURCES.json requires at least two local visual assets');
  if (!assetManifest.assets.some((item: { sourceType?: string }) => ['generated', 'web'].includes(item.sourceType || ''))) throw new Error('Theme requires at least one generated or licensed web asset in addition to ERP evidence');
  for (const item of assetManifest.assets as Array<{ path?: string; sourceType?: string; sourceUrl?: string; license?: string }>) {
    if (!item.path || !['erp', 'generated', 'web'].includes(item.sourceType || '')) throw new Error('Invalid asset provenance entry');
    if (item.sourceType === 'web' && (!item.sourceUrl || !item.license)) throw new Error(`Web asset requires sourceUrl and license: ${item.path}`);
    const candidate = path.join(themePath, 'assets', item.path); assertInside(path.join(themePath, 'assets'), candidate); await fs.access(candidate);
  }
  const files = await walk(themePath); const forbidden = files.filter((file) => /(^|[\\/])\.env($|\.)|\.log$/i.test(file));
  if (forbidden.length) throw new Error(`Forbidden theme files: ${forbidden.join(', ')}`);
  const phpFiles = files.filter((candidate) => candidate.endsWith('.php') && !candidate.endsWith('.blade.php'));
  for (const file of phpFiles) await lintPhp(file);
  return { phpFiles: phpFiles.length, bladeFiles: files.filter((file) => file.endsWith('.blade.php')).length, totalFiles: files.length, sourcedAssets: assetManifest.assets.length };
}
