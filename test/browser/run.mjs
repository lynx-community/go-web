/**
 * Real-browser integration test for the preview extension points.
 *
 * Unlike test/*.test.ts (which run in Node against a faithful `<lynx-view>`
 * FAKE), this drives the built example app in headless Chromium against the
 * REAL `@lynx-js/web-core` runtime. It verifies, end to end:
 *
 *   Default   — the built-in preview boots exactly one real <lynx-view>
 *               (no regression when the new hooks are unset).
 *   Level A   — with `previewNativeEnv` set, the real <lynx-view> actually
 *               receives our `nativeModulesMap` / `globalProps` /
 *               `onNativeModulesCall` and boots.
 *   Level B   — with `PreviewRuntime` set, invoking the view's
 *               `onNativeModulesCall('open', …)` — exactly what a native-calling
 *               bundle does — pushes a SECOND real <lynx-view> that also boots,
 *               and Back pops it, leaving the ORIGINAL root element (same DOM
 *               node ⇒ heap/state intact).
 *
 * Prereq: `cd example && pnpm install && pnpm build` (serves example/dist).
 * Run:    `pnpm test:browser`
 *
 * This is intentionally NOT part of `pnpm test` / CI: it needs the example
 * built and a Chromium binary. It is the layer that a native-module fixture or
 * the downstream MPA bundle would slot into for literal acceptance.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../example/dist');
const EXAMPLE = 'vue-vue-router'; // has a real dist/main.web.bundle

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.bundle': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json',
};

function findChromium() {
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dirs = fs.existsSync(root) ? fs.readdirSync(root) : [];
  for (const d of dirs.filter((d) => /^chromium-\d/.test(d))) {
    const candidate = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined; // let Playwright try its default
}

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    let file = path.join(DIST, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Content-Type',
      MIME[path.extname(file)] || 'application/octet-stream',
    );
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

// Desktop preview only (the app also renders a mobile clone under .mobile-preview).
const DESKTOP_VIEWS = `Array.from(document.querySelectorAll('lynx-view')).filter((v) => !v.closest('.mobile-preview'))`;

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(
    `${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

async function waitForBooted(page, n, timeout = 25000) {
  await page.waitForFunction(
    ([expr, n]) =>
      eval(expr).filter(
        (v) => v.shadowRoot && v.shadowRoot.childNodes.length > 0,
      ).length === n,
    [DESKTOP_VIEWS, n],
    { timeout },
  );
}

async function clickPreview(page, label) {
  await page.evaluate((label) => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === label,
    );
    if (!btn) throw new Error(`preview toggle "${label}" not found`);
    btn.click();
  }, label);
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`example/dist not found. Run: cd example && pnpm build`);
    process.exit(2);
  }

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  try {
    const hash = encodeURIComponent(
      JSON.stringify({ example: EXAMPLE, tab: 'web', mode: 'preview' }),
    );
    await page.goto(`${base}/#${hash}`, { waitUntil: 'load' });

    // ── Default: one real <lynx-view> boots (unchanged behavior) ──
    await waitForBooted(page, 1);
    check('default: exactly one real <lynx-view> boots', true);

    // ── Level A: native env reaches the real element and it boots ──
    await clickPreview(page, 'Native');
    await waitForBooted(page, 1);
    const envApplied = await page.evaluate((expr) => {
      const v = eval(expr)[0];
      return {
        hasMap: !!(v.nativeModulesMap && v.nativeModulesMap.DemoModule),
        hasHandler: typeof v.onNativeModulesCall === 'function',
        containerId:
          v.globalProps && typeof v.globalProps === 'object'
            ? v.globalProps.containerId
            : undefined,
      };
    }, DESKTOP_VIEWS);
    check(
      'level A: real <lynx-view> received nativeModulesMap + handler + globalProps',
      envApplied.hasMap &&
        envApplied.hasHandler &&
        typeof envApplied.containerId === 'string',
      JSON.stringify(envApplied),
    );

    // ── Level B: a native "open" pushes a 2nd real card; Back pops it ──
    await clickPreview(page, 'MPA');
    await waitForBooted(page, 1);
    const rootId = await page.evaluate((expr) => {
      const v = eval(expr)[0];
      v.dataset.testid = 'root-card';
      return v.getAttribute('url');
    }, DESKTOP_VIEWS);

    // A native-calling bundle would invoke this; we invoke it at the same
    // integration boundary (the view's onNativeModulesCall).
    await page.evaluate((expr) => {
      const v = eval(expr)[0];
      v.onNativeModulesCall('open', { entry: 'main' }, 'Router');
    }, DESKTOP_VIEWS);

    await waitForBooted(page, 2);
    check('level B: opening pushes a second real <lynx-view> that boots', true);

    const backClicked = await page.evaluate(() => {
      const btn = Array.from(
        document.querySelectorAll('button[aria-label="Back"]'),
      ).find((b) => !b.closest('.mobile-preview'));
      if (!btn) return false;
      btn.click();
      return true;
    });
    check('level B: Back control is present while stacked', backClicked);

    await waitForBooted(page, 1);
    const rootIntact = await page.evaluate(
      ([expr, expectedUrl]) => {
        const views = eval(expr);
        return (
          views.length === 1 &&
          views[0].dataset.testid === 'root-card' &&
          views[0].getAttribute('url') === expectedUrl
        );
      },
      [DESKTOP_VIEWS, rootId],
    );
    check(
      'level B: Back returns to the original root element (state intact)',
      rootIntact,
      `root url ${rootId}`,
    );
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
