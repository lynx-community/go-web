# Lynx Go Web

The `<Go>` component for embedding live Lynx examples on the web — with code browsing, web preview, and QR code for on-device testing. Initially built for [lynxjs.org](https://lynxjs.org), now extracted for everyone to embed their Lynx apps.

The **[&lt;Go&gt; with Examples](https://go.lynxjs.org)** gallery showcases examples from [`@lynx-example`](https://www.npmjs.com/search?q=%40lynx-example), [`@vue-lynx-example`](https://www.npmjs.com/search?q=%40vue-lynx-example), and more.

Embed examples with [React](#react) or
[Iframe Embed](#iframe-embed-no-react-required).

## React

### Basic usage

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';

const config = {
  exampleBasePath: '/lynx-examples',
};

<GoConfigProvider config={config}>
  <Go example="hello-world" defaultFile="src/App.tsx" />
</GoConfigProvider>;
```

See [React props](#react-props) and [Go configuration](#go-configuration)
for the API reference.

On React 19, import Semi's adapter before rendering `<Go>`:

```tsx
import '@douyinfe/semi-ui/react19-adapter';
```

For Rspress, add it to `builderConfig.source.preEntry`. This enables
Semi's dynamic mounting APIs, including the QR copy confirmation toast.
React 18 does not require this import.

Web previews using `@lynx-js/web-core@0.26.8` also require its
`@lynx-js/lynx-core@0.1.4` optional peer dependency.

### With an adapter (Rspress)

An adapter connects Go to the site's routing, language, theme, and code
renderer. For Rspress, spread `rspressAdapter` into the configuration:

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';

const config = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter, // withBase, useLang, useDark, NoSSR, Link, CodeBlock — not useI18n
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

The adapter uses the Rspress theme `Link` for QR scanning instructions.
Without an adapter, these links use a plain anchor. A custom `config.Link`
receives standard anchor props, including an href resolved by `withBase`;
it must preserve paths that already contain the site's base.

### React props

`GoProps` is an alias of `ExamplePreviewProps`; `Go` and `ExamplePreview`
accept the same props. Import these types from `@lynx-js/go-web`.
All props are optional except `example`.

#### Example and source

| Prop               | Type                               | Description                                                                                                                                  |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | `string`                           | **Required.** Example folder under `config.exampleBasePath`.                                                                                 |
| `defaultFile`      | `string`                           | Initial source file, relative to the example folder. Defaults to `'package.json'`.                                                           |
| `defaultEntryFile` | `string`                           | Initial bundle entry selected by file path in metadata. Tries an exact match, then a prefix match. Takes precedence over `defaultEntryName`. |
| `defaultEntryName` | `string`                           | Initial bundle entry selected by `templateFiles[].name`. Without either entry prop, Go selects the first metadata entry.                     |
| `entry`            | `string \| string[]`               | Source files or directories marked as entries in the code browser. Does not filter metadata bundle entries.                                  |
| `highlight`        | `string \| Record<string, string>` | Line spec such as `'{1,3-5}'`, or a map from file paths to specs. A string applies to `defaultFile`.                                         |
| `langAlias`        | `Record<string, string>`           | File extension to code-language mapping, e.g. `{ cjs: 'js' }`. Keys omit the dot. `.mjs` always uses `'js'`.                                 |

#### Preview

| Prop                | Type                                           | Description                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`              | `'linked' \| 'preview' \| 'source' \| 'ultra'` | Defaults to `'linked'` (code and preview). `'preview'` shows only preview; `'source'` shows only code; `'ultra'` opens the Web preview without Go chrome across the viewport.                                                                      |
| `img`               | `string`                                       | Preview image or video URL. Overrides metadata `previewImage`; without either, no static preview is available.                                                                                                                                     |
| `defaultTab`        | `'preview' \| 'web' \| 'qrcode'`               | Overrides `config.defaultTab`. Without either value, Go chooses the static preview when available, otherwise QR. Web requires a metadata Web entry; QR availability depends on `nativeFramework`.                                                  |
| `webLoadingScreen`  | `'overlay' \| 'preview'`                       | Overrides `config.webLoadingScreen`. When both are omitted, uses `'preview'` if the default tab is Web and a preview image exists, otherwise `'overlay'`. A missing preview image falls back to the overlay; soft refresh always uses the overlay. |
| `webPreview`        | `boolean`                                      | Enables metadata Web entries; defaults to `true`. `false` disables the Web tab and ignores a Web default tab.                                                                                                                                      |
| `webPreviewMode`    | `'fit' \| 'responsive' \| 'auto'`              | Defaults to `'responsive'`. See [Viewport Mode](#viewport-mode-web-preview).                                                                                                                                                                       |
| `designWidth`       | `number`                                       | Design canvas width in pixels; defaults to `375`.                                                                                                                                                                                                  |
| `designHeight`      | `number`                                       | Design canvas height in pixels; defaults to `812`.                                                                                                                                                                                                 |
| `fitThresholdScale` | `number`                                       | Width ratio below which auto mode enters fit; defaults to `1`.                                                                                                                                                                                     |
| `fitMinScale`       | `number`                                       | Height ratio below which auto mode enters fit; defaults to `0.5`.                                                                                                                                                                                  |
| `fit`               | `'contain' \| 'cover' \| 'auto'`               | Scaling policy on the fit path; defaults to `'cover'`.                                                                                                                                                                                             |
| `autoGesture`       | `AutoGestureOptions`                           | Simulated touches after a raw Web bundle has painted and is visible. See [gesture demonstrations](#demonstrating-a-gesture-driven-example).                                                                                                        |

Complete Web applications (`templateFiles[].webHostFile`) run in their
own iframe and take precedence over raw Web bundles (`webFile`).
They own their viewport and gestures; Go's sizing and `autoGesture`
props apply to the raw-bundle `<lynx-view>` preview.

#### Host URLs and custom content

| Prop              | Type                | Description                                                                                                                                                                                |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`          | `string`            | Entry URL template using `{{{url}}}` for the raw bundle URL. Sets the QR URL for universal bundles and takes precedence over `schemaOptions`. See [Native frameworks](#native-frameworks). |
| `schemaOptions`   | `SchemaOptionsData` | Caller-defined host choices and their URL templates. See [Host schema choices](#host-schema-choices).                                                                                      |
| `deepLinkUrl`     | `string`            | URL template for opening a local app. Supports `{{{url}}}` and `{{{urlEncoded}}}`; overrides the native framework's default deep-link template.                                            |
| `nativeFramework` | `string`            | Runtime framework required by the bundle; overrides metadata. Known values include `'lynxtron'` and `'sparkling'`. See [Native frameworks](#native-frameworks).                            |
| `rightFooter`     | `React.ReactNode`   | Content appended after the built-in controls on the footer's right side. No custom content by default. See [Footer content](#footer-content).                                              |
| `qrcodeNote`      | `React.ReactNode`   | Caller-owned guidance in the QR tab. No note by default. See [QR code notes](#qr-code-notes).                                                                                              |

The caller owns custom content styling and localization. String
`qrcodeNote` values receive the built-in text callout.
The built-in SSG output includes source and entry information plus the
example version. It excludes custom footer content, interactive controls
and QR content. On the client, `mode="ultra"` has neither footer nor QR
content.

### Go configuration

`GoConfigProvider` supplies configuration to the Go components below it.
`useGoConfig()` reads the nearest provider. A nested provider replaces
the outer configuration; it does not merge it. Each supplied `GoConfig`
requires `exampleBasePath`. Without a provider, Go uses
`'/lynx-examples'`.

Only `defaultTab` and `webLoadingScreen` have both Config defaults and
instance prop overrides. Instance props take precedence; other Config
fields are not Go props.

#### Assets, defaults, and host information

| Field              | Type                           | Description                                                                                                                                   |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `exampleBasePath`  | `string`                       | **Required in a supplied config.** Public example asset path or full URL, resolved through `withBase`.                                        |
| `defaultTab`       | `PreviewTab`                   | Default tab for instances that omit the prop. Omitted by default, allowing each instance to choose from its available previews.               |
| `webLoadingScreen` | `WebLoadingScreen`             | Default loading policy for instances that omit the prop. Omitted by default, allowing automatic selection.                                    |
| `explorerText`     | `string`                       | App name in universal-bundle scan instructions; defaults to `'Lynx Explorer'`.                                                                |
| `explorerUrl`      | `{ cn?: string; en?: string }` | App links for Chinese and English scan instructions. Omitted entries use built-in quick-start download links.                                 |
| `nativeFrameworks` | `NativeFrameworkOverrides`     | Per-site names, deep-link templates, download URLs, and documentation URLs for known frameworks. See [Native frameworks](#native-frameworks). |
| `poweredBy`        | `boolean \| string`            | `false` hides the Go mark; a string changes its destination. Omitted or `true` links to this repository. See [The Go mark](#the-go-mark).     |
| `i18n`             | `GoI18nOverrides`              | Overrides package-owned `go.*` strings. Missing keys fall back to the selected built-in catalog, then English.                                |

#### Rendering and framework integration

| Field              | Type                                                                 | Description                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ErrorComponent`   | `React.ComponentType<{ example: string; exampleBaseUrl: string }>`   | Replaces the built-in example-loading error panel.                                                                                                                                                                         |
| `SSGComponent`     | `React.ComponentType<GoProps>`                                       | Receives instance props instead of the interactive preview when `import.meta.env.SSG_MD` is enabled. See [SSG](#ssg-static-site-generation).                                                                               |
| `ssgExampleRoot`   | `string`                                                             | Absolute example directory on disk. Required when using the built-in `ExamplePreviewSSG`.                                                                                                                                  |
| `LoadingComponent` | `React.ComponentType<{ visible: boolean }>`                          | Declared in the API, but currently unused by the built-in preview. Setting it does not replace the loading overlay.                                                                                                        |
| `Link`             | `React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement>>` | Link for scan instructions. Receives an `href` resolved through `withBase`; defaults to an anchor.                                                                                                                         |
| `withBase`         | `(path: string) => string`                                           | Resolves the example asset base and scan-instruction links against the site's base path. Defaults to identity.                                                                                                             |
| `useLang`          | `() => string`                                                       | Selects the package's built-in Chinese or English catalog; defaults to English.                                                                                                                                            |
| `useDark`          | `() => boolean`                                                      | Supplies theme state for loading overlays; defaults to the browser's `prefers-color-scheme` setting.                                                                                                                       |
| `NoSSR`            | `React.ComponentType<{ children: React.ReactNode }>`                 | Client-only rendering wrapper; defaults to the built-in wrapper.                                                                                                                                                           |
| `CodeBlock`        | `React.ComponentType`                                                | Source renderer receiving `code: string`, `lang: string`, optional `onRendered: () => void`, and optional `shikiOptions: Record<string, unknown>`. Defaults to plain `<pre><code>` and calls `onRendered` after rendering. |

A custom `CodeBlock` should call `onRendered` after the code DOM is ready
so Go can scroll highlighted lines into view. `rspressAdapter` supplies
`Link`, `withBase`, `useLang`, `useDark`, `NoSSR`, and `CodeBlock`.
It does not supply `i18n`, asset paths, or Node-only SSG integrations.

#### Native frameworks

`nativeFramework` describes the example's runtime requirement.
`config.nativeFrameworks` supplies site-owned host information for that
framework. It accepts these optional fields per known framework:

| Field            | Type           | Description                                                            |
| ---------------- | -------------- | ---------------------------------------------------------------------- |
| `appName`        | `string`       | Human-facing host app name.                                            |
| `deepLinkScheme` | `string`       | Default opening template; supports `{{{url}}}` and `{{{urlEncoded}}}`. |
| `downloadUrl`    | `LocalizedUrl` | Destination offered when a deep-link attempt does not open the app.    |
| `learnMoreUrl`   | `LocalizedUrl` | Documentation link when the viewer's device cannot run the example.    |

`LocalizedUrl` is a string or `{ cn?: string; en?: string }`. A missing
language entry falls back to the other language. These two framework
URLs are used as supplied; resolve site base paths before passing them.

```ts
const config = {
  exampleBasePath: '/lynx-examples',
  nativeFrameworks: {
    sparkling: {
      downloadUrl: {
        en: 'https://example.com/hosts/download',
        cn: 'https://example.com/zh/hosts/download',
      },
      learnMoreUrl: 'https://example.com/hosts',
    },
  },
};
```

Platform affinity is package-owned and cannot be overridden:
`lynxtron` is desktop-only and `sparkling` is mobile-only. Without a
framework requirement, Go offers the universal QR surface.
Unknown frameworks use the desktop-only fallback and need an explicit
`deepLinkUrl`; registry overrides do not register new frameworks.
Desktop-only frameworks hide the QR tab on both desktop and mobile.
When QR is available for a native framework, it encodes the resolved
deep link and hides the generic `schemaOptions` selector.
`schema` still transforms the entry URL passed to the deep-link
template. Use `deepLinkUrl` to override the opening template.

### Customization

#### Host schema choices

For universal bundles, `schemaOptions` maps stable host IDs to
`{ name: string; schema: string }`. `name` is the visible label; `schema`
uses `{{{url}}}` for the selected entry's raw URL.

```tsx
<Go
  example="hello-world"
  schemaOptions={{
    hostA: {
      name: 'Preview App A',
      schema: 'preview-a://open?url={{{url}}}',
    },
    hostB: {
      name: 'Preview App B',
      schema: 'preview-b://open?url={{{url}}}',
    },
  }}
/>
```

Go selects the first host in object key order. Keep IDs stable across
updates to preserve selection and user edits. Existing edited schemas
are retained; unedited schemas follow updated defaults. Empty options
preserve state; removing a host from nonempty options clears its edits.
Incomplete URL edits remain drafts while QR and Copy link use the last
valid schema. An explicit `schema` takes precedence.

The optional legacy `SchemaOptionType.type` and `.prefix` fields are
deprecated; host IDs come from object keys and protocols from schemas.
Host choices change opening URLs and do not establish binary compatibility.

#### Footer content

`rightFooter` accepts text or React content after Go's built-in footer
controls. It adds content to the existing footer; it does not replace
the controls, Go mark, or [example version](#example-version).

```tsx
<Go
  example="hello-world"
  rightFooter={<a href="https://example.com/examples">Example details</a>}
/>
```

The caller owns styling and localization. Omit it, or pass `null`,
`false`, or an empty string, to render no custom footer content.
Static output does not render this slot.

#### QR code notes

Pass `qrcodeNote` to explain an example's host requirements or preview limits:

```tsx
<Go
  example="hello-world"
  defaultTab="qrcode"
  qrcodeNote="Use a compatible host for this example. Changing the schema does not change binary compatibility."
/>
```

Strings receive a compact, theme-aware text callout with preserved line breaks
and automatic wrapping. For custom styling or links, pass a React node:

```tsx
<Go
  example="hello-world"
  qrcodeNote={
    <aside aria-label="Host compatibility">
      Use a compatible host.{' '}
      <a href="https://example.com/hosts">Host details</a>
    </aside>
  }
/>
```

React nodes retain caller-owned styling. The note appears below Copy link
and above the host selector, only while the QR tab is visible. It also
works with an explicit `schema` or a native framework that supports QR
codes. Omit it, or pass `null`, `false`, or an empty string, to leave the
panel unchanged. The caller owns the note's wording and localization.
Source-only SSG output does not include this QR-panel content.

#### The `<Go/>` mark

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

### Example version

The footer displays `example-metadata.json`'s optional `version` immediately
before GitHub and the other actions as `v{version}` by default. Missing, blank or
non-string versions produce no version text. The frameless `ultra` mode
has no client footer.

Use `config.i18n` to override `go.example.version.label` or the tooltip and
assistive description, `go.example.version.description`. The component
adds spacing between the description and version.

`ExamplePreviewSSG` and `generateSSGHTML` include the version as static
`v{version}` text alongside the example content, including in `ultra`
mode. They do not use client i18n overrides or render client footer
slots, styles or controls.

### Site base paths

With the Rspress adapter, site-root paths such as `/images/demo.png` and
`/lynxtron/go` use the configured documentation base. This applies to
`exampleBasePath`, `img` (images and videos), `explorerUrl`,
`nativeFrameworks.*.learnMoreUrl`, `nativeFrameworks.*.downloadUrl`, and
custom `poweredBy` URLs. Pass these paths directly; Go resolves them.

External URLs, protocol-relative URLs, relative paths, and schemes pass
through unchanged. Example-relative metadata files resolve under
`exampleBasePath`; site-root metadata entries such as `webHostFile` use
the site base when the data is on the page's origin. Assets hosted on a
different origin retain that host's root. `schema` and `deepLinkUrl`
remain templates around the resolved entry URL.

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

## Iframe Embed (no React required)

### Basic usage

For non-React sites (Hugo, Jekyll, plain HTML, etc.), use the iframe embed API. The host page only loads a tiny JS file — React runs inside the iframe.

`EmbedOptions` exposes the options below. `rightFooter`, `qrcodeNote`,
`schemaOptions`, `langAlias`, and `autoGesture` are not currently exposed
by `mount()`. React elements, components, and hooks cannot be passed
through this API.

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

### Options

See [Viewport Mode](#viewport-mode-web-preview) for the shared Web
preview options.

| Option             | Type                                           | Description                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | `string`                                       | **Required.** Example folder name, e.g. `'hello-world'`                                                                                                                                                                                                                                             |
| `defaultFile`      | `string`                                       | Initial file to display. Defaults to `'src/App.vue'` for example names starting with `'vue-'`, otherwise `'src/App.tsx'`.                                                                                                                                                                           |
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
| `entry`            | `string \| string[]`                           | Source files or directories marked as entries in the code browser, e.g. `'src/basic'`.                                                                                                                                                                                                              |
| `schema`           | `string`                                       | Entry URL template using `{{{url}}}` for the raw bundle URL. Universal-bundle QR uses the result; native-framework QR, when available, uses the resolved deep link. See [Native frameworks](#native-frameworks).                                                                                    |
| `seamless`         | `boolean`                                      | Adds `seamless=1` to the iframe URL at mount time. The bundled embed page currently does not consume this flag or hide chrome.                                                                                                                                                                      |

### Controls

`mount(container, options)` accepts a CSS selector or an `HTMLElement`
and returns `EmbedControl`: `iframe` is the created element,
`update(partialOptions)` merges options into the existing embed, and
`destroy()` removes it and its parent-page listener.

## Viewport Mode (Web Preview)

These options are shared by React `<Go>` props and iframe `EmbedOptions`.
They control raw-bundle `<lynx-view>` rendering inside the Web preview
panel. Complete Web applications own their viewport.

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for prerequisites, installation,
local development, example assets, CI checks, package previews, and
contribution conventions.

## License

Apache-2.0
