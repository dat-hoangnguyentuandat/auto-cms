import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateDesignSubmission, validateQaSubmission } from '../src/validators.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('submission validators', () => {
  it('requires every sitemap screen in the design manifest', async () => {
    const cms = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-design-')); roots.push(cms); const root = path.join(cms, 'artifacts', 'designs', 'demo');
    await fs.mkdir(root, { recursive: true }); const files = ['DESIGN.md', 'home-desktop.png', 'home-mobile.png'];
    await Promise.all(files.map((file) => fs.writeFile(path.join(root, file), 'evidence')));
    const manifest = path.join(root, 'manifest.json'); await fs.writeFile(manifest, JSON.stringify({ projectId: 'p1', slug: 'demo', designMd: path.join(root, 'DESIGN.md'), screens: [{ pageId: 'home', desktop: path.join(root, 'home-desktop.png'), mobile: path.join(root, 'home-mobile.png') }] }));
    await expect(validateDesignSubmission(manifest, cms, 'demo', ['home', 'contact'])).rejects.toThrow('contact');
  });
  it('rejects empty QA evidence', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-qa-')); roots.push(root); const file = path.join(root, 'qa.json');
    await fs.writeFile(file, JSON.stringify({ passed: true, critical: 0, high: 0, checks: [], evidence: [] }));
    await expect(validateQaSubmission(file, root)).rejects.toThrow();
  });
  it('requires QA evidence files to exist', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-qa-')); roots.push(root); const file = path.join(root, 'qa.json');
    await fs.writeFile(file, JSON.stringify({ passed: true, critical: 0, high: 0, checks: ['routes'], evidence: [path.join(root, 'missing.png')] }));
    await expect(validateQaSubmission(file, root)).rejects.toThrow();
  });
  it('accepts QA evidence only inside the run root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-cms-qa-')); roots.push(root); const evidence = path.join(root, 'report.txt'); const file = path.join(root, 'qa.json');
    await fs.writeFile(evidence, 'real command output'); await fs.writeFile(file, JSON.stringify({ passed: true, critical: 0, high: 0, checks: ['routes'], evidence: [evidence] }));
    await expect(validateQaSubmission(file, root)).resolves.toMatchObject({ passed: true });
  });
});
