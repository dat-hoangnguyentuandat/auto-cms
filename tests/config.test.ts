import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const originalCmsRoot = process.env.CMS_ROOT;
const originalCwd = process.cwd();

afterEach(() => {
  if (originalCmsRoot === undefined) delete process.env.CMS_ROOT;
  else process.env.CMS_ROOT = originalCmsRoot;
  process.chdir(originalCwd);
});

describe('loadConfig', () => {
  it('uses the project-local cms directory by default', () => {
    delete process.env.CMS_ROOT;

    const config = loadConfig();

    expect(config.cmsRoot).toBe(path.join(config.projectRoot, 'cms'));
  });

  it('treats an empty CMS_ROOT as missing', () => {
    process.env.CMS_ROOT = '';

    const config = loadConfig();

    expect(config.cmsRoot).toBe(path.join(config.projectRoot, 'cms'));
  });

  it('keeps the default anchored to the project when cwd changes', () => {
    delete process.env.CMS_ROOT;
    process.chdir(path.dirname(originalCwd));

    const config = loadConfig();

    expect(config.cmsRoot).toBe(path.join(config.projectRoot, 'cms'));
  });

  it('prefers and resolves an explicit CMS_ROOT', () => {
    process.env.CMS_ROOT = path.join('.', 'custom-cms');

    expect(loadConfig().cmsRoot).toBe(path.resolve('custom-cms'));
  });
});
