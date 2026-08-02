import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkThemeStatic } from '../src/theme-static-check.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function theme(assets: unknown[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-theme-')); roots.push(root);
  await fs.mkdir(path.join(root, 'assets', 'images'), { recursive: true });
  await fs.writeFile(path.join(root, 'theme.json'), JSON.stringify({ name: 'Demo', slug: 'demo' }));
  await fs.writeFile(path.join(root, 'widgets.php'), '<?php return [];'); await fs.writeFile(path.join(root, 'seed.php'), '<?php return [];');
  for (const name of ['erp.jpg', 'web.jpg']) await fs.writeFile(path.join(root, 'assets', 'images', name), name);
  await fs.writeFile(path.join(root, 'assets', 'ASSET-SOURCES.json'), JSON.stringify({ version: 1, assets })); return root;
}

describe('theme asset provenance', () => {
  it('rejects themes that rely only on ERP images', async () => {
    const root = await theme([{ path: 'images/erp.jpg', sourceType: 'erp', sourceUrl: 'ERP' }, { path: 'images/web.jpg', sourceType: 'erp', sourceUrl: 'ERP' }]);
    await expect(checkThemeStatic(root)).rejects.toThrow('generated or licensed web asset');
  });

  it('accepts local licensed web assets with provenance', async () => {
    const root = await theme([{ path: 'images/erp.jpg', sourceType: 'erp', sourceUrl: 'ERP' }, { path: 'images/web.jpg', sourceType: 'web', sourceUrl: 'https://example.com/photo', license: 'Example license' }]);
    await expect(checkThemeStatic(root)).resolves.toMatchObject({ sourcedAssets: 2 });
  });
});
