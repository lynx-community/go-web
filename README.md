# go-web

Interactive Go component for Lynx documentation sites. Renders live Lynx examples with code browsing, web preview, and QR code for on-device testing.

## Usage

```tsx
import { GoConfigProvider, Go } from '@lynx-js/go-web';

const config = {
  exampleBasePath: '/lynx-examples',
};

<GoConfigProvider config={config}>
  <Go example="hello-world" defaultFile="src/App.tsx" />
</GoConfigProvider>
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
</GoConfigProvider>
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
</GoConfigProvider>
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

## Development

```bash
pnpm dev
```

This starts the standalone example app at `localhost:3000`.

### Lynx examples

The `@lynx-example/*` packages are fetched directly from the npm registry at build time — no need to declare them as dependencies. The `prepare` script handles discovery, download, and metadata generation automatically.

```bash
# Local dev: uses cached examples if available (instant)
pnpm prepare

# Force re-fetch latest from npm registry
pnpm prepare:clean
```

CI always runs `prepare:clean` to ensure examples are up-to-date.

## CI

All three checks must pass on every PR:

- **Type Check** — `pnpm typecheck` at the repo root
- **Build Example App** — standalone Rsbuild example
- **Build Rspress Example** — rspress integration example

## License

Apache-2.0
