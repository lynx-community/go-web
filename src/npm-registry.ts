/**
 * Runtime helpers for fetching example packages from the npm registry
 * and serving their files via the jsdelivr CDN.
 *
 * Supports multiple package scopes (@lynx-example, @vue-lynx-example, etc.)
 * via the shared EXAMPLE_SCOPES configuration.
 *
 * This module enables fetching any version of any example package directly
 * in the browser — no build-time preparation needed.
 */

const JSDELIVR_DATA_BASE = 'https://data.jsdelivr.com/v1/packages/npm';
const JSDELIVR_CDN_BASE = 'https://cdn.jsdelivr.net/npm';

// --- Scope configuration (shared source of truth) ---

export interface ExampleScopeConfig {
  /** npm scope including trailing slash, e.g. '@lynx-example/' */
  scope: string;
  /** Directory/shortName prefix for this scope, e.g. '' or 'vue-' */
  prefix: string;
  /** Git base URL for linking to example source */
  exampleGitBaseUrl: string;
}

export const EXAMPLE_SCOPES: ExampleScopeConfig[] = [
  {
    scope: '@lynx-example/',
    prefix: '',
    exampleGitBaseUrl:
      'https://github.com/lynx-family/lynx-examples/tree/main',
  },
  {
    scope: '@vue-lynx-example/',
    prefix: 'vue-',
    exampleGitBaseUrl: 'https://github.com/Huxpro/vue-lynx/tree/main',
  },
];

// --- Types ---

export interface NpmPackageInfo {
  name: string;
  shortName: string;
  scope: ExampleScopeConfig;
  description?: string;
  version: string;
}

export interface PackageVersionInfo {
  version: string;
}

interface JsdelivrFile {
  name: string;
  hash: string;
  size: number;
}

interface JsdelivrEntry {
  type: 'file' | 'directory';
  name: string;
  hash?: string;
  size?: number;
  files?: JsdelivrEntry[];
}

// --- Public API ---

/**
 * Look up the scope config for a given package name.
 */
export function findScopeForPackage(
  packageName: string,
): ExampleScopeConfig | undefined {
  return EXAMPLE_SCOPES.find((s) => packageName.startsWith(s.scope));
}

/**
 * Search the npm registry for example packages across all configured scopes.
 */
export async function searchExamplePackages(): Promise<NpmPackageInfo[]> {
  const results = await Promise.all(
    EXAMPLE_SCOPES.map(async (scopeConfig) => {
      const encoded = encodeURIComponent(
        scopeConfig.scope.slice(0, -1), // drop trailing /
      );
      const url = `https://registry.npmjs.org/-/v1/search?text=${encoded}&size=250`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`npm search failed: HTTP ${res.status}`);
      const data = await res.json();
      return data.objects
        .filter((obj: any) =>
          obj.package.name.startsWith(scopeConfig.scope),
        )
        .map((obj: any) => ({
          name: obj.package.name,
          shortName:
            scopeConfig.prefix +
            obj.package.name.replace(scopeConfig.scope, ''),
          scope: scopeConfig,
          description: obj.package.description,
          version: obj.package.version,
        }));
    }),
  );

  return results
    .flat()
    .sort((a: NpmPackageInfo, b: NpmPackageInfo) =>
      a.shortName.localeCompare(b.shortName),
    );
}

/**
 * Fetch all published versions for a given package.
 */
export async function fetchPackageVersions(
  packageName: string,
): Promise<PackageVersionInfo[]> {
  const res = await fetch(`${JSDELIVR_DATA_BASE}/${packageName}`);
  if (!res.ok)
    throw new Error(`jsdelivr versions failed: HTTP ${res.status}`);
  const data = await res.json();
  // versions come newest-first from jsdelivr
  return (data.versions ?? []).map((v: any) => ({ version: v.version }));
}

/**
 * Fetch file listing for a specific package version from jsdelivr.
 * Returns a flat list of relative file paths (matching the format of
 * the build-time example-metadata.json `files` field).
 */
export async function fetchPackageFiles(
  packageName: string,
  version: string,
): Promise<string[]> {
  const res = await fetch(`${JSDELIVR_DATA_BASE}/${packageName}@${version}`);
  if (!res.ok)
    throw new Error(`jsdelivr package files failed: HTTP ${res.status}`);
  const data = await res.json();
  return flattenJsdelivrTree(data.files ?? []);
}

/**
 * Build a CDN URL for a specific file in a package version.
 */
export function getCdnFileUrl(
  packageName: string,
  version: string,
  filePath: string,
): string {
  return `${JSDELIVR_CDN_BASE}/${packageName}@${version}/${filePath}`;
}

/**
 * Build a CDN base URL for a package version (used as exampleBasePath).
 */
export function getCdnBaseUrl(
  packageName: string,
  version: string,
): string {
  return `${JSDELIVR_CDN_BASE}/${packageName}@${version}`;
}

// --- ExampleMetadata construction ---

import type { ExampleMetadata } from './example-preview';

const LYNX_ENTRY_SUFFIX = '.lynx.bundle';
const WEB_ENTRY_SUFFIX = '.web.bundle';
const PREVIEW_IMAGE_RE = /^preview-image\.(png|jpg|jpeg|webp|gif)$/;
const IGNORE_FILES = ['LICENSE', '.DS_Store', 'example-metadata.json'];

/**
 * Construct an ExampleMetadata object from a jsdelivr file listing,
 * compatible with the existing ExamplePreview component.
 */
export async function fetchExampleMetadata(
  packageName: string,
  version: string,
): Promise<ExampleMetadata> {
  const allFiles = await fetchPackageFiles(packageName, version);
  const scopeConfig = findScopeForPackage(packageName);
  const shortName = scopeConfig
    ? packageName.replace(scopeConfig.scope, '')
    : packageName;

  const filtered = allFiles.filter(
    (f) => !PREVIEW_IMAGE_RE.test(f) && !IGNORE_FILES.includes(f),
  );

  const sorted = sortFiles(filtered);
  const previewImage = allFiles.find((f) => PREVIEW_IMAGE_RE.test(f));
  const templateFiles = getTemplateFiles(filtered);

  // Try to read repository.directory from package.json for the name field
  let name = shortName;
  try {
    const pkgUrl = getCdnFileUrl(packageName, version, 'package.json');
    const res = await fetch(pkgUrl);
    if (res.ok) {
      const pkg = await res.json();
      if (pkg.repository?.directory) {
        name = pkg.repository.directory;
      }
    }
  } catch {
    // ignore — use shortName
  }

  return {
    name,
    files: sorted,
    templateFiles,
    previewImage,
    exampleGitBaseUrl:
      scopeConfig?.exampleGitBaseUrl ?? EXAMPLE_SCOPES[0].exampleGitBaseUrl,
  };
}

// --- Internal helpers ---

function flattenJsdelivrTree(
  entries: JsdelivrEntry[],
  prefix = '',
): string[] {
  const result: string[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === 'file') {
      result.push(path);
    } else if (entry.type === 'directory' && entry.files) {
      result.push(...flattenJsdelivrTree(entry.files, path));
    }
  }
  return result;
}

function getTemplateFiles(
  files: string[],
): ExampleMetadata['templateFiles'] {
  const entries: ExampleMetadata['templateFiles'] = [];
  for (const file of files) {
    if (file.endsWith(LYNX_ENTRY_SUFFIX)) {
      const parts = file.split('/');
      const basename = parts[parts.length - 1];
      const name =
        basename.replace(LYNX_ENTRY_SUFFIX, '') ||
        parts[parts.length - 2] ||
        '';
      const entry: ExampleMetadata['templateFiles'][number] = { name, file };
      const webFile = file.replace(LYNX_ENTRY_SUFFIX, WEB_ENTRY_SUFFIX);
      if (files.includes(webFile)) {
        entry.webFile = webFile;
      }
      entries.push(entry);
    }
  }
  return entries;
}

function sortFiles(files: string[]): string[] {
  const dirs = files.filter((f) => f.includes('/')).sort();
  const flat = files.filter((f) => !f.includes('/')).sort();
  return [...dirs, ...flat];
}
