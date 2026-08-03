import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile); const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function themeFixture() {
  const theme = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-quality-')); roots.push(theme);
  await fs.mkdir(path.join(theme, 'views', 'layouts'), { recursive: true }); await fs.mkdir(path.join(theme, 'views', 'partials'));
  await fs.writeFile(path.join(theme, 'theme.json'), JSON.stringify({ slug: 'demo' }));
  await fs.writeFile(path.join(theme, 'widgets.php'), '<?php return [];'); await fs.writeFile(path.join(theme, 'seed.php'), '<?php return [];');
  await fs.writeFile(path.join(theme, 'views', 'layouts', 'app.blade.php'), '<link rel="icon" href="favicon.svg">');
  await fs.writeFile(path.join(theme, 'views', 'partials', 'header.blade.php'), "{{ Setting::get('site_logo') }}");
  return theme;
}

describe('theme-cms deterministic quality script', () => {
  it('passes a valid fixture and rejects adjacent Blade directives', async () => {
    const theme = await themeFixture(); const script = path.resolve('.agents/skills/theme-cms/scripts/check-theme-quality.mjs');
    const valid = JSON.parse((await exec('node', [script, '--theme', theme])).stdout); expect(valid.passed).toBe(true);
    await fs.writeFile(path.join(theme, 'views', 'broken.blade.php'), '@if(true)x@endif@endsection');
    await expect(exec('node', [script, '--theme', theme])).rejects.toMatchObject({ code: 1 });
  });
});
