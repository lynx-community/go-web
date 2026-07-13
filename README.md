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
  ...rspressAdapter,
};

<GoConfigProvider config={config}>
  <Go example="hello-world" />
</GoConfigProvider>;
```

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

| Option             | Type                                | Description                                                                                                                                                                                                   |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | `string`                            | **Required.** Example folder name, e.g. `'hello-world'`                                                                                                                                                       |
| `defaultFile`      | `string`                            | Initial file to display (default: `'src/App.tsx'`)                                                                                                                                                            |
| `mode`             | `'linked' \| 'preview' \| 'source'` | Overall layout mode (default: `'linked'`). `'linked'` shows code + preview together; `'preview'` shows preview only; `'source'` shows code only.                                                              |
| `defaultTab`       | `'preview' \| 'web' \| 'qrcode'`    | Default preview tab                                                                                                                                                                                           |
| `exampleBasePath`  | `string`                            | Base path or full URL for example data, e.g. `'/lynx-examples'`                                                                                                                                               |
| `img`              | `string`                            | Static preview image URL                                                                                                                                                                                      |
| `defaultEntryFile` | `string`                            | Default entry bundle file path (relative to the example folder), e.g. `'dist/main.lynx.bundle'`. Must match `example-metadata.json` (`templateFiles[].file`). Prefix match is supported (e.g. `'dist/main'`). |
| `defaultEntryName` | `string`                            | Default entry name (from `templateFiles[].name`), e.g. `'main'`. Convenience alternative to `defaultEntryFile` and only used when `defaultEntryFile` is not provided.                                         |
| `highlight`        | `string \| Record<string, string>`  | Line highlight spec, e.g. `'{1,3-5}'`. When passing a map, the key is the file path and the value is that file’s highlight spec.                                                                              |
| `entry`            | `string \| string[]`                | Filter entry files in tree, useful for example with multiple entries, e.g. `'src/basic'`                                                                                                                      |
| `schema`           | `string`                            | URL schema template for Lynx Explorer QR code. Use `{{{url}}}` as placeholder for the resolved entry URL, e.g. `{{{url}}}?bar_color=000000&back_button_style=dark`                                            |

#### Viewport Mode (Web Preview)

These options control how `lynx-view` renders inside the web preview panel.

Web preview bundle resolution is driven by `example-metadata.json` (`templateFiles[].webFile`) for the selected entry; it is not inferred from the Lynx bundle filename automatically.

| Option              | Type                              | Default        | Description                                                                                                     |
| ------------------- | --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| `webPreview`        | `boolean`                         | `true`         | Enable/disable the web preview tab even if `templateFiles[].webFile` exists                                     |
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

### Native modules & multi-page (MPA) previews

By default the web preview renders **one** `<lynx-view>` with no native bridge.
Two opt-in extension points let embedders preview examples that call **native
modules** and that navigate across **multiple Lynx pages**. Both are generic —
go-web has no knowledge of any framework's module names or URL scheme — and both
are backwards compatible: when unset, the preview is byte-for-byte identical to
today.

#### Level A — native environment (`previewNativeEnv` / `nativeEnv`)

Forward a native environment to the previewed `<lynx-view>` so a bundle that
calls a native module renders instead of failing with
`Native module ... is not registered`. Set it site-wide on `GoConfig`
(`previewNativeEnv`) and/or per instance on `<Go>` (`nativeEnv`, shallow-merged
over the config — per-instance keys win).

| Field                 | Type                                    | Description                                                                                               |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `onNativeModulesCall` | `(name, data, moduleName) => any`       | Handler for NativeModule calls made by the bundle. web-core caches calls made before assignment (safe).   |
| `nativeModulesMap`    | `Record<string, string>`                | Native-modules definition: `module-name → ESM url`. Consumed by the worker at init, applied before start. |
| `napiModulesMap`      | `Record<string, string>`                | Napi-modules definition (advanced).                                                                       |
| `onNapiModulesCall`   | `(...) => any`                          | Handler for NapiModule calls (advanced).                                                                  |
| `globalProps`         | `Cloneable \| (entryName) => Cloneable` | Per-card `globalProps` (e.g. a container id / query params). Read when the view starts.                   |
| `initData`            | `Cloneable \| (entryName) => Cloneable` | Per-card `initData`. Read when the view starts.                                                           |

```tsx
import type { GoConfig } from '@lynx-js/go-web';

const config: GoConfig = {
  exampleBasePath: '/lynx-examples',
  previewNativeEnv: {
    onNativeModulesCall: (name, data, moduleName) => {
      // Deliver the call to your host bridge and return the result.
      return myBridge.call(moduleName, name, data);
    },
    nativeModulesMap: { MyModule: 'https://cdn.example.com/my-module.js' },
    globalProps: (entryName) => ({ containerId: `preview:${entryName}` }),
  },
};
```

**Ordering.** `nativeModulesMap` / `napiModulesMap` / `globalProps` / `initData`
are read by web-core when the view starts; go-web assigns them from the element
`ref` (the same path the existing `browserConfig` init uses), which lands before
web-core's async start reads them. `onNativeModulesCall` may be assigned late
because web-core caches pre-assignment calls.

#### Level B — pluggable preview runtime (`PreviewRuntime`)

The built-in renderer shows a single card, so cross-page navigation has nowhere
to go. Set `GoConfig.PreviewRuntime` to **replace just the inner card renderer**
— go-web keeps owning the tab bar, QR, code browser, fit/scaling, and SSG path.
The component receives every previewable entry plus the resolved Level-A
environment:

```tsx
import type { PreviewRuntimeProps } from '@lynx-js/go-web';

function MyRuntime(props: PreviewRuntimeProps) {
  // props.entries      — every entry with a web bundle ({ name, webUrl, file })
  // props.activeEntry  — current entry name
  // props.src          — active entry's web bundle URL
  // props.nativeEnv    — resolved Level-A environment
  // props.designWidth / designHeight / fit / webPreviewMode — scaling params
  // → stack <lynx-view> cards and route navigation between them.
}

const config: GoConfig = {
  exampleBasePath: '/lynx-examples',
  PreviewRuntime: MyRuntime,
};
```

**Two shapes, one hook.** This single slot supports both MPA designs:

- **B1 — in-process card stack (recommended).** Keep a stack of `<lynx-view>`
  cards in React state; push on navigate, pop on `back`. Lower cards stay
  mounted (stable React key) so their heap and state survive the round-trip. No
  cross-origin handshake, type-safe composition, reuses go-web scaling. See the
  runnable prototype in [`example/src/mpa/`](./example/src/mpa/)
  (`StackedPreviewRuntime.tsx` + the framework-agnostic `card-stack.ts`).
- **B2 — iframe runtime.** Render a real `<iframe src={runtimeUrl}>` from your
  `PreviewRuntime` and pass the entries via query/`postMessage`. Because an
  iframe is a real nested browsing context, `window.history` and navigation are
  naturally scoped to it — ideal for an embedder that already has a full-page
  "web shell". It is simply one implementation of the same `PreviewRuntime` hook.

go-web recommends B1 as the default and treats B2 as an escape hatch. Try both
live in the example app via the **Preview** control (`Default` / `Native` /
`MPA`).

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

All checks must pass on every PR:

- **Format Check** — `pnpm format:check`
- **Type Check** — `pnpm typecheck` at the repo root
- **Unit Test** — `pnpm test` (Vitest)
- **Build Example App** — standalone Rsbuild example
- **Build Rspress Example** — rspress integration example

## License

Apache-2.0
