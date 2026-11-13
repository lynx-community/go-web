# Agent guidance

`@lynx-js/go-web` publishes TS/TSX and SCSS source. Consumers compile
that source; preserve public APIs, types, and client/SSG boundaries.

## Code style

- Use TypeScript, ES modules, function components, and hooks. Prefer
  standard Web APIs and follow nearby code and repository formatting.
- Keep source compatible with React 18 and 19. Do not introduce
  React 19-only APIs or types into shared package code.
- Use `React.JSX` for JSX types and custom-element augmentations.
  Preserve global JSX declarations where existing consumers need them.
- Infer types from the owning API or component; give props explicit
  types when inference is insufficient. Do not hide compatibility
  errors with blanket `any` casts or non-null assertions.
- In delayed DOM callbacks, read `ref.current` when the callback runs,
  check for null, then use that local value. Name the element and its
  parent separately.
- Respect browser and server rendering lifecycles. Preserve semantic
  HTML, keyboard access, and focus behavior.

## Contributor guide

Use [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow details:

- [Install and develop](CONTRIBUTING.md#install-and-develop) and
  [Example assets](CONTRIBUTING.md#example-assets): setup and preparation.
- [Checks](CONTRIBUTING.md#checks): validation, including
  `pnpm test:react` for React compatibility changes.
- [Pull requests](CONTRIBUTING.md#pull-requests) and
  [Commits](CONTRIBUTING.md#commits): scope, changesets, and messages.
- [PR package previews](CONTRIBUTING.md#pr-package-previews) and
  [Package and release workflow](CONTRIBUTING.md#package-and-release-workflow):
  validate installed source packages and follow the release process.

Keep local plans/probes in `.reference/`, excluded via
`.git/info/exclude`; use ignored `dist/` for generated test output.
