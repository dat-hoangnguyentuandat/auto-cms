import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AppConfig } from './config.js';

function commandVersion(command: string, args: string[]) {
  return new Promise<string>((resolve) => {
    const needsShell = process.platform === 'win32' && ['composer', 'npm', 'npx'].includes(command);
    const child = spawn(command, args, { windowsHide: true, shell: needsShell }); let output = '';
    child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; });
    child.on('error', () => resolve('unavailable')); child.on('close', (code) => resolve(code === 0 ? output.trim().split('\n')[0] : 'unavailable'));
  });
}

function portOpen(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port }); const done = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500); socket.once('connect', () => done(true)); socket.once('timeout', () => done(false)); socket.once('error', () => done(false));
  });
}

export async function doctor(config: AppConfig) {
  const [node, php, composer, cdp, mysql] = await Promise.all([
    commandVersion('node', ['--version']), commandVersion('php', ['--version']), commandVersion('composer', ['--version']),
    portOpen('127.0.0.1', Number(new URL(config.cdpUrl).port || 80)), portOpen('127.0.0.1', 3306),
  ]);
  const cmsFiles = await Promise.all(['artisan', 'composer.json', '.agents/skills/website-sitemap/SKILL.md', '.agents/skills/theme-cms/SKILL.md'].map(async (file) => fs.access(path.join(config.cmsRoot, file)).then(() => true).catch(() => false)));
  return { node, php, composer, edgeCdp: cdp, mysql, cmsRoot: config.cmsRoot, cmsReady: cmsFiles.every(Boolean), stitchMcp: 'host-agent-preflight-required' };
}
