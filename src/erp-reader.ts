import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { writeJsonAtomic } from './utils.js';

export async function readErpTask(cdpUrl: string, taskUrl: string, taskId: string, runDir: string) {
  const browser = await puppeteer.connect({ browserURL: cdpUrl });
  try {
    const pages = await browser.pages();
    const page = pages.find((item) => item.url().includes(`id=${taskId}`) && item.url().includes('model=project.task'));
    if (!page) throw new Error(`ERP_TASK_TAB_NOT_FOUND: open task ${taskId} in the connected browser`);
    const result = await page.evaluate(() => {
      const field = document.querySelector('.o_field_widget.o_field_html, [name="description"], .oe_form_field_html');
      const title = document.title.trim();
      return { title, descriptionText: (field as HTMLElement | null)?.innerText?.trim() || '', descriptionHtml: field?.innerHTML || '' };
    });
    if (!result.descriptionText) throw new Error('ERP_DESCRIPTION_EMPTY');
    const sourceDir = path.join(runDir, 'source');
    await fs.mkdir(sourceDir, { recursive: true });
    const source = { taskId, taskUrl, capturedAt: new Date().toISOString(), ...result };
    await writeJsonAtomic(path.join(sourceDir, 'erp-task.json'), source);
    await writeJsonAtomic(path.join(runDir, 'brief.json'), { taskId, title: result.title, source: { type: 'erp', taskUrl }, description: result.descriptionText });
    return source;
  } finally { browser.disconnect(); }
}

