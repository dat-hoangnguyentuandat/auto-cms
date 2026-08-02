# Reading ERP Task Content from Microsoft Edge or Google Chrome

Auto CMS reads the authenticated Odoo task through the browser's local Chrome DevTools Protocol (CDP) endpoint. It does not store cookies, passwords, session data, or browser profiles.

## 1. Start a dedicated browser profile with CDP

Close the browser instances you want to use for this task. Start a separate profile with remote debugging enabled. Do not expose port `9222` outside the local machine.

### Microsoft Edge

```powershell
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\codex-erp-edge"
```

If Edge is installed in the 64-bit path:

```powershell
"C:\Program Files\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\codex-erp-edge"
```

### Google Chrome

```powershell
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\codex-erp-chrome"
```

If Chrome is installed per user:

```powershell
"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\codex-erp-chrome"
```

Sign in to the ERP in this dedicated window and open the task URL, for example:

```text
https://erp.xxx.xx/...
```

The CDP port and browser DevTools UI are separate. You do not need to press `F12`.

## 2. Verify the local CDP endpoint

Run either command from PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version"
```

The response must contain `Browser` and `webSocketDebuggerUrl`.

List open tabs:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9222/json"
```

Confirm that one tab contains the ERP task URL and that the task is authenticated before continuing.

## 3. Install Puppeteer in an isolated helper project

Auto CMS already uses `puppeteer-core`. For a standalone inspection helper, install Puppeteer in a separate Node.js directory:

```powershell
npm install puppeteer
```

Do not add ERP credentials or cookies to the helper source.

## 4. Read the Odoo Description field

Create a temporary script such as `read-erp-description.mjs` outside the repository:

```javascript
import puppeteer from 'puppeteer';

const taskId = '5089';
const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

try {
  const pages = await browser.pages();
  const page = pages.find((item) => item.url().includes(`id=${taskId}`));

  if (!page) {
    throw new Error(`No ERP tab found for task ${taskId}`);
  }

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => undefined);

  const description = await page.evaluate(() => {
    const field = document.querySelector(
      '.o_field_widget.o_field_html, [name="description"], .oe_form_field_html',
    );

    return field?.innerText?.trim() || null;
  });

  console.log(description ?? 'The task has no Description content');
} finally {
  browser.disconnect();
}
```

Run it with:

```powershell
node read-erp-description.mjs
```

The script connects to the existing authenticated browser only. It does not launch a second browser, save a profile, or persist authentication data.

## 5. Use the Auto CMS reader

After CDP, ERP, CMS, MySQL, and Stitch MCP are ready, run:

```powershell
cd E:\Project\auto-cms
node dist\cli.js doctor
node dist\cli.js run --task-url "<ERP_TASK_URL>"
```

The configured endpoint defaults to `http://127.0.0.1:9222`. Override it only when the browser is intentionally running on another local endpoint:

```powershell
$env:EDGE_CDP_URL = "http://127.0.0.1:9222"
```

The variable name is retained for compatibility with both Edge and Chrome because both browsers expose the same CDP protocol.

## 6. Troubleshooting

- `ECONNREFUSED`: Edge or Chrome was not started with `--remote-debugging-port=9222`, or the browser process exited.
- `No ERP tab found`: verify the task ID in the URL and confirm that the dedicated profile contains the task tab.
- Empty Description: wait for Odoo to finish rendering and run the helper again. Check that the task form is not still loading.
- Multiple browser profiles: close stale CDP sessions or use a different local port and set `EDGE_CDP_URL` accordingly.
- Wrong executable path: locate `msedge.exe` or `chrome.exe`, then rerun the matching command with the absolute path.
- Port already in use: stop the stale dedicated browser process or choose another local port, then update `EDGE_CDP_URL`.

## 7. Security requirements

- Connect only to `127.0.0.1`; never bind CDP to a LAN or public interface.
- Use a dedicated temporary browser profile, not the user's everyday profile.
- Never place ERP cookies, passwords, API keys, or local storage in source code, screenshots, prompts, logs, or run artifacts.
- Do not write to ERP records. The ERP adapter is read-only.
- Remove temporary helper scripts and close the dedicated profile after the run when they are no longer needed.
