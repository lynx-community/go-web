# go-web

Interactive Go component for Lynx documentation sites. Renders live Lynx examples with code browsing, web preview, and QR code for on-device testing.

## Usage

```tsx
import { GoConfigProvider, Go } from '@aspect-build/go-web';

const config = {
  exampleBasePath: '/lynx-examples',
};

<GoConfigProvider config={config}>
  <Go example="hello-world" defaultFile="src/App.tsx" />
</GoConfigProvider>
```

### With rspress

```tsx
import { GoConfigProvider, Go } from '@aspect-build/go-web';
import { rspressAdapter } from '@aspect-build/go-web/adapters/rspress';

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

## License

Apache-2.0
