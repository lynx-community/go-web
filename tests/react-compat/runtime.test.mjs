import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://go.example.test/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {
  act,
  createElement,
  createRoot,
  version,
  Code,
  GoConfigProvider,
  HighlightCodeBlock,
} = await import(pathToFileURL(process.env.GO_WEB_REACT_BUNDLE).href);
assert.equal(version.split('.')[0], process.env.GO_WEB_REACT_MAJOR);

let host;
let root;
let calls;
let errors;
let firstShows;
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const captureError = (event) => errors.push(event.error);

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  calls = [];
  errors = [];
  firstShows = [];
  host.scrollTo = (options) => calls.push(options);
  window.addEventListener('error', captureError);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.removeEventListener('error', captureError);
  assert.deepEqual(errors, []);
});

after(() => dom.window.close());

function render(overrides = {}) {
  act(() => {
    root.render(
      createElement(
        GoConfigProvider,
        { config: { CodeBlock: HighlightCodeBlock } },
        createElement(Code, {
          val: 'const value = 1;',
          language: 'ts',
          highlight: '{4}',
          isFirstShowCode: true,
          setIsFirstShowCode: (value) => firstShows.push(value),
          ...overrides,
        }),
      ),
    );
  });
}

test('scrolls the parent to the first highlighted line', async () => {
  render();
  const container = host.firstElementChild;
  const line = host.querySelector('span.highlighted');
  container.getBoundingClientRect = () => ({ top: 60 });
  line.getBoundingClientRect = () => ({ top: 260 });
  await act(nextTask);
  assert.deepEqual(firstShows, [false]);
  assert.deepEqual(calls, [{ top: 150, behavior: 'smooth' }]);
});

test('does not scroll when the first highlighted line is already visible', async () => {
  render({ highlight: '{2}' });
  await act(nextTask);
  assert.deepEqual(firstShows, [false]);
  assert.deepEqual(calls, []);
});

test('unmounting before the delayed scroll is safe', async () => {
  render();
  act(() => root.unmount());
  root = createRoot(host);
  await act(nextTask);
  assert.deepEqual(calls, []);
});

test('changing code resets the parent scroll position', async () => {
  render({ highlight: undefined, isFirstShowCode: false });
  await act(nextTask);
  assert.deepEqual(calls, []);
  render({
    val: 'const value = 2;',
    highlight: undefined,
    isFirstShowCode: false,
  });
  await act(nextTask);
  assert.deepEqual(calls, [{ top: 0, behavior: 'auto' }]);
});
