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

| Option             | Type                               | Description                                                                                                                                                                                                   |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | `string`                           | **Required.** Example folder name, e.g. `'hello-world'`                                                                                                                                                       |
| `defaultFile`      | `string`                           | Initial file to display (default: `'src/App.tsx'`)                                                                                                                                                            |
| `defaultTab`       | `'preview' \| 'web' \| 'qrcode'`   | Default preview tab                                                                                                                                                                                           |
| `exampleBasePath`  | `string`                           | Base path or full URL for example data, e.g. `'/lynx-examples'`                                                                                                                                               |
| `deepLinkUrl`      | `string`                           | Deep link URL template for opening the app locally. Supports `{{{url}}}` (raw) and `{{{urlEncoded}}}` (encoded) placeholders.                                                                                 |
| `deepLinkTitle`    | `string`                           | Deep link button title (defaults to `go.deeplink.open`)                                                                                                                                                       |
| `img`              | `string`                           | Static preview image URL                                                                                                                                                                                      |
| `defaultEntryFile` | `string`                           | Default entry bundle file path (relative to the example folder), e.g. `'dist/main.lynx.bundle'`. Must match `example-metadata.json` (`templateFiles[].file`). Prefix match is supported (e.g. `'dist/main'`). |
| `defaultEntryName` | `string`                           | Default entry name (from `templateFiles[].name`), e.g. `'main'`. Convenience alternative to `defaultEntryFile` and only used when `defaultEntryFile` is not provided.                                         |
| `highlight`        | `string \| Record<string, string>` | Line highlight spec, e.g. `'{1,3-5}'`. When passing a map, the key is the file path and the value is that file’s highlight spec.                                                                              |
| `entry`            | `string \| string[]`               | Filter entry files in tree, useful for example with multiple entries, e.g. `'src/basic'`                                                                                                                      |

#### Viewport Mode (Web Preview)

These options control how `lynx-view` renders inside the web preview panel.

Web preview bundle resolution is driven by `example-metadata.json` (`templateFiles[].webFile`) for the selected entry; it is not inferred from the Lynx bundle filename automatically.

| Option              | Type                              | Default  | Description                                                                      |
| ------------------- | --------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `webPreview`        | `boolean`                         | `true`   | Enable/disable the web preview tab even if `templateFiles[].webFile` exists      |
| `webPreviewMode`    | `'fit' \| 'responsive' \| 'auto'` | `'auto'` | Viewport rendering mode                                                          |
| `designWidth`       | `number`                          | `375`    | Design canvas width in pixels. Used in `fit` mode.                               |
| `designHeight`      | `number`                          | `812`    | Design canvas height in pixels. Used in `fit` mode.                              |
| `fitThresholdScale` | `number`                          | `1.0`    | Width upper bound for `auto` mode. Switches to `responsive` when wide enough     |
| `fitMinScale`       | `number`                          | `0.6`    | Height lower bound for `auto` mode. Forces `fit` when the container is too short |

Mode behavior:

| Mode           | Behavior                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'responsive'` | `lynx-view` fills the container. `browserConfig` uses measured container dimensions.                                                             |
| `'fit'`        | `lynx-view` is fixed at `designWidth × designHeight`. CSS `transform: scale` fits it into the container. `browserConfig` uses design dimensions. |
| `'auto'`       | Switches based on container size. Behaves like `fit` for small/narrow containers, `responsive` for wide ones.                                    |

Auto switching logic:

```ts
const ratioW = containerWidth / designWidth;
const ratioH = containerHeight / designHeight;

// Equivalent to:
// - containerWidth < designWidth * fitThresholdScale
// - containerHeight < designHeight * fitMinScale
const shouldUseFit = ratioW < fitThresholdScale || ratioH < fitMinScale;
```

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
