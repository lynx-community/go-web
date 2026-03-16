/**
 * Fetches all @lynx-example/* packages from the npm registry and extracts
 * them into public/lynx-examples/ with generated example-metadata.json files.
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
const lynxEntryFileName = '.lynx.bundle';
const webEntryFileName = '.web.bundle';
const exampleGitBaseUrl =
  'https://github.com/lynx-family/lynx-examples/tree/main';

const ignoreDirs = ['node_modules', '.git', '.turbo'];
const ignoreFiles = ['.DS_Store', 'LICENSE'];

// --- npm registry helpers ---

async function fetchAllExamplePackages() {
  const url =
    'https://registry.npmjs.org/-/v1/search?text=%40lynx-example&size=250';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Registry search failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.objects
    .map((obj) => obj.package.name)
    .filter((name) => name.startsWith('@lynx-example/'))
    .sort();
}

async function fetchPackageMeta(pkgName) {
  const res = await fetch(`https://registry.npmjs.org/${pkgName}/latest`);
  if (!res.ok)
    throw new Error(`Failed to fetch ${pkgName}: HTTP ${res.status}`);
  const meta = await res.json();
  return {
    tarball: meta.dist.tarball,
    version: meta.version,
    reactLynxVersion: meta.dependencies?.['@lynx-js/react'] ?? null,
  };
}

function downloadAndExtract(tarballUrl, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`curl -sL "${tarballUrl}" | tar xz -C "${destDir}" --strip-components=1`, {
    stdio: 'pipe',
  });
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

function getTemplateFiles(files) {
  const entries = [];
  for (const file of files) {
    if (file.endsWith(lynxEntryFileName)) {
      const parts = file.split('/');
      const name = parts.at(-1).replace(lynxEntryFileName, '') || parts.at(-2);
      const entry = { name, file };
      const webFile = file.replace(lynxEntryFileName, webEntryFileName);
      if (files.includes(webFile)) entry.webFile = webFile;
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

// --- Main ---

function hasCache() {
  if (!fs.existsSync(outputDir)) return false;
  const entries = fs.readdirSync(outputDir);
  return entries.length > 0;
}

async function main() {
  if (!clean && hasCache()) {
    console.log('Using cached examples in public/lynx-examples/ (use --clean to re-fetch).');
    return;
  }

  console.log('Fetching @lynx-example packages from npm registry…');
  const packages = await fetchAllExamplePackages();
  if (packages.length === 0) {
    console.log('No @lynx-example packages found on npm, skipping.');
    process.exit(0);
  }
  console.log(`Found ${packages.length} packages.`);

  // Clean and recreate output
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  for (const pkgName of packages) {
    const shortName = pkgName.replace('@lynx-example/', '');
    const destDir = path.join(outputDir, shortName);

    let registryMeta;
    try {
      registryMeta = await fetchPackageMeta(pkgName);
      console.log(`  ${shortName}@${registryMeta.version}`);
      downloadAndExtract(registryMeta.tarball, destDir);
    } catch (err) {
      console.warn(`  ⚠ skipping ${shortName}: ${err.message}`);
      continue;
    }

    // Generate metadata
    const allFiles = getAllFiles(destDir, []);
    const files = allFiles.map((f) => path.relative(destDir, f));
    const previewImageRe = /^preview-image\.(png|jpg|jpeg|webp|gif)$/;
    const filtered = files.filter(
      (f) => !previewImageRe.test(f) && f !== 'example-metadata.json',
    );
    const sorted = sortFiles(filtered);
    const previewImage = files.find((f) => previewImageRe.test(f));
    const templateFiles = getTemplateFiles(filtered);

    const pkgJsonPath = path.join(destDir, 'package.json');
    const pkg = fs.existsSync(pkgJsonPath)
      ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
      : {};

    fs.writeFileSync(
      path.join(destDir, 'example-metadata.json'),
      JSON.stringify(
        {
          name: pkg.repository?.directory || shortName,
          version: registryMeta.version,
          reactLynxVersion: registryMeta.reactLynxVersion,
          files: sorted,
          previewImage,
          templateFiles,
          exampleGitBaseUrl,
        },
        null,
        2,
      ),
    );
  }

  console.log(`\nPrepared ${packages.length} examples in public/lynx-examples/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
