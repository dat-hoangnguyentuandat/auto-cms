import path from 'node:path';

export type AppConfig = {
  projectRoot: string; cmsRoot: string; runsRoot: string; cdpUrl: string; maxRetries: number;
};

export function loadConfig(): AppConfig {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const cmsRoot = path.resolve(process.env.CMS_ROOT || 'E:/Project/cms');
  const maxRetries = Number(process.env.AUTO_CMS_MAX_RETRIES || 3);
  if (!Number.isInteger(maxRetries) || maxRetries < 1 || maxRetries > 10) throw new Error('AUTO_CMS_MAX_RETRIES must be 1..10');
  return {
    projectRoot, cmsRoot, runsRoot: path.join(projectRoot, 'runs'),
    cdpUrl: process.env.EDGE_CDP_URL || 'http://127.0.0.1:9222', maxRetries,
  };
}

