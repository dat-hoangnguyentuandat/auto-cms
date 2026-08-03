import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import type { AppConfig } from './config.js';
import type { RunState } from './contracts.js';
import { checkThemeStatic } from './theme-static-check.js';
import { writeJsonAtomic } from './utils.js';
import { writeQaGate } from './qa-gate.js';

type Finding = { severity: 'Critical' | 'High' | 'Medium' | 'Low'; title: string; details?: unknown };
const viewports = [
  { name: '1440', width: 1440, height: 1000 }, { name: '1024', width: 1024, height: 900 },
  { name: '768', width: 768, height: 900 }, { name: '390', width: 390, height: 844 },
  { name: '375', width: 375, height: 812 }, { name: '320', width: 320, height: 700 },
];

async function files(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? files(candidate) : [candidate];
  }))).flat();
}

function edgeExecutable() {
  const candidates = [process.env.EDGE_EXECUTABLE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean) as string[];
  return candidates;
}

function htmlText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function occurrences(html: string, expression: RegExp) { return [...html.matchAll(expression)]; }

export async function runQa(config: AppConfig, run: RunState, baseUrlValue: string) {
  const startedAt = Date.now();
  if (!run.slug) throw new Error('Run has no theme slug');
  const baseUrl = new URL(baseUrlValue).href.replace(/\/$/, '');
  const publicUrl = (route: string) => new URL(route.replace(/^\//, ''), `${baseUrl}/`);
  const runDir = path.join(config.runsRoot, run.runId);
  const outputDir = path.join(runDir, 'reports', 'qa');
  await fs.mkdir(outputDir, { recursive: true });
  const sitemapArtifact = run.artifacts.find((item) => item.kind === 'sitemap');
  if (!sitemapArtifact) throw new Error('Run has no sitemap artifact');
  const sitemap = JSON.parse(await fs.readFile(sitemapArtifact.path, 'utf8'));
  const routes = [...new Set((sitemap.pages || []).map((page: { route?: string }) => page.route).filter(Boolean))] as string[];
  if (!routes.includes('/')) routes.unshift('/');
  if (!routes.includes('/tin-tuc')) routes.push('/tin-tuc');
  const findings: Finding[] = [];

  const themePath = path.join(config.cmsRoot, 'themes', run.slug);
  const staticResult = await checkThemeStatic(themePath);
  const sourceFiles = await files(themePath);
  const forbiddenPatterns = [
    { name: 'raw root-relative link', pattern: /(?:href|action)=["']\/(?!\/)/i },
    { name: 'unversioned filemtime asset', pattern: /filemtime\s*\(/i },
    { name: 'default paginator', pattern: /->links\s*\(\s*\)/i },
    { name: 'hardcoded sell route', pattern: /route\s*\(\s*["']sell\./i },
    { name: 'adjacent Blade closing directives', pattern: /@(endif|endforeach|endforelse)@endsection/i },
    { name: 'theme-owned language switcher', pattern: /fullUrlWithQuery\s*\(\s*\[\s*["']lang["']/i },
  ];
  const staticViolations: Array<{ file: string; rule: string }> = [];
  for (const file of sourceFiles.filter((item) => /\.(php|blade\.php|css|js|json)$/i.test(item))) {
    const content = await fs.readFile(file, 'utf8');
    for (const rule of forbiddenPatterns) if (rule.pattern.test(content)) staticViolations.push({ file, rule: rule.name });
  }
  if (staticViolations.length) findings.push({ severity: 'High', title: 'Static theme contract violations', details: staticViolations });
  const staticEvidence = path.join(outputDir, 'automated-static.json');
  await writeJsonAtomic(staticEvidence, { ...staticResult, scannedFiles: sourceFiles.length, violations: staticViolations });

  const httpPages: unknown[] = []; const internalLinks: unknown[] = []; const discovered = new Set<string>();
  await Promise.all(routes.map(async (route) => {
    const response = await fetch(publicUrl(route)); const html = await response.text();
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || '';
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i)?.[1] || '';
    const anchors = occurrences(html, /<a\b[^>]*href=["']([^"']+)/gi).map((item) => item[1]);
    anchors.forEach((href) => discovered.add(href));
    const page = { route, status: response.status, title, description, canonical, h1Count: occurrences(html, /<h1\b/gi).length, viewport: /<meta\s+name=["']viewport/i.test(html), lang: html.match(/<html\b[^>]*lang=["']([^"']+)/i)?.[1] || '', jsonLd: occurrences(html, /type=["']application\/ld\+json["']/gi).length, wordCount: htmlText(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '').split(/\s+/).filter(Boolean).length, rawBladeDirective: /@(endsection|section|endif|endforeach|endforelse)\b/i.test(htmlText(html)) };
    httpPages.push(page);
    if (response.status !== 200 || page.h1Count !== 1 || !canonical || !page.viewport || !page.lang) findings.push({ severity: 'High', title: `Rendered contract failed: ${route}`, details: page });
    if (!title || !description) findings.push({ severity: 'High', title: `Missing metadata: ${route}` });
    if (page.rawBladeDirective) findings.push({ severity: 'Critical', title: `Raw Blade directive rendered: ${route}` });
    if (page.wordCount < 100) findings.push({ severity: 'Medium', title: `Thin rendered content: ${route}`, details: { wordCount: page.wordCount } });
  }));
  await Promise.all([...discovered].map(async (href) => {
    if (/^(#|tel:|mailto:|javascript:)/i.test(href)) return;
    const target = new URL(href, `${baseUrl}/`); if (target.origin !== new URL(baseUrl).origin) return;
    const response = await fetch(target, { redirect: 'manual' });
    internalLinks.push({ href, resolved: target.href, status: response.status });
    if (response.status >= 400) findings.push({ severity: 'High', title: `Broken internal link: ${href}`, details: { status: response.status } });
  }));
  await Promise.all(['/robots.txt', '/sitemap.xml'].map(async (endpoint) => {
    const response = await fetch(publicUrl(endpoint));
    if (endpoint === '/robots.txt' && response.status !== 200) findings.push({ severity: 'High', title: 'robots.txt unavailable' });
    if (endpoint === '/sitemap.xml' && response.status !== 200) findings.push({ severity: 'Medium', title: 'sitemap.xml unavailable' });
  }));
  const httpEvidence = path.join(outputDir, 'automated-http-seo.json');
  await writeJsonAtomic(httpEvidence, { baseUrl, pages: httpPages, internalLinks, findings });

  const executable = (await Promise.all(edgeExecutable().map(async (candidate) => fs.access(candidate).then(() => candidate).catch(() => null)))).find(Boolean);
  if (!executable) throw new Error('Microsoft Edge executable not found; set EDGE_EXECUTABLE_PATH');
  const browser = await puppeteer.launch({ executablePath: executable, headless: true });
  const browserResults: unknown[] = []; const screenshotEvidence: string[] = [];
  try {
    const page = await browser.newPage(); const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const settleLazyMedia = async () => page.evaluate(async () => {
      const images = [...document.images];
      images.forEach((image) => { image.loading = 'eager'; });
      window.scrollTo(0, document.documentElement.scrollHeight);
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        const done = () => resolve(); image.addEventListener('load', done, { once: true }); image.addEventListener('error', done, { once: true }); setTimeout(done, 1500);
      })));
      window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    for (const viewport of viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height });
      const response = await page.goto(publicUrl('/').href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await settleLazyMedia();
      const metrics = await page.evaluate(() => {
        const hero = document.querySelector('[data-hero-layout="full-bleed"]'); const heroRect = hero?.getBoundingClientRect();
        const header = document.querySelector('header'); const main = document.querySelector('main'); const footer = document.querySelector('footer');
        const cart = document.querySelector('.cms-sell-cart-link'); const switchers = document.querySelectorAll('[data-cms-injection="theme-i18n-switcher-header"]');
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
          headerCount: document.querySelectorAll('.site-header').length || document.querySelectorAll('body > header').length,
          footerCount: document.querySelectorAll('.site-footer').length || document.querySelectorAll('body > footer').length,
          newsInPrimaryNav: [...document.querySelectorAll('nav a')].some((anchor) => new URL((anchor as HTMLAnchorElement).href).pathname.replace(/\/$/, '').endsWith('/tin-tuc')),
          fullBleedHero: Boolean(heroRect && heroRect.width >= window.innerWidth - 2 && hero?.querySelector('img')),
          rawBladeDirective: /@(endsection|section|endif|endforeach|endforelse)\b/i.test(document.body.innerText),
          structureOrder: Boolean(header && main && footer && (header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) && (main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)),
          languageSwitcherCount: switchers.length,
          cartCount: document.querySelectorAll('.cms-sell-cart-link').length,
          cartInPrimaryNav: Boolean(cart && document.querySelector('header nav')?.contains(cart)),
          favicon: Boolean(document.querySelector('link[rel="icon"]')),
        };
      });
      if (['1440', '390'].includes(viewport.name)) { const screenshot = path.join(outputDir, `automated-home-${viewport.name}.png`); await page.screenshot({ path: screenshot, fullPage: true }); screenshotEvidence.push(screenshot); }
      browserResults.push({ route: '/', viewport: viewport.name, status: response?.status(), ...metrics });
      if (metrics.rawBladeDirective) findings.push({ severity: 'Critical', title: `Raw Blade directive in browser at ${viewport.name}px`, details: metrics });
      if (response?.status() !== 200 || metrics.overflow || metrics.brokenImages.length || metrics.headerCount !== 1 || metrics.footerCount !== 1 || !metrics.newsInPrimaryNav || !metrics.fullBleedHero || !metrics.structureOrder || metrics.languageSwitcherCount > 1 || metrics.cartCount > 1 || metrics.cartInPrimaryNav || !metrics.favicon) findings.push({ severity: 'High', title: `Responsive browser contract failed at ${viewport.name}px`, details: metrics });
    }
    const mobileRouteRepresentatives = new Set(['/san-pham', '/tin-tuc', '/lien-he', '/gioi-thieu']);
    const mobilePathsCovered = new Set<string>();
    for (const route of routes.filter((item) => item !== '/')) {
      const routePath = new URL(route, `${baseUrl}/`).pathname;
      const needsMobile = mobileRouteRepresentatives.has(routePath) && !mobilePathsCovered.has(routePath);
      if (needsMobile) mobilePathsCovered.add(routePath);
      const routeViewports = needsMobile ? [viewports[0], viewports[3]] : [viewports[0]];
      for (const viewport of routeViewports) {
        await page.setViewport({ width: viewport.width, height: viewport.height }); const response = await page.goto(publicUrl(route).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await settleLazyMedia();
        const metrics = await page.evaluate((currentRoute) => {
          const selector = currentRoute === '/dich-vu' ? '.service-card' : currentRoute === '/tin-tuc' ? '.news-card' : null;
          const cards = selector ? [...document.querySelectorAll(selector)] : [];
          const header = document.querySelector('header'); const main = document.querySelector('main'); const footer = document.querySelector('footer');
          return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src), cardCount: cards.length, cardImageCount: cards.filter((card) => card.querySelector('img')).length, rawBladeDirective: /@(endsection|section|endif|endforeach|endforelse)\b/i.test(document.body.innerText), structureOrder: Boolean(header && main && footer && (header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) && (main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)) };
        }, route);
        browserResults.push({ route, viewport: viewport.name, status: response?.status(), ...metrics });
        const incompleteListing = ['/dich-vu', '/tin-tuc'].includes(route) && (metrics.cardCount < 3 || metrics.cardImageCount !== metrics.cardCount);
        const failed = response?.status() !== 200 || metrics.overflow || metrics.brokenImages.length || incompleteListing || metrics.rawBladeDirective || !metrics.structureOrder;
        if (failed) { const screenshot = path.join(outputDir, `failed-${route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home'}-${viewport.name}.png`); await page.screenshot({ path: screenshot, fullPage: true }); screenshotEvidence.push(screenshot); findings.push({ severity: metrics.rawBladeDirective ? 'Critical' : 'High', title: `Route visual/content contract failed: ${route} at ${viewport.name}px`, details: metrics }); }
      }
    }
    if (consoleErrors.length) findings.push({ severity: 'High', title: 'Browser console errors', details: consoleErrors });
  } finally { await browser.close(); }
  const browserEvidence = path.join(outputDir, 'automated-browser.json'); await writeJsonAtomic(browserEvidence, browserResults);

  const serialized = JSON.stringify(sitemap).toLowerCase();
  const pending = ['admin widget edit/reorder persistence and uploaded image fixture'];
  if (/form|contact/.test(serialized)) pending.push('form validation, successful persistence and controlled cleanup fixture');
  if (/listing|services|products|news|reviews|testimonials/.test(serialized)) pending.push('pagination page-2 fixture and cleanup');
  if (/review|testimonial/.test(serialized)) pending.push('broken/slow avatar and very-long review fixture with cleanup');
  const critical = findings.filter((item) => item.severity === 'Critical').length;
  const high = findings.filter((item) => item.severity === 'High').length;
  const deterministicEvidence = [staticEvidence, httpEvidence, browserEvidence, ...screenshotEvidence];
  const gateFile = path.join(outputDir, 'qa-gate.json');
  const gate = await writeQaGate(gateFile, { runId: run.runId, slug: run.slug, passed: critical === 0 && high === 0, critical, high, durationMs: Date.now() - startedAt, themePath, evidenceFiles: deterministicEvidence });
  const draft = {
    passed: false, critical, high,
    checks: [
      { name: 'automated-static', passed: !staticViolations.length, details: staticResult },
      { name: 'automated-http-seo-links', passed: !findings.some((item) => item.severity === 'High' && /Rendered|metadata|link|robots/.test(item.title)), details: `${routes.length} sitemap routes and ${internalLinks.length} internal links audited` },
      { name: 'automated-responsive-browser', passed: !findings.some((item) => ['Critical', 'High'].includes(item.severity) && /browser|Responsive|Mobile|Blade|visual/.test(item.title)), details: `${browserResults.length} route/viewport checks with ${screenshotEvidence.length} representative or failure screenshots` },
    ],
    findings, pending,
    durationMs: gate.durationMs,
    evidence: [...deterministicEvidence, gateFile],
    note: 'Draft only. Complete pending mutable-data fixtures, merge their evidence, then set passed=true only when critical=0 and high=0.',
  };
  const draftFile = path.join(outputDir, 'qa-draft.json'); await writeJsonAtomic(draftFile, draft);
  return { draftFile, critical, high, pending, evidence: draft.evidence };
}
