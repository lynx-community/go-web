# Contributing to Lynx Go Web

This repository develops `@lynx-js/go-web` and its standalone and
Rspress example apps.

## Prerequisites

- Node.js matching `engines.node` in `package.json`, currently
  `^22 || ^24`. CI uses Node.js 24.
- pnpm 10.33.0, pinned by the root `packageManager` field.
- Network access to npm and GitHub for example preparation.

Enable pnpm through Corepack:

```sh
corepack enable pnpm
```

## Install and develop

Clone the repository and install from its root:

```sh
git clone https://github.com/lynx-community/go-web.git
cd go-web
pnpm install --frozen-lockfile
```

Start the standalone example:

```sh
pnpm dev
```

The root command installs dependencies in `example/`, prepares example
assets, and starts the app at `http://localhost:5969`.
The app imports package source directly, so edits in `src/` appear
without a package build.

For the Rspress integration:

```sh
pnpm --dir example-rspress install --frozen-lockfile
pnpm --dir example-rspress dev
```

Open the address printed by Rspress. This example consumes the root
package through `file:..`.

To check a deployment base locally:

```sh
GO_WEB_BASE=/next/ pnpm --dir example-rspress dev
```

Visit `/next/versioning` to inspect version footers and site-root media.

The root, examples, and React compatibility fixture have separate
manifests and lockfiles. Install each app you use; this repository is
not a pnpm workspace.
When changing dependencies, update the corresponding lockfile with
`pnpm install` in that package directory.

## Example assets

Each example app's install lifecycle runs its own `prepare` script.
It downloads published Lynx examples and generates preview metadata.
The standalone app also fetches a pinned GitHub release tarball.

Preparation reuses existing assets. Refresh them explicitly when needed:

```sh
pnpm --dir example prepare:clean
pnpm --dir example-rspress prepare:clean
```

Run the refresh only for the app you are using. To reuse its cache:

```sh
pnpm --dir example prepare
pnpm --dir example-rspress prepare
```

At the repository root, `pnpm prepare` installs Husky hooks.
Use the app-specific commands above to prepare example assets.
Generated assets, dependencies, and build output are gitignored.

## Checks

Run formatting and root type checking:

```sh
pnpm format:check
pnpm typecheck
```

Use `pnpm format` to apply repository-wide formatting, or run Prettier
on the files you changed. The pre-commit hook formats staged files with
`lint-staged`.

Build the examples using the same preparation as CI:

```sh
pnpm --dir example install --frozen-lockfile
pnpm --dir example prepare:clean
pnpm --dir example build
pnpm --dir example-rspress install --frozen-lockfile
pnpm --dir example-rspress prepare:clean
pnpm --dir example-rspress build
```

PR CI requires formatting, root type checking, React 18 and 19
compatibility checks, and both example builds.
There is no package build script.
Root type checking excludes `src/adapters/rspress.tsx`, which resolves
Rspress and `@theme` imports in a consumer site.
For adapter changes, check its types in that context and build the site.

The development dependencies currently use React 18. For compatibility
changes, verify the affected source and interactions against both React
18 and 19 with matching runtime and type packages.

Run the same React compatibility checks locally and in CI:

```sh
pnpm test:react
```

To check one major, run `pnpm test:react 18` or `pnpm test:react 19`.
The command installs the test fixture with its frozen lockfile.
React 18 uses root dependencies; React 19 uses the isolated fixture in
`tests/react-compat/`. Root development dependencies stay on React 18.

Each check covers all package source and all five public exports,
including the Rspress adapter against real Rspress theme declarations.
It retains the root's strict settings and `skipLibCheck: true`;
third-party declaration bodies are not fully checked.
The check verifies the actual React and ReactDOM declaration paths,
including type references, and rejects mixed type majors.
Consumer cases cover scoped and global `lynx-view` props and reject
invalid URLs and loading modes.

DOM integration checks run the code component on each React runtime.
They cover highlight scrolling, code changes, and unmounting before a
delayed scroll, as well as example versions, footer overrides and URL
base resolution in client and static rendering. These checks do not
replace testing the full examples or consumer-specific framework
configuration.
Generated bundles and resolution reports stay in `dist/react-compat/`.
The public SSG export is also bundled and exercised in Node without DOM
globals or a stylesheet loader; style imports fail this check.

## Pull requests

- Keep each PR focused on one problem and its resulting behavior.
- Use a Conventional Commit style PR title suitable for squash merging.
- Describe the problem, the change, and relevant validation in English.
  Link related issues and note any remaining limitations.
- Keep titles and commit subjects within 72 characters. Wrap prose in
  commit bodies, PR descriptions, and Markdown at 72 characters where
  practical; preserve URLs and code that cannot be split safely.
- Add a changeset when consumers need a new package release:

```sh
pnpm changeset
```

Select `@lynx-js/go-web`, choose the appropriate version bump, and
describe the consumer-visible change. Documentation-only and CI-only
changes generally do not need a release changeset.

## PR package previews

After validation passes, PR CI publishes the root package to
[pkg.pr.new] when changesets added, modified, or renamed by the PR give
`@lynx-js/go-web` a patch, minor, or major version bump.
PRs without a package bump, including empty changesets, skip publishing.
The preview job still participates in the aggregate `Done` check.

Changesets uses `changedFilePatterns: ["src/**"]` to identify package
changes. Documentation and CI files do not count as package changes.

The gate supports the repository's Changesets 2.30.0. It checks for
changed changeset files before running `pnpm changeset status`, since
that version fails for source changes without changesets. PRs without
changesets skip previews even when they change source; this gate does
not require a changeset for every source edit.
CLI or parsing errors fail CI instead of being treated as a skip.

Use the commit-specific package URL from the preview's PR comment:

```sh
pnpm add "@lynx-js/go-web@<preview-url>"
```

Replace `<preview-url>` with the generated HTTPS URL. A commit-specific
URL lets consumers reproduce the revision they tested.
Previews contain the same TS/TSX and SCSS source as npm releases.
Validate through the installed preview, including Rspress integration.

Maintainers must enable the [pkg.pr.new GitHub App] for
`lynx-community/go-web`. Publishing uses a `pull_request` workflow with
read-only repository permissions and no npm credentials.
Fork PRs use the same workflow, subject to GitHub's workflow approval.

Run the preview gate's integration checks locally with:

```sh
node --test .github/scripts/preview-package.test.mjs
```

## Commits

Follow [Conventional Commits] and use concise, direct English:

```text
fix(react): support scoped JSX declarations

Consumers check the published TSX against their React types.
Declare lynx-view in scoped JSX while retaining React 18 support.

issue: #123
TEST: React 18 and 19 type checks; example builds
```

Limit every commit message line to 72 characters.
Explain why the change is needed and how it affects users or was
verified. Use `fix(deps)` for dependency upgrades.

Optional footer names are case-sensitive: `issue`, `doc`, and `TEST`.
Use at most one `TEST` footer; combine checks with semicolons or
summarize them to stay within the line limit.

## Package and release workflow

- `src/`: package implementation, styles, and public entry points.
- `example/`: standalone Rsbuild gallery and embed host.
- `example-rspress/`: Rspress integration example.
- `example-iframe-embed/`: plain HTML iframe embed example.
- `.changeset/`: release notes and versioning configuration.
- `.github/`: shared CI setup, validation, and release workflows.

The npm package currently exports TS/TSX source, including its Rspress,
SSG, embed, and auto-gesture subpaths. Consumer bundlers process that
source and its SCSS. Validate packaging changes through an installed
tarball, since source imports do not exercise the publish contract.

Changesets maintains a release PR after changes reach `main`.
Merging its `changeset-release/*` branch triggers the validated npm
publish workflow. Contributors supply changesets; maintainers handle
release PRs and publishing.

[Conventional Commits]: https://www.conventionalcommits.org/
[pkg.pr.new]: https://pkg.pr.new/
[pkg.pr.new GitHub App]: https://github.com/apps/pkg-pr-new
