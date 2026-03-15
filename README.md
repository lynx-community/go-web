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

## Development

```bash
pnpm dev
```

This starts the standalone example app at `localhost:3000`.

## CI

All three checks must pass on every PR:

- **Type Check** — `pnpm typecheck` at the repo root
- **Build Example App** — standalone Rsbuild example
- **Build Rspress Example** — rspress integration example

## License

Apache-2.0
