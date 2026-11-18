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
  'Event',
  'MouseEvent',
  'ShadowRoot',
  'SVGElement',
  'getComputedStyle',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
};
window.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});
HTMLElement.prototype.scrollTo = () => {};
// JSDOM does not implement media playback; these tests check the source URL.
window.HTMLMediaElement.prototype.play = async () => {};
window.HTMLMediaElement.prototype.pause = () => {};
// JSDOM does not implement the Range layout API used by Semi Typography.
window.Range.prototype.getBoundingClientRect = () => new window.DOMRect();
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const {
  act,
  createElement,
  createRoot,
  Profiler,
  version,
  renderToStaticMarkup,
  QRCodeSVG,
  Select,
  Toast,
  Tooltip,
  GoConfigProvider,
  GO_I18N_EN,
  ExampleContent,
  ExamplePreview,
  SWRConfig,
  rspressAdapter,
  Go,
  ExamplePreviewSSG,
  generateSSGHTML,
} = await import(pathToFileURL(process.env.GO_WEB_REACT_BUNDLE).href);
assert.equal(version.split('.')[0], process.env.GO_WEB_REACT_MAJOR);
// Controlled Semi selects notify onChange after closing their popup.
// Disable motion in the fixture so DOM assertions do not depend on animation.
Select.defaultProps = { ...Select.defaultProps, motion: false };
Tooltip.defaultProps = {
  ...Tooltip.defaultProps,
  motion: false,
  mouseEnterDelay: 0,
  mouseLeaveDelay: 0,
};

const entryUrl = 'https://assets.example.test/demo/main.lynx.bundle';
const options = {
  // Map keys need not duplicate the caller's type field.
  a: {
    type: 'host-a',
    name: 'Host A',
    schema: 'host-a://open?url={{{url}}}',
    prefix: 'host-a',
  },
  b: {
    type: 'host-b',
    name: 'Host B',
    schema: 'host-b://open?url={{{url}}}',
    prefix: 'host-b',
  },
};
const metadata = {
  name: 'demo',
  files: ['package.json'],
  templateFiles: [
    { name: 'first', file: 'first.lynx.bundle' },
    { name: 'second', file: 'second.lynx.bundle' },
  ],
};
const hostMetadata = {
  name: 'host',
  files: ['package.json'],
  templateFiles: [
    {
      name: 'main',
      file: 'dist/main.lynx.bundle',
      webHostFile: '/host/index.html',
    },
  ],
};
const withBase = (url) => (url.startsWith('/next/') ? url : `/next${url}`);
let host;
let root;
let errors;
let cache;
let onCommit;
let requests;
const originalError = console.error;
const originalFetch = globalThis.fetch;
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const h = createElement;
const legacyCatalog = { ...GO_I18N_EN };
delete legacyCatalog['go.example.version'];

const exampleRoot = path.join(
  path.dirname(fileURLToPath(pathToFileURL(process.env.GO_WEB_REACT_BUNDLE))),
  'examples',
);
const versionMetadata = {
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
for (const [name, data] of Object.entries(versionMetadata)) {
  const dir = path.join(exampleRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'example-metadata.json'), JSON.stringify(data));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }));
}

const config = {
  exampleBasePath: '/lynx-examples',
  useDark: () => false,
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  errors = [];
  cache = new Map();
  onCommit = undefined;
  requests = [];
  console.error = (...args) => errors.push(args.join(' '));
  globalThis.fetch = async (url) => {
    const address = String(url);
    requests.push(address);
    const name = address.split('/').at(-2);
    return {
      ok: true,
      json: async () =>
        versionMetadata[name] ??
        (address.includes('/host/') ? hostMetadata : metadata),
      text: async () => '{}',
    };
  };
});

afterEach(async () => {
  await act(async () => {
    Toast.destroyAll();
    root.unmount();
    await nextTask();
  });
  host.remove();
  console.error = originalError;
  globalThis.fetch = originalFetch;
  // Semi's resize detector reports its own findDOMNode deprecation on
  // React 18. Keep all other diagnostics, especially render-phase updates.
  assert.deepEqual(
    errors.filter((message) => !message.includes('findDOMNode')),
    [],
    'React must not report render-phase updates',
  );
});
after(() => dom.window.close());

function observeCommits(element) {
  return createElement(
    Profiler,
    { id: 'preview', onRender: () => onCommit?.() },
    element,
  );
}

function renderContent(config = {}, overrides = {}) {
  act(() => {
    root.render(
      observeCommits(
        createElement(
          'div',
          null,
          createElement(
            GoConfigProvider,
            { config: { exampleBasePath: '/examples', ...config } },
            createElement(ExampleContent, {
              fileNames: [],
              previewImage: '',
              currentFileName: '',
              currentFile: '',
              updateCurrentName() {},
              isAssetFile: false,
              name: 'demo',
              currentEntryFileUrl: entryUrl,
              currentEntry: 'first',
              entryFiles: metadata.templateFiles,
              setCurrentEntry() {},
              initState: true,
              mode: 'preview',
              defaultTab: 'qrcode',
              ...overrides,
            }),
          ),
        ),
      ),
    );
  });
}

async function renderExample(overrides = {}, config = {}) {
  await act(async () => {
    root.render(
      observeCommits(
        createElement(
          'div',
          null,
          createElement(
            SWRConfig,
            { value: { provider: () => cache } },
            createElement(
              GoConfigProvider,
              { config: { exampleBasePath: '/examples', ...config } },
              createElement(ExamplePreview, {
                example: 'demo',
                mode: 'preview',
                defaultTab: 'qrcode',
                schemaOptions: options,
                ...overrides,
              }),
            ),
          ),
        ),
      ),
    );
    await nextTask();
  });
}

function qrPath(value) {
  const markup = renderToStaticMarkup(createElement(QRCodeSVG, { value }));
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container.querySelector('svg path:last-child').getAttribute('d');
}
function assertQR(value) {
  assert.equal(
    host.querySelector('svg[width="128"] path:last-child').getAttribute('d'),
    qrPath(value),
  );
}
function schemaUrl(schema, url) {
  const resolved = new URL(schema);
  resolved.searchParams.set('url', url);
  return resolved.toString();
}
function editSchema(value) {
  const input = host.querySelector('.semi-input');
  assert(input, 'Schema input is visible');
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function choose(selectIndex, label) {
  const select = host.querySelectorAll('.semi-select')[selectIndex];
  assert(select, `Select ${selectIndex} is visible`);
  await act(async () => {
    select.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTask();
  });
  const option = [...document.querySelectorAll('.semi-select-option')].find(
    (item) => item.textContent.includes(label),
  );
  assert(option, `Option ${label} is visible: ${document.body.textContent}`);
  await act(async () => {
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTask();
  });
}

test('plain scan links preserve English and Chinese spacing and app names', () => {
  renderContent({
    explorerText: 'Example Host',
    explorerUrl: { en: '/download', cn: '/zh/download' },
  });
  let link = host.querySelector('a[href="/download"]');
  assert(link);
  assert.equal(
    link.parentElement.textContent,
    'Scan the QR code with Example Host to preview on device.',
  );
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  renderContent({
    explorerText: '应用',
    explorerUrl: { cn: '/zh/download' },
    useLang: () => 'zh',
  });
  link = host.querySelector('a[href="/zh/download"]');
  assert.equal(link.parentElement.textContent, '请下载 应用 扫描二维码预览');
});

test('Rspress adapter renders the actual theme Link with one version base', () => {
  for (const href of [
    '/download?platform=ios#app',
    '/next/download?platform=ios#app',
  ]) {
    renderContent({
      ...rspressAdapter,
      explorerText: 'Example Host',
      explorerUrl: { en: href },
    });
    const link = host.querySelector('a.rp-link');
    assert(link, 'Theme Link supplies its class');
    assert.equal(link.getAttribute('href'), '/next/download?platform=ios#app');
    assert.equal(link.textContent, 'Example Host');
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
});

test('copying a QR link mounts a Semi toast on the selected React runtime', async () => {
  renderContent();
  const button = [...host.querySelectorAll('button')].find(
    (item) => item.textContent === 'Copy link',
  );
  assert(button, 'QR copy action is visible');
  const execCommand = document.execCommand;
  document.execCommand = (command) => command === 'copy';
  try {
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTask();
    });
    assert.equal(
      document.querySelector('.semi-toast-content')?.textContent,
      'Copied!',
    );
  } finally {
    document.execCommand = execCommand;
  }
});

test('QR notes follow tab visibility and remain beside the host selector', async () => {
  const noteText = 'Changing the schema does not change binary compatibility.';
  const qrcodeNote = createElement(
    'aside',
    { 'aria-label': 'Host compatibility' },
    noteText,
    createElement('a', { href: '/hosts' }, 'Host details'),
  );
  await renderExample({ qrcodeNote, img: '/cover.png' });
  const note = () =>
    host.querySelector('aside[aria-label="Host compatibility"]');
  assert(note(), 'ExamplePreview forwards rich note content to the QR panel');
  assert.equal(note().querySelector('a').getAttribute('href'), '/hosts');
  assert.equal(host.querySelectorAll('.semi-select').length, 2);
  await choose(0, 'Host B');
  await choose(1, 'second');
  assert(note().textContent.includes(noteText));
  const radio = (label) =>
    [...host.querySelectorAll('.semi-radio')].find(
      (element) => element.textContent === label,
    );
  assert(radio('Preview'), 'The image preview tab is available');
  act(() => radio('Preview').click());
  assert.equal(note(), null, 'The note is absent outside the QR tab');
  act(() => radio('QR Code').click());
  assert(note(), 'Returning to the QR tab restores the note');
  await renderExample({ qrcodeNote: 'Updated note', schema: 'fixed://open' });
  const textNote = host.querySelector('p');
  assert.equal(textNote?.textContent, 'Updated note');
  assert.equal(host.querySelectorAll('.semi-select').length, 1);
  for (const qrcodeNote of [undefined, null, false, '']) {
    await renderExample({ qrcodeNote });
    assert(!host.textContent.includes('Updated note'));
    assert.equal(host.querySelectorAll('.semi-select').length, 2);
  }
});

test('QR notes follow native-framework QR availability', () => {
  renderContent(
    {},
    { nativeFramework: 'sparkling', qrcodeNote: 'Mobile host note' },
  );
  assert(host.textContent.includes('Mobile host note'));
  renderContent(
    {},
    { nativeFramework: 'lynxtron', qrcodeNote: 'Desktop host note' },
  );
  assert(!host.textContent.includes('Desktop host note'));
});

test('host edits survive A → B → A and update the rendered QR independently', async () => {
  const original = structuredClone(options);
  renderContent({}, { schemaOptions: options });
  assertQR(schemaUrl(options.a.schema, entryUrl));
  const editedA = 'edited-a://open?url={{{url}}}&schema_probe=1';
  const editedB = 'edited-b://open?url={{{url}}}&schema_probe=2';
  editSchema(editedA);
  assertQR(schemaUrl(editedA, entryUrl));
  await choose(0, 'Host B');
  assert.equal(host.querySelector('.semi-input').value, options.b.schema);
  editSchema(editedB);
  assertQR(schemaUrl(editedB, entryUrl));
  await choose(0, 'Host A');
  assert.equal(host.querySelector('.semi-input').value, editedA);
  assertQR(schemaUrl(editedA, entryUrl));
  await choose(0, 'Host B');
  assert.equal(host.querySelector('.semi-input').value, editedB);
  assertQR(schemaUrl(editedB, entryUrl));
  assert.deepEqual(options, original, 'Caller configuration is not mutated');
});

test('entry switching keeps the selected host and edited schema in ExamplePreview', async () => {
  await renderExample();
  await choose(0, 'Host B');
  const edited = 'edited-b://open?url={{{url}}}&schema_probe=1';
  editSchema(edited);
  const firstUrl = 'https://go.example.test/examples/demo/first.lynx.bundle';
  assertQR(schemaUrl(edited, firstUrl));
  await choose(1, 'second');
  const secondUrl = 'https://go.example.test/examples/demo/second.lynx.bundle';
  assert.equal(host.querySelector('.semi-input').value, edited);
  assert(
    host.querySelectorAll('.semi-select')[0].textContent.includes('Host B'),
  );
  assertQR(schemaUrl(edited, secondUrl));
  // A new prop object does not reset this instance's edits.
  await renderExample({ schemaOptions: structuredClone(options) });
  assert.equal(host.querySelector('.semi-input').value, edited);
  assertQR(schemaUrl(edited, secondUrl));
});

test('schema options reconcile replacements, new defaults and preserved edits', async () => {
  renderContent({}, { schemaOptions: options });
  const edited = 'edited-a://open?url={{{url}}}';
  editSchema(edited);
  const updated = {
    a: {
      ...options.a,
      name: 'Updated A',
      schema: 'new-a://open?url={{{url}}}',
    },
    b: {
      ...options.b,
      name: 'Updated B',
      schema: 'new-b://open?url={{{url}}}',
    },
    c: { ...options.b, name: 'Host C', schema: 'host-c://open?url={{{url}}}' },
  };
  renderContent({}, { schemaOptions: updated });
  assert(host.querySelector('.semi-select').textContent.includes('Updated A'));
  assert.equal(host.querySelector('.semi-input').value, edited);
  assertQR(schemaUrl(edited, entryUrl));
  await choose(0, 'Updated B');
  assert.equal(host.querySelector('.semi-input').value, updated.b.schema);
  assertQR(schemaUrl(updated.b.schema, entryUrl));
  await choose(0, 'Host C');
  assert.equal(host.querySelector('.semi-input').value, updated.c.schema);
  assertQR(schemaUrl(updated.c.schema, entryUrl));
  renderContent({}, { schemaOptions: { b: updated.b } });
  assert(host.querySelector('.semi-select').textContent.includes('Updated B'));
  assert.equal(host.querySelector('.semi-input').value, updated.b.schema);
  assertQR(schemaUrl(updated.b.schema, entryUrl));
  // Removed hosts lose their edits, even if the same key is added again.
  renderContent({}, { schemaOptions: updated });
  await choose(0, 'Updated A');
  assert.equal(host.querySelector('.semi-input').value, updated.a.schema);
  assertQR(schemaUrl(updated.a.schema, entryUrl));
});

test('empty or removed schema options recover when hosts are added', async () => {
  for (const empty of [{}, undefined]) {
    renderContent({}, { schemaOptions: options });
    await choose(0, 'Host A');
    editSchema('edited-a://open?url={{{url}}}');
    renderContent({}, { schemaOptions: empty });
    assertQR(entryUrl);
    if (empty) assert.equal(host.querySelector('.semi-input').value, '');
    else assert.equal(host.querySelector('.semi-input'), null);
    renderContent({}, { schemaOptions: { b: options.b } });
    assert(host.querySelector('.semi-select').textContent.includes('Host B'));
    assert.equal(host.querySelector('.semi-input').value, options.b.schema);
    assertQR(schemaUrl(options.b.schema, entryUrl));
  }
});

test('temporary empty options preserve the selected host and its edits', async () => {
  renderContent({}, { schemaOptions: options });
  const editedA = 'edited-a://open?url={{{url}}}';
  const editedB = 'edited-b://open?url={{{url}}}';
  editSchema(editedA);
  await choose(0, 'Host B');
  editSchema(editedB);
  for (const empty of [{}, undefined]) {
    renderContent({}, { schemaOptions: empty });
    assertQR(entryUrl);
    renderContent({}, { schemaOptions: structuredClone(options) });
    assert(host.querySelector('.semi-select').textContent.includes('Host B'));
    assert.equal(host.querySelector('.semi-input').value, editedB);
    assertQR(schemaUrl(editedB, entryUrl));
  }
  await choose(0, 'Host A');
  assert.equal(host.querySelector('.semi-input').value, editedA);
  assertQR(schemaUrl(editedA, entryUrl));
});

test('incomplete schema drafts keep QR and copy valid across hosts and entries', async () => {
  await renderExample();
  const edited = 'edited-a://open?url={{{url}}}&schema_probe=1';
  editSchema(edited);
  let previewUrl = schemaUrl(
    edited,
    'https://go.example.test/examples/demo/first.lynx.bundle',
  );
  const originalExecCommand = document.execCommand;
  const copied = [];
  document.execCommand = () => {
    copied.push(window.getSelection().toString());
    return true;
  };
  try {
    for (const draft of ['h', 'ht', 'https://', '']) {
      let commitCount = 0;
      onCommit = () => {
        commitCount++;
        assertQR(previewUrl);
      };
      editSchema(draft);
      assert(commitCount > 0, 'The draft commits without changing the QR');
      onCommit = undefined;
      assert.equal(host.querySelector('.semi-input').value, draft);
      assert.equal(
        host.querySelector('.semi-input').getAttribute('aria-invalid'),
        'true',
      );
      const button = [...host.querySelectorAll('button')].find(
        (item) => item.textContent === 'Copy link',
      );
      await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await nextTask();
      });
      assert.equal(copied.at(-1), previewUrl);
    }
    await choose(0, 'Host B');
    assertQR(
      schemaUrl(
        options.b.schema,
        'https://go.example.test/examples/demo/first.lynx.bundle',
      ),
    );
    await choose(0, 'Host A');
    assert.equal(host.querySelector('.semi-input').value, '');
    assertQR(previewUrl);
    await choose(1, 'second');
    previewUrl = schemaUrl(
      edited,
      'https://go.example.test/examples/demo/second.lynx.bundle',
    );
    assert.equal(host.querySelector('.semi-input').value, '');
    assertQR(previewUrl);
    const completed = 'https://host.example.test/open?url={{{url}}}';
    previewUrl = schemaUrl(
      completed,
      'https://go.example.test/examples/demo/second.lynx.bundle',
    );
    onCommit = () => assertQR(previewUrl);
    editSchema(completed);
    assert.equal(
      host.querySelector('.semi-input').getAttribute('aria-invalid'),
      'false',
    );
    assertQR(previewUrl);
  } finally {
    onCommit = undefined;
    document.execCommand = originalExecCommand;
  }
});

test('QR and copied links use the current schema and entry on the first commit', async () => {
  const originalExecCommand = document.execCommand;
  let commits;
  let copied;
  document.execCommand = (command) => {
    assert.equal(command, 'copy');
    copied.push(window.getSelection().toString());
    return true;
  };
  const observe = (isCurrentSelection = () => true) => {
    commits = [];
    copied = [];
    let selectionCommitted = false;
    onCommit = () => {
      const path = host.querySelector('svg[width="128"] path:last-child');
      if (!path) return;
      if (!selectionCommitted) {
        if (!isCurrentSelection()) return;
        selectionCommitted = true;
      }
      const firstCommit = commits.length === 0;
      commits.push({
        qr: path.getAttribute('d'),
        host: host.querySelector('.semi-select')?.textContent,
        schema: host.querySelector('.semi-input')?.value,
      });
      if (firstCommit) {
        const button = [...host.querySelectorAll('button')].find(
          (item) => item.textContent === 'Copy link',
        );
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    };
  };
  const assertCommitted = (url, schema, appName) => {
    assert(commits.length > 0, 'At least one QR render was committed');
    const expectedPath = qrPath(url);
    for (const commit of commits) {
      if (appName !== undefined) {
        assert(
          commit.host?.includes(appName),
          'Every committed host matches the current selection',
        );
      }
      assert.equal(
        commit.schema,
        schema,
        'Every committed schema uses the current selection',
      );
      assert.equal(
        commit.qr,
        expectedPath,
        'Every committed QR uses the current selection',
      );
    }
    assert.deepEqual(copied, [url], 'Copy uses the first committed URL');
    onCommit = undefined;
  };
  try {
    observe();
    await renderExample();
    const firstUrl = 'https://go.example.test/examples/demo/first.lynx.bundle';
    assertCommitted(schemaUrl(options.a.schema, firstUrl), options.a.schema);
    const edited = 'edited-a://open?url={{{url}}}';
    observe();
    editSchema(edited);
    assertCommitted(schemaUrl(edited, firstUrl), edited);
    // Semi closes the popup before notifying controlled onChange. Observe
    // the first commit displaying the new host, before passive effects run.
    // A stale schema must be recorded so the assertions reject it.
    observe(() =>
      host.querySelector('.semi-select').textContent.includes(options.b.name),
    );
    await choose(0, 'Host B');
    assertCommitted(
      schemaUrl(options.b.schema, firstUrl),
      options.b.schema,
      options.b.name,
    );
    observe(() =>
      host.querySelectorAll('.semi-select')[1].textContent.includes('second'),
    );
    await choose(1, 'second');
    const secondUrl =
      'https://go.example.test/examples/demo/second.lynx.bundle';
    assertCommitted(
      schemaUrl(options.b.schema, secondUrl),
      options.b.schema,
      options.b.name,
    );
    observe();
    await renderExample({ schemaOptions: { a: options.a } });
    assertCommitted(schemaUrl(edited, secondUrl), edited);
  } finally {
    onCommit = undefined;
    document.execCommand = originalExecCommand;
  }
});

test('explicit schema takes priority and hides schemaOptions even after an edit', async () => {
  await renderExample();
  editSchema('edited-a://open?url={{{url}}}&schema_probe=1');
  const schema = 'explicit://open?url={{{url}}}';
  await renderExample({ schema });
  assert.equal(Boolean(host.querySelector('.semi-input')), false);
  assertQR(
    schema.replace(
      '{{{url}}}',
      'https://go.example.test/examples/demo/first.lynx.bundle',
    ),
  );
  await choose(0, 'second');
  assertQR(
    schema.replace(
      '{{{url}}}',
      'https://go.example.test/examples/demo/second.lynx.bundle',
    ),
  );
});

test('mobile frameworks retain their own QR and hide schema controls', () => {
  renderContent(
    {},
    {
      schemaOptions: options,
      nativeFramework: 'sparkling',
      deepLinkUrl: 'sparkling://open?url={{{urlEncoded}}}',
    },
  );
  assert.equal(Boolean(host.querySelector('.semi-input')), false);
  assert.equal(Boolean(host.querySelector('a[href^="/guide/"]')), false);
  assertQR(`sparkling://open?url=${encodeURIComponent(entryUrl)}`);
});

test('desktop frameworks hide QR and schema controls', () => {
  renderContent({}, { schemaOptions: options, nativeFramework: 'lynxtron' });
  assert.equal(Boolean(host.querySelector('.semi-input')), false);
  assert.equal(Boolean(host.querySelector('svg[width="128"]')), false);
});

test('empty schema options fall back to the entry URL', () => {
  renderContent({}, { schemaOptions: {} });
  assertQR(entryUrl);
});

for (const [exampleBasePath, expected] of [
  ['/examples', '/next/examples/demo/example-metadata.json'],
  ['/next/examples', '/next/examples/demo/example-metadata.json'],
  [
    'https://assets.example.test/examples',
    'https://assets.example.test/examples/demo/example-metadata.json',
  ],
]) {
  test(`example data uses one metadata request for ${exampleBasePath}`, async () => {
    await renderExample({}, { withBase, exampleBasePath });
    await act(nextTask);
    assert.deepEqual(requests, [expected]);
    const entry = new URL(
      expected.replace('example-metadata.json', 'first.lynx.bundle'),
      window.location.href,
    ).href;
    assertQR(schemaUrl(options.a.schema, entry));
  });
}

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
            ...props,
          }),
        ),
      ),
    );
    await nextTask();
  });
  await act(nextTask);
}

function versionFooter() {
  return (
    host.querySelector('span[aria-describedby] > span[aria-hidden="true"]')
      ?.parentElement ?? null
  );
}

function visibleVersion() {
  const version = versionFooter();
  return version
    ? [...version.querySelectorAll('[aria-hidden="true"]')]
        .map((part) => part.textContent)
        .join('')
    : null;
}

test('client uses one metadata request and follows the current example version', async () => {
  await render();
  assert.equal(visibleVersion(), 'v1.2.3-beta.1+build.4');
  assert.equal(versionFooter()?.getAttribute('title'), null);
  assert.deepEqual(requests, ['/lynx-examples/first/example-metadata.json']);
  await render({ example: 'second' });
  assert.equal(visibleVersion(), 'v2.0.0');
  assert.doesNotMatch(host.textContent, /1\.2\.3-beta/);
  await render({ example: 'unversioned' });
  assert.doesNotMatch(host.textContent, /Example version:/);
  await render({ example: 'host', mode: 'ultra', webPreview: true });
  assert.doesNotMatch(host.textContent, /Example version:/);
});

test('client replaces or suppresses footer information', async () => {
  await render({ footerInfo: 'Host release v3' });
  const textFooter = host.querySelector('span[title="Host release v3"]');
  assert.equal(textFooter?.textContent, 'Host release v3');
  assert.doesNotMatch(host.textContent, /Example version:/);
  await render({ footerInfo: h('span', null, 'Host release v3') });
  assert.match(host.textContent, /Host release v3/);
  assert.equal(host.querySelector('span[title="Host release v3"]'), null);
  assert.doesNotMatch(host.textContent, /Example version:/);
  for (const footerInfo of [null, false, '']) {
    await render({ footerInfo });
    assert.doesNotMatch(host.textContent, /Example version:|Host release v3/);
  }
});

test('version descriptions use Go i18n independently of the visible prefix', async () => {
  async function assertDescription(prefix) {
    const footer = versionFooter();
    assert(footer);
    const description = `${prefix}1.2.3-beta.1+build.4`;
    assert.equal(footer.getAttribute('title'), null);
    assert.equal(
      footer.querySelector('span:not([aria-hidden])')?.textContent,
      description,
    );
    assert.equal(visibleVersion(), 'v1.2.3-beta.1+build.4');
    await act(async () => {
      footer.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await nextTask();
    });
    const tooltip = document.getElementById(
      footer.getAttribute('aria-describedby'),
    );
    assert(tooltip);
    assert.equal(tooltip.getAttribute('role'), 'tooltip');
    assert.equal(tooltip.textContent, description);
    assert(host.contains(tooltip), 'tooltip stays inside the widget');
    await act(async () => {
      footer.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
      await nextTask();
    });
  }
  for (const [lang, prefix] of [
    ['en', 'Example version: '],
    ['zh-CN', '示例版本：'],
    ['fr-FR', 'Example version: '],
  ]) {
    await render({}, { useLang: () => lang });
    await assertDescription(prefix);
    await render({}, { useLang: () => lang, i18n: legacyCatalog });
    await assertDescription(prefix);
    await render(
      {},
      {
        useLang: () => lang,
        i18n: {
          ...legacyCatalog,
          'go.example.version': 'Version de l’exemple : ',
        },
      },
    );
    await assertDescription('Version de l’exemple : ');
  }
});

test('version labels honor instance and config precedence independently of i18n', async () => {
  const config = {
    versionLabel: 'Version: ',
    i18n: { 'go.example.version': 'Example ' },
  };
  await render({}, config);
  assert.equal(visibleVersion(), 'Version: 1.2.3-beta.1+build.4');
  await render({ versionLabel: 'v' }, config);
  assert.equal(visibleVersion(), 'v1.2.3-beta.1+build.4');
  await render({ versionLabel: '' }, config);
  assert.equal(visibleVersion(), '1.2.3-beta.1+build.4');
  assert.equal(
    versionFooter()?.querySelector('span:not([aria-hidden])')?.textContent,
    'Example 1.2.3-beta.1+build.4',
  );
  await render({}, { versionLabel: '' });
  assert.equal(visibleVersion(), '1.2.3-beta.1+build.4');
});

test('footer information precedes GitHub and rightFooter retains its trailing position', async () => {
  await render({ rightFooter: 'Source notes' });
  assert.equal(visibleVersion(), 'v1.2.3-beta.1+build.4');
  assert.match(host.textContent, /Source notes/);
  assert.equal(host.querySelector('span[title="Source notes"]'), null);
  for (const rightFooter of [null, false, '']) {
    await render({ rightFooter });
    assert.equal(visibleVersion(), 'v1.2.3-beta.1+build.4');
  }
  renderContent(
    {},
    {
      mode: 'linked',
      directory: 'examples/demo',
      currentFileName: 'src/App.tsx',
      exampleGitBaseUrl: 'https://github.com/example/examples/tree/main',
      footerInfo: h(
        'a',
        { 'data-footer': 'info', href: '/release' },
        'Release',
      ),
      rightFooter: h(
        'a',
        { 'data-footer': 'right', href: '/notes', style: { width: 64 } },
        h('svg', { role: 'img', 'aria-label': 'Brand', width: 64, height: 20 }),
      ),
    },
  );
  const info = host.querySelector('[data-footer="info"]');
  const right = host.querySelector('[data-footer="right"]');
  assert(
    info.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const footer = info.parentElement.parentElement;
  const actions = footer.lastElementChild;
  assert(info.parentElement.nextElementSibling === actions);
  const github = actions.querySelector('button');
  assert(github, 'The action group starts with GitHub');
  assert.equal(actions.firstElementChild.contains(github), true);
  assert.equal(actions.lastElementChild.contains(right), true);
  assert.equal(right.style.width, '64px');
  assert.equal(right.querySelector('svg')?.getAttribute('width'), '64');
  // No new slot wrapper or small-text renderer may intercept legacy logos.
  assert(right.parentElement === actions);
  const open = window.open;
  let opened;
  window.open = (...args) => {
    opened = args;
  };
  try {
    act(() => github.click());
    assert.deepEqual(opened, [
      'https://github.com/example/examples/tree/main/examples/demo/src/App.tsx',
      '_blank',
    ]);
  } finally {
    window.open = open;
  }
});

for (const [img, expected] of [
  ['/images/demo.png', '/next/images/demo.png'],
  ['/next/images/demo.png', '/next/images/demo.png'],
  ['https://cdn.example.test/demo.png', 'https://cdn.example.test/demo.png'],
  ['//cdn.example.test/demo.png', '//cdn.example.test/demo.png'],
  ['images/demo.png', 'images/demo.png'],
  ['data:image/png;base64,AA==', 'data:image/png;base64,AA=='],
  ['/videos/demo.mp4', '/next/videos/demo.mp4'],
]) {
  test(`preview media preserves the URL meaning of ${img}`, async () => {
    await renderExample(
      { img, defaultTab: 'preview', webPreview: false },
      { withBase },
    );
    await act(nextTask);
    assert.equal(
      host.querySelector('img, video source').getAttribute('src'),
      expected,
    );
  });
}

test('localized native-framework and poweredBy links resolve the site base', () => {
  for (const [lang, expected] of [
    ['en', '/next/lynxtron/go'],
    ['zh-CN', '/next/zh/lynxtron/go'],
  ]) {
    renderContent(
      {
        withBase,
        useLang: () => lang,
        poweredBy: '/embedding',
        nativeFrameworks: {
          lynxtron: {
            learnMoreUrl: { en: '/lynxtron/go', cn: '/zh/lynxtron/go' },
          },
        },
      },
      { nativeFramework: 'lynxtron', _forceMobile: true },
    );
    const links = [...host.querySelectorAll('a')].map((link) =>
      link.getAttribute('href'),
    );
    assert(links.includes(expected), links.join(', '));
    assert(links.includes('/next/embedding'), links.join(', '));
  }
});

for (const href of [
  'https://cdn.example.test/download',
  '//cdn.example.test/download',
  'download',
  'host://download',
]) {
  test(`Explorer and poweredBy links preserve ${href}`, () => {
    renderContent({
      withBase,
      explorerText: 'Example Host',
      explorerUrl: { en: href },
      poweredBy: href,
    });
    assert.equal(host.querySelectorAll(`a[href="${href}"]`).length, 2);
  });
}

for (const [exampleBasePath, expected] of [
  ['/examples', 'https://go.example.test/next/host/index.html'],
  [
    'https://go.example.test/examples',
    'https://go.example.test/next/host/index.html',
  ],
  [
    'https://assets.example.test/examples',
    'https://assets.example.test/host/index.html',
  ],
]) {
  test(`Web host root follows the asset origin for ${exampleBasePath}`, async () => {
    await renderExample(
      { example: 'host', mode: 'ultra' },
      { withBase, exampleBasePath },
    );
    await act(nextTask);
    assert.equal(host.querySelector('iframe').getAttribute('src'), expected);
  });
}

test('download fallback uses the base without changing the deep-link scheme', async () => {
  await renderExample(
    { nativeFramework: 'lynxtron' },
    {
      withBase,
      nativeFrameworks: { lynxtron: { downloadUrl: '/lynxtron/download' } },
    },
  );
  await act(nextTask);
  const link = host.querySelector('a[href^="lynxtron-go:"]');
  assert(link);
  assert(
    decodeURIComponent(link.getAttribute('href')).includes(
      'https://go.example.test/next/examples/demo/first.lynx.bundle',
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
        new MouseEvent('click', { bubbles: true, cancelable: true }),
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
    assert.match(output, />v1\.2\.3-beta\.1\+build\.4<\/p>/);
  }
  for (const lang of ['en', 'zh-CN', 'fr-FR']) {
    assert.match(
      ssg({}, { useLang: () => lang, i18n: legacyCatalog }),
      />v1\.2\.3/,
    );
    assert.match(
      ssg(
        {},
        {
          useLang: () => lang,
          i18n: {
            ...legacyCatalog,
            'go.example.version': 'Version de l’exemple : ',
          },
        },
      ),
      />v1\.2\.3/,
    );
  }
  for (const footerInfo of [null, false, '']) {
    assert.doesNotMatch(ssg({ footerInfo }), />v1\.2\.3/);
    assert.doesNotMatch(
      generateSSGHTML({ ...options, footerInfo }),
      />v1\.2\.3/,
    );
  }
  assert.match(
    ssg({ footerInfo: h('a', { href: '/release' }, 'Host release') }),
    /<a href="\/release">Host release<\/a>/,
  );
  const textSSG = ssg({ footerInfo: '<Host release>' });
  assert.match(textSSG, /<p[^>]*font-size:12px/);
  assert.match(textSSG, />&lt;Host release&gt;<\/p>/);
  assert.doesNotMatch(textSSG, />v1\.2\.3/);
  assert.match(
    generateSSGHTML({ ...options, footerInfo: '<Host release>' }),
    /&lt;Host release&gt;/,
  );
  for (const versionLabel of ['Version: ', '']) {
    const expected = `${versionLabel}1.2.3-beta.1+build.4`;
    assert(ssg({ versionLabel }).includes(`>${expected}</p>`));
    assert(
      generateSSGHTML({ ...options, versionLabel }).includes(
        `>${expected}</p>`,
      ),
    );
  }
  assert.match(ssg({}, { versionLabel: 'Version ' }), />Version 1\.2\.3/);
  assert.match(ssg({}, { versionLabel: '' }), />1\.2\.3/);
  assert.match(
    ssg({ versionLabel: '' }, { versionLabel: 'Version ' }),
    />1\.2\.3/,
  );
  assert.match(ssg({ rightFooter: 'Source notes' }), />v1\.2\.3/);
  assert.match(ssg({ rightFooter: 'Source notes' }), /<\/p>Source notes$/);
  assert.match(
    ssg({ rightFooter: h('a', { href: '/notes' }, 'Source notes') }),
    /<\/p><a href="\/notes">Source notes<\/a>$/,
  );
  assert.match(
    generateSSGHTML({ ...options, rightFooter: 'Source notes' }),
    />v1\.2\.3/,
  );
  assert.match(
    generateSSGHTML({ ...options, rightFooter: 'Source notes' }),
    />Source notes<\/p>/,
  );
  assert.doesNotMatch(
    ssg({ mode: 'ultra', rightFooter: 'Source notes' }),
    />v1\.2\.3|Source notes/,
  );
  assert.doesNotMatch(ssg({ example: 'unversioned' }), />v1\.2\.3/);
  assert.doesNotMatch(
    generateSSGHTML({ ...options, example: 'unversioned' }),
    />v1\.2\.3/,
  );
});
