# Lynx Go Web

The `<Go>` component for embedding live Lynx examples on the web — with code browsing, web preview, and QR code for on-device testing. Initially built for [lynxjs.org](https://lynxjs.org), now extracted for everyone to embed their Lynx apps.

The **[&lt;Go&gt; with Examples](https://go.lynxjs.org)** gallery showcases examples from [`@lynx-example`](https://www.npmjs.com/search?q=%40lynx-example), [`@vue-lynx-example`](https://www.npmjs.com/search?q=%40vue-lynx-example), and more.

## Usage

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';

const config = {
  exampleBasePath: '/lynx-examples',
};

<GoConfigProvider config={config}>
  <Go example="hello-world" defaultFile="src/App.tsx" />
</GoConfigProvider>;
```

### With rspress

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';

const config = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter, // withBase, useLang, useDark, NoSSR, CodeBlock — not useI18n
};

<GoConfigProvider config={config}>
  <Go example="hello-world" />
</GoConfigProvider>;
```

`<Go>` owns its UI chrome strings (`en` / `zh` selected by `useLang`). You do **not** need `go.*` keys in the site's `i18n.json`. Optional wording overrides:

```tsx
const config = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter,
  i18n: {
    'go.refresh': 'Reload preview',
  },
};
```

### The `<Go/>` mark

Every embed carries a `<Go/>` mark in the footer, just ahead of the
`example › file` breadcrumb, printed in the same ink as the lettering around it.
Hovering it lights the glyphs up in link blue and links to this repo — so a
reader who wants the same code-plus-live-preview pane on their own site can find
out what it is and where to get it. (The footer's GitHub button goes to the
_example's_ source, which answers a different question.)

```tsx
const config = {
  exampleBasePath: '/lynx-examples',
  poweredBy: false, // remove it
  // poweredBy: 'https://mysite.dev/embedding', // …or point it at your own page
};
```

Its wording lives in the package's own i18n (`go.poweredby`,
`go.poweredby.cta`) and can be overridden through `config.i18n` like any other
chrome string.

### SSG (Static Site Generation)

go-web ships a built-in SSG component and a pure generation function so that pre-rendered pages include a meaningful code preview instead of an empty placeholder.

#### Option A: React component (rspress / SSR frameworks)

Use `ExamplePreviewSSG` as the `SSGComponent` in your GoConfig. It reads example files from disk at render time during SSG.

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG } from '@lynx-js/go-web/ssg';
import path from 'path';

const config = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter,
  SSGComponent: ExamplePreviewSSG,
  ssgExampleRoot: path.join(__dirname, '../docs/public/lynx-examples'),
};

<GoConfigProvider config={config}>
  <Go example="hello-world" defaultFile="src/App.tsx" />
</GoConfigProvider>;
```

#### Option B: Pure function (build-time injection)

Use `generateSSGHTML()` in your build config to pre-render example previews as static HTML strings at build time, then inject them as environment variables.

```ts
// rsbuild.config.ts
import { generateSSGHTML } from '@lynx-js/go-web/ssg';

const html = generateSSGHTML({
  exampleRoot: path.resolve(__dirname, 'public/lynx-examples'),
  example: 'hello-world',
  defaultFile: 'src/App.tsx',
  lang: 'en',
});
```

The `./ssg` export uses Node.js `fs`/`path` and must not be bundled into browser code.

### Demonstrating a gesture-driven example

A carousel that binds `touchstart`/`touchmove`/`touchend` shows nothing in an
embedded preview: a desktop reader's mouse never reaches it, so it looks like a
still image. `autoGesture` performs the gesture and draws the contact point the
way a device simulator does.

```tsx
<Go
  example="swiper"
  autoGesture={{
    loop: true,
    startDelayMs: 1400,
    steps: [
      {
        path: [
          { x: 0.98, y: 0.3 },
          { x: -0.02, y: 0.3 },
        ],
        iterations: 7,
        durationMs: 520,
        restMs: 2600,
      },
    ],
  }}
/>
```

Coordinates are fractions of the preview's box, so a step survives a resize and
does not need to know the design width. A step may carry `iterations` to repeat
itself before the sequence advances, so a carousel can be walked to its end and
back without the driver knowing anything about carousels.

The events are synthesized, so `isTrusted` is `false` — which is also how the
real thing is told apart: the first trusted pointer or touch stops the playback
and hands the example back to the reader. Playback only runs while the preview
is on screen. Tell readers the gesture is simulated; everything it triggers is
real.

Safari is handled. It refuses `new Touch()` while still shipping the legacy
`document.createTouch`, so the driver probes how this browser will let it build
a `TouchEvent` and caches the answer.

For a site that renders `<lynx-view>` itself rather than through `<Go>`, the
driver is also available on its own — it takes a host element and knows nothing
about Lynx, React, or any framework:

```ts
import { playAutoGesture } from '@lynx-js/go-web/auto-gesture';

const playback = playAutoGesture(hostElement, { steps });
playback.stop();
```

### Iframe Embed (no React required)

For non-React sites (Hugo, Jekyll, plain HTML, etc.), use the iframe embed API. The host page only loads a tiny JS file — React runs inside the iframe.

```html
<div id="demo" style="height: 500px;"></div>
<script type="module">
  import { mount } from 'https://go.lynxjs.org/embed.js';

  const embed = mount('#demo', {
    example: 'hello-world',
    defaultFile: 'src/App.tsx',
  });

  // Switch example dynamically:
  // embed.update({ example: 'css' });

  // Clean up:
  // embed.destroy();
</script>
```

Options:

| Option             | Type                                           | Description                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | `string`                                       | **Required.** Example folder name, e.g. `'hello-world'`                                                                                                                                                                                                                                             |
| `defaultFile`      | `string`                                       | Initial file to display (default: `'src/App.tsx'`)                                                                                                                                                                                                                                                  |
| `mode`             | `'linked' \| 'preview' \| 'source' \| 'ultra'` | Overall layout mode (default: `'linked'`). `'linked'` shows code + preview together; `'preview'` shows preview only; `'source'` shows code only; `'ultra'` is a frameless full-viewport Web preview that dominates the browser viewport including safe-area.                                        |
| `defaultTab`       | `'preview' \| 'web' \| 'qrcode'`               | Default preview tab                                                                                                                                                                                                                                                                                 |
| `webLoadingScreen` | `'overlay' \| 'preview'`                       | What to show while the Web tab loads. When omitted: `'preview'` if `defaultTab` is `'web'` and a preview image exists, otherwise `'overlay'`. `'preview'` keeps the Preview image/video visible until `<lynx-view>` paints, then reveals the Web tab. Soft refresh always uses the spinner overlay. |
| `exampleBasePath`  | `string`                                       | Base path or full URL for example data, e.g. `'/lynx-examples'`                                                                                                                                                                                                                                     |
| `deepLinkUrl`      | `string`                                       | Deep link URL template for opening the app locally. Supports `{{{url}}}` (raw) and `{{{urlEncoded}}}` (encoded) placeholders.                                                                                                                                                                       |
| `nativeFramework`  | `string`                                       | Native framework the bundle requires at runtime, e.g. `'lynxtron'` (desktop) or `'sparkling'` (mobile). Unset = universal (runs anywhere: QR + deep link). Drives whether the QR tab and/or a deep link is shown per platform.                                                                      |
| `img`              | `string`                                       | Static preview image URL                                                                                                                                                                                                                                                                            |
| `defaultEntryFile` | `string`                                       | Default entry bundle file path (relative to the example folder), e.g. `'dist/main.lynx.bundle'`. Must match `example-metadata.json` (`templateFiles[].file`). Prefix match is supported (e.g. `'dist/main'`).                                                                                       |
| `defaultEntryName` | `string`                                       | Default entry name (from `templateFiles[].name`), e.g. `'main'`. Convenience alternative to `defaultEntryFile` and only used when `defaultEntryFile` is not provided.                                                                                                                               |
| `highlight`        | `string \| Record<string, string>`             | Line highlight spec, e.g. `'{1,3-5}'`. When passing a map, the key is the file path and the value is that file's highlight spec.                                                                                                                                                                    |
| `entry`            | `string \| string[]`                           | Filter entry files in tree, useful for example with multiple entries, e.g. `'src/basic'`                                                                                                                                                                                                            |
| `schema`           | `string`                                       | URL schema template for Lynx Explorer QR code. Use `{{{url}}}` as placeholder for the resolved entry URL, e.g. `{{{url}}}?bar_color=000000&back_button_style=dark`                                                                                                                                  |

#### Viewport Mode (Web Preview)

These options control how `lynx-view` renders inside the web preview panel.

Web preview resolution is driven by `example-metadata.json` for the selected
entry. Use `templateFiles[].webFile` for a raw `.web.bundle`, or
`templateFiles[].webHostFile` for a complete Web application entry such as
`dist/web/index.html`. `webHostFile` takes precedence when both are present,
allowing the application to own its runtime, host bridge, and `<lynx-view>`.

| Option              | Type                              | Default        | Description                                                                                                     |
| ------------------- | --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| `webPreview`        | `boolean`                         | `true`         | Enable/disable the web preview tab when `templateFiles[].webHostFile` or `templateFiles[].webFile` exists       |
| `webPreviewMode`    | `'fit' \| 'responsive' \| 'auto'` | `'responsive'` | Viewport rendering mode                                                                                         |
| `designWidth`       | `number`                          | `375`          | Design canvas width in pixels. Used in `fit` mode.                                                              |
| `designHeight`      | `number`                          | `812`          | Design canvas height in pixels. Used in `fit` mode.                                                             |
| `fitThresholdScale` | `number`                          | `1.0`          | Width enter threshold for `webPreviewMode='auto'`. Exit back to `responsive` uses a built-in hysteresis band.   |
| `fitMinScale`       | `number`                          | `0.5`          | Height enter threshold for `webPreviewMode='auto'`. Exit back to `responsive` uses a built-in hysteresis band.  |
| `fit`               | `'contain' \| 'cover' \| 'auto'`  | `'cover'`      | Fit strategy inside the fit path. `auto` uses built-in heuristics, including hysteresis-aware mode transitions. |

Mode behavior:

| Mode           | Behavior                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'responsive'` | `lynx-view` fills the container. `browserConfig` uses measured container dimensions.                                                                                       |
| `'fit'`        | `lynx-view` is fixed at `designWidth × designHeight`. CSS `transform: scale` fits it into the container. `browserConfig` uses design dimensions.                           |
| `'auto'`       | Switches based on container size. Behaves like `fit` for small/narrow containers and `responsive` for wide ones, with a built-in hysteresis band to reduce resize flicker. |

Auto switching logic:

```ts
const ratioW = containerWidth / designWidth;
const ratioH = containerHeight / designHeight;

// Enter condition only:
// - containerWidth < designWidth * fitThresholdScale
// - containerHeight < designHeight * fitMinScale
const shouldUseFit = ratioW < fitThresholdScale || ratioH < fitMinScale;
```

Exit back to `responsive` uses slightly larger internal thresholds, so `auto`
does not switch back and forth on every tiny resize near the boundary.

Transition behavior:

- `fit → fit` on container resize: smooth `transform` transition
- `fit ↔ responsive` mode switch: hard cut, no transition

## Development

```bash
pnpm dev
```

This starts the standalone example app at `localhost:5969`.

### Lynx examples

The `@lynx-example/*` packages are fetched directly from the npm registry at build time — no need to declare them as dependencies. The `prepare` script handles discovery, download, and metadata generation automatically.

```bash
# Local dev: uses cached examples if available (instant)
pnpm prepare

# Force re-fetch latest from npm registry
pnpm prepare:clean
```

CI always runs `prepare:clean` to ensure that examples are up to date.

## CI

All three checks must pass on every PR:

- **Type Check** — `pnpm typecheck` at the repo root
- **Build Example App** — standalone Rsbuild example
- **Build Rspress Example** — rspress integration example

## License

Apache-2.0
