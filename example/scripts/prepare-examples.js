/**
 * Fetches all @lynx-example/* and @vue-lynx-example/* packages from the npm
 * registry and extracts them into public/lynx-examples/ with generated
 * example-metadata.json files.
 *
 * Vue examples are placed under a `vue-` prefix so the UI can distinguish them
 * (e.g. @vue-lynx-example/basic → vue-basic/).
 *
 * No node_modules or package.json dependencies needed — always pulls latest.
 *
 * Usage:
 *   node scripts/prepare-examples.js           # cached: skip if output exists
 *   node scripts/prepare-examples.js --clean   # clean: always re-fetch from registry
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const clean = process.argv.includes('--clean');
const outputDir = path.join(rootDir, 'public/lynx-examples');
const outputHostDir = path.join(rootDir, 'public');
const lynxEntryFileName = '.lynx.bundle';
const webEntryFileName = '.web.bundle';

/** Package scopes to fetch, with their directory prefix and git base URL. */
const scopes = [
  {
    scope: '@lynx-example/',
    prefix: '',
    exampleGitBaseUrl: 'https://github.com/lynx-family/lynx-examples/tree/main',
    frameworkVersionKey: 'reactLynxVersion',
    frameworkDep: '@lynx-js/react',
  },
  {
    scope: '@vue-lynx-example/',
    prefix: 'vue-',
    exampleGitBaseUrl: 'https://github.com/Huxpro/vue-lynx/tree/main',
    frameworkVersionKey: 'vueLynxVersion',
    frameworkDep: 'vue-lynx',
    // npm search doesn't reliably index new scoped packages, so we maintain
    // a known list as fallback. The search result is preferred when available.
    knownPackages: [
      '@vue-lynx-example/7guis',
      '@vue-lynx-example/basic',
      '@vue-lynx-example/gallery',
      '@vue-lynx-example/hello-world',
      '@vue-lynx-example/main-thread',
      '@vue-lynx-example/option-api',
      '@vue-lynx-example/pinia',
      '@vue-lynx-example/suspense',
      '@vue-lynx-example/swiper',
      '@vue-lynx-example/tailwindcss',
      '@vue-lynx-example/todomvc',
      '@vue-lynx-example/transition',
      '@vue-lynx-example/vue-router',
    ],
  },
];

/**
 * Examples published as release tarballs instead of npm packages.
 *
 * These ship a complete Web application (`dist/web/index.html`) rather than a
 * bare `.web.bundle`, so go.lynxjs.org hosts them as-is and the Web preview
 * renders them in an iframe. Pinned by tag on purpose: unlike the scope-based
 * npm sources above, this list is the allowlist of examples permitted to ship
 * their own Web host.
 */
const tarballSources = [
  {
    dir: 'lynxtron-cross-platform-notes',
    tarball:
      'https://github.com/lynx-community/lynxtron-examples/releases/download/lynxtron-go-v0.0.7/lynxtron-examples-cross-platform-notes.tgz',
    version: 'lynxtron-go-v0.0.7',
    exampleGitBaseUrl:
      'https://github.com/lynx-community/lynxtron-examples/tree/main',
    nativeFramework: 'lynxtron',
    // Ships build intermediates that duplicate `dist/` entries.
    prune: ['output'],
  },
];

/**
 * Conventional location of a complete Web application inside an example.
 *
 * Such a build bakes an absolute publicPath into its runtime (web workers
 * cannot resolve a document-relative one), so it must be served from a path
 * root rather than nested under the example folder. The convention is:
 *
 *   the artifact is built with base URL `/<name>/`
 *   go hosts `<example>/dist/web/**` at `/<name>/**`
 *
 * `<name>` is the example directory name, which is unique by construction.
 * No server rewrite is involved — the artifact and the host agree on a path.
 */
const webHostDir = 'dist/web';
const webHostEntry = 'index.html';

/** Site path roots a Web host must not claim. */
const reservedHostDirs = new Set(['lynx-examples', 'static', 'embed']);

const ignoreDirs = ['node_modules', '.git', '.turbo'];
const ignoreFiles = ['.DS_Store', 'LICENSE'];

// --- npm registry helpers ---

async function fetchPackagesForScope(scopeConfig) {
  const { scope, knownPackages } = scopeConfig;
  const encoded = encodeURIComponent(scope.slice(0, -1)); // drop trailing /
  const url = `https://registry.npmjs.org/-/v1/search?text=${encoded}&size=250`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Registry search failed: HTTP ${res.status}`);
  const data = await res.json();
  const found = data.objects
    .map((obj) => obj.package.name)
    .filter((name) => name.startsWith(scope));

  // npm search may not index new scoped packages; merge with known list
  const merged = [...new Set([...found, ...(knownPackages ?? [])])].sort();
  return merged;
}

async function fetchPackageMeta(pkgName, scopeConfig) {
  const res = await fetch(`https://registry.npmjs.org/${pkgName}/latest`);
  if (!res.ok)
    throw new Error(`Failed to fetch ${pkgName}: HTTP ${res.status}`);
  const meta = await res.json();
  return {
    tarball: meta.dist.tarball,
    version: meta.version,
    frameworkVersion: meta.dependencies?.[scopeConfig.frameworkDep] ?? null,
  };
}

function downloadAndExtract(tarballUrl, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(
    `curl -sL "${tarballUrl}" | tar xz -C "${destDir}" --strip-components=1`,
    {
      stdio: 'pipe',
    },
  );
}

// --- file processing (unchanged logic) ---

function getAllFiles(dirPath, arrayOfFiles = []) {
  for (const file of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (!ignoreFiles.includes(file)) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

function getTemplateFiles(files, webHostFile) {
  const entries = [];
  for (const file of files) {
    if (file.endsWith(lynxEntryFileName)) {
      const parts = file.split('/');
      const name = parts.at(-1).replace(lynxEntryFileName, '') || parts.at(-2);
      const entry = { name, file };
      const webFile = file.replace(lynxEntryFileName, webEntryFileName);
      if (files.includes(webFile)) entry.webFile = webFile;
      if (webHostFile) entry.webHostFile = webHostFile;
      entries.push(entry);
    }
  }
  return entries;
}

function sortFiles(files) {
  const dirs = files.filter((f) => f.includes('/')).sort();
  const flat = files.filter((f) => !f.includes('/')).sort();
  return [...dirs, ...flat];
}

/**
 * Publish an example's complete Web application at the site path root it was
 * built for, and return the site-absolute entry URL.
 *
 * Returns undefined when the example ships no Web host.
 */
function publishWebHost(destDir, dirName) {
  const sourceDir = path.join(destDir, webHostDir);
  if (!fs.existsSync(path.join(sourceDir, webHostEntry))) return undefined;

  if (reservedHostDirs.has(dirName)) {
    throw new Error(
      `example "${dirName}" cannot publish a Web host: /${dirName}/ is reserved by the site`,
    );
  }

  const hostDir = path.join(outputHostDir, dirName);
  fs.rmSync(hostDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, hostDir, { recursive: true });
  return `/${dirName}/${webHostEntry}`;
}

/** Scan an extracted example and write its `example-metadata.json`. */
function writeExampleMetadata(destDir, extra, webHostFile) {
  const allFiles = getAllFiles(destDir, []);
  const files = allFiles.map((f) => path.relative(destDir, f));
  const previewImageRe = /^preview-image\.(png|jpg|jpeg|webp|gif)$/;
  const filtered = files.filter(
    (f) => !previewImageRe.test(f) && f !== 'example-metadata.json',
  );
  const sorted = sortFiles(filtered);
  const previewImage = files.find((f) => previewImageRe.test(f));
  const templateFiles = getTemplateFiles(filtered, webHostFile);

  fs.writeFileSync(
    path.join(destDir, 'example-metadata.json'),
    JSON.stringify(
      {
        ...extra,
        files: sorted,
        previewImage,
        templateFiles,
      },
      null,
      2,
    ),
  );
  return templateFiles;
}

// --- Main ---

function hasCache() {
  if (!fs.existsSync(outputDir)) return false;
  const entries = fs.readdirSync(outputDir);
  return entries.length > 0;
}

async function main() {
  if (!clean && hasCache()) {
    console.log(
      'Using cached examples in public/lynx-examples/ (use --clean to re-fetch).',
    );
    return;
  }

  // Clean and recreate output
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  let totalCount = 0;

  for (const scopeConfig of scopes) {
    console.log(`Fetching ${scopeConfig.scope}* packages from npm registry…`);
    let packages;
    try {
      packages = await fetchPackagesForScope(scopeConfig);
    } catch (err) {
      console.warn(`  ⚠ failed to fetch ${scopeConfig.scope}*: ${err.message}`);
      continue;
    }
    if (packages.length === 0) {
      console.log(`  No ${scopeConfig.scope}* packages found, skipping.`);
      continue;
    }
    console.log(`  Found ${packages.length} packages.`);

    for (const pkgName of packages) {
      const shortName = pkgName.replace(scopeConfig.scope, '');
      const dirName = `${scopeConfig.prefix}${shortName}`;
      const destDir = path.join(outputDir, dirName);

      let registryMeta;
      try {
        registryMeta = await fetchPackageMeta(pkgName, scopeConfig);
        console.log(`  ${dirName}@${registryMeta.version}`);
        downloadAndExtract(registryMeta.tarball, destDir);
      } catch (err) {
        console.warn(`  ⚠ skipping ${dirName}: ${err.message}`);
        continue;
      }

      // Generate metadata
      const pkgJsonPath = path.join(destDir, 'package.json');
      const pkg = fs.existsSync(pkgJsonPath)
        ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
        : {};

      writeExampleMetadata(
        destDir,
        {
          name: pkg.repository?.directory || shortName,
          version: registryMeta.version,
          [scopeConfig.frameworkVersionKey]: registryMeta.frameworkVersion,
          exampleGitBaseUrl: scopeConfig.exampleGitBaseUrl,
        },
        publishWebHost(destDir, dirName),
      );

      totalCount++;
    }
  }

  for (const source of tarballSources) {
    const destDir = path.join(outputDir, source.dir);
    try {
      console.log(`  ${source.dir}@${source.version}`);
      downloadAndExtract(source.tarball, destDir);
    } catch (err) {
      console.warn(`  ⚠ skipping ${source.dir}: ${err.message}`);
      continue;
    }

    for (const dir of source.prune ?? []) {
      fs.rmSync(path.join(destDir, dir), { recursive: true, force: true });
    }

    const webHostFile = publishWebHost(destDir, source.dir);
    if (webHostFile) {
      console.log(`    ↳ Web host published at ${webHostFile}`);
    } else {
      console.warn(
        `  ⚠ ${source.dir}: no ${webHostDir}/${webHostEntry} — Web preview falls back to the raw bundle.`,
      );
    }

    writeExampleMetadata(
      destDir,
      {
        name: source.dir,
        version: source.version,
        exampleGitBaseUrl: source.exampleGitBaseUrl,
        nativeFramework: source.nativeFramework,
      },
      webHostFile,
    );

    totalCount++;
  }

  console.log(`\nPrepared ${totalCount} examples in public/lynx-examples/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
