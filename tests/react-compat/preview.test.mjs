import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://go.example.test/next/',
  pretendToBeVisual: true,
});
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'ShadowRoot',
  'SVGElement',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
}
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.ResizeObserver = window.ResizeObserver;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {
  act,
  createElement: h,
  createRoot,
  renderToStaticMarkup,
  version,
  Go,
  GoConfigProvider,
  SWRConfig,
  ExamplePreviewSSG,
  generateSSGHTML,
} = await import(pathToFileURL(process.env.GO_WEB_REACT_BUNDLE).href);
assert.equal(version.split('.')[0], process.env.GO_WEB_REACT_MAJOR);

const exampleRoot = path.join(
  path.dirname(fileURLToPath(pathToFileURL(process.env.GO_WEB_REACT_BUNDLE))),
  'examples',
);
const metadata = {
  first: {
    name: 'examples/first',
    version: '1.2.3-beta.1+build.4',
    files: ['package.json'],
    templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
  },
  second: {
    name: 'examples/second',
    version: '2.0.0',
    files: ['package.json'],
    templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
  },
  unversioned: {
    name: 'examples/unversioned',
    files: ['package.json'],
    templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
  },
  host: {
    name: 'examples/host',
    version: '1.0.0',
    files: ['package.json'],
    templateFiles: [
      {
        name: 'main',
        file: 'dist/main.lynx.bundle',
        webHostFile: '/host/index.html',
      },
    ],
  },
};
for (const [name, data] of Object.entries(metadata)) {
  const dir = path.join(exampleRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'example-metadata.json'), JSON.stringify(data));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }));
}

let host;
let root;
let requests;
let cache;
const originalFetch = globalThis.fetch;
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const withBase = (url) => (url.startsWith('/next/') ? url : `/next${url}`);
const config = {
  exampleBasePath: '/lynx-examples',
  withBase,
  useDark: () => false,
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  requests = [];
  cache = new Map();
  globalThis.fetch = async (url) => {
    const address = String(url);
    requests.push(address);
    const name = address.split('/').at(-2);
    return { ok: true, json: async () => metadata[name] };
  };
});
afterEach(async () => {
  act(() => root.unmount());
  await act(nextTask);
  host.remove();
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

async function render(props = {}, overrides = {}) {
  await act(async () => {
    root.render(
      h(
        SWRConfig,
        { value: { provider: () => cache } },
        h(
          GoConfigProvider,
          { config: { ...config, ...overrides } },
          h(Go, {
            example: 'first',
            mode: 'preview',
            webPreview: false,
            img: '/images/demo.png',
            ...props,
          }),
        ),
      ),
    );
    await nextTask();
  });
  await act(nextTask);
}

test('client uses one metadata request and follows the current example version', async () => {
  await render();
  assert.match(host.textContent, /Example version: 1\.2\.3-beta\.1\+build\.4/);
  assert.deepEqual(requests, [
    '/next/lynx-examples/first/example-metadata.json',
  ]);
  await render({ example: 'second' });
  assert.match(host.textContent, /Example version: 2\.0\.0/);
  assert.doesNotMatch(host.textContent, /1\.2\.3-beta/);
  await render({ example: 'unversioned' });
  assert.doesNotMatch(host.textContent, /Example version:/);
});

test('client replaces or suppresses the default footer', async () => {
  await render({ rightFooter: 'Host release v3' });
  const textFooter = host.querySelector('span[title="Host release v3"]');
  assert.equal(textFooter?.textContent, 'Host release v3');
  assert.doesNotMatch(host.textContent, /Example version:/);
  await render({ rightFooter: h('span', null, 'Host release v3') });
  assert.match(host.textContent, /Host release v3/);
  assert.equal(host.querySelector('span[title="Host release v3"]'), null);
  assert.doesNotMatch(host.textContent, /Example version:/);
  for (const rightFooter of [null, false, '']) {
    await render({ rightFooter });
    assert.doesNotMatch(host.textContent, /Example version:|Host release v3/);
  }
  await render({}, { useLang: () => 'zh-CN' });
  assert.match(host.textContent, /示例版本：1\.2\.3/);
});

for (const [img, expected] of [
  ['/images/demo.png', '/next/images/demo.png'],
  ['/next/images/demo.png', '/next/images/demo.png'],
  ['https://cdn.example.test/demo.png', 'https://cdn.example.test/demo.png'],
  ['//cdn.example.test/demo.png', '//cdn.example.test/demo.png'],
  ['images/demo.png', 'images/demo.png'],
  ['data:image/png;base64,AA==', 'data:image/png;base64,AA=='],
]) {
  test(`preview media preserves the URL meaning of ${img}`, async () => {
    await render({ img });
    assert.equal(host.querySelector('img').getAttribute('src'), expected);
  });
}

test('localized native-framework and poweredBy links resolve the site base', async () => {
  await render(
    { nativeFramework: 'lynxtron', _forceMobile: true },
    {
      useLang: () => 'zh-CN',
      poweredBy: '/embedding',
      nativeFrameworks: {
        lynxtron: {
          learnMoreUrl: { en: '/lynxtron/go', cn: '/zh/lynxtron/go' },
        },
      },
    },
  );
  const links = [...host.querySelectorAll('a')].map((link) =>
    link.getAttribute('href'),
  );
  assert(links.includes('/next/zh/lynxtron/go'), links.join(', '));
  assert(links.includes('/next/embedding'), links.join(', '));
});

test('external example data retains its origin', async () => {
  await render({}, { exampleBasePath: 'https://assets.example.test/examples' });
  assert.deepEqual(requests, [
    'https://assets.example.test/examples/first/example-metadata.json',
  ]);
});

for (const [exampleBasePath, expected] of [
  ['/lynx-examples', 'https://go.example.test/next/host/index.html'],
  [
    'https://assets.example.test/examples',
    'https://assets.example.test/host/index.html',
  ],
]) {
  test(`Web host root follows the asset origin for ${exampleBasePath}`, async () => {
    await render(
      { example: 'host', mode: 'ultra', webPreview: true },
      { exampleBasePath },
    );
    assert.equal(host.querySelector('iframe').getAttribute('src'), expected);
    assert.doesNotMatch(host.textContent, /Example version:/);
  });
}

test('download fallback uses the base without changing the deep-link scheme', async () => {
  await render(
    { nativeFramework: 'lynxtron' },
    { nativeFrameworks: { lynxtron: { downloadUrl: '/lynxtron/download' } } },
  );
  const link = host.querySelector('a[href^="lynxtron-go:"]');
  assert(link);
  assert(
    decodeURIComponent(link.getAttribute('href')).includes(
      'https://go.example.test/next/lynx-examples/first/dist/main.lynx.bundle',
    ),
  );
  const originalTimer = window.setTimeout;
  let finishProbe;
  window.setTimeout = (callback, delay, ...args) => {
    if (delay === 5000) {
      finishProbe = callback;
      return 987654;
    }
    return originalTimer(callback, delay, ...args);
  };
  try {
    link.addEventListener('click', (event) => event.preventDefault());
    act(() => {
      link.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    assert.equal(typeof finishProbe, 'function');
    act(() => finishProbe());
    assert(host.querySelector('a[href="/next/lynxtron/download"]'));
  } finally {
    window.setTimeout = originalTimer;
  }
});

test('React SSG and pure Node HTML preserve default, override and hide semantics', () => {
  function ssg(props = {}, overrides = {}) {
    return renderToStaticMarkup(
      h(
        GoConfigProvider,
        { config: { ...config, ssgExampleRoot: exampleRoot, ...overrides } },
        h(ExamplePreviewSSG, { example: 'first', ...props }),
      ),
    );
  }
  const options = { exampleRoot, example: 'first' };
  for (const output of [ssg(), generateSSGHTML(options)]) {
    assert.match(output, /Example version: 1\.2\.3-beta\.1\+build\.4/);
  }
  for (const rightFooter of [null, false, '']) {
    assert.doesNotMatch(ssg({ rightFooter }), /Example version:/);
    assert.doesNotMatch(
      generateSSGHTML({ ...options, rightFooter }),
      /Example version:/,
    );
  }
  assert.match(
    ssg({ rightFooter: h('a', { href: '/release' }, 'Host release') }),
    /<a href="\/release">Host release<\/a>/,
  );
  const textSSG = ssg({ rightFooter: '<Host release>' });
  assert.match(textSSG, /<span[^>]*title="&lt;Host release&gt;"/);
  assert.match(textSSG, />&lt;Host release&gt;<\/span>/);
  assert.doesNotMatch(textSSG, /Example version:/);
  assert.match(
    generateSSGHTML({ ...options, rightFooter: '<Host release>' }),
    /&lt;Host release&gt;/,
  );
  assert.doesNotMatch(ssg({ mode: 'ultra' }), /Example version:/);
  assert.doesNotMatch(ssg({ example: 'unversioned' }), /Example version:/);
  assert.doesNotMatch(
    generateSSGHTML({ ...options, example: 'unversioned' }),
    /Example version:/,
  );
});
