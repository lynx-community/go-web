/**
 * Prepares vue-lynx examples for the Go playground.
 *
 * Sources:
 *   --local <path>   Local vue-lynx repo (e.g. ~/github/vue-lynx)
 *   --repo  <url>    Git repo URL (default: https://github.com/huxpro/vue-lynx)
 *   --branch <name>  Git branch to clone (default: main)
 *   --prefix <str>   Prefix for example directory names (default: "vue-")
 *   --build          Install deps and build examples before copying
 *   --vue-lynx-version <ver>  vue-lynx npm version to use (default: pre-alpha)
 *
 * Examples are written to public/lynx-examples/<prefix><name>/ alongside
 * existing @lynx-example packages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'public/lynx-examples');

const lynxEntryFileName = '.lynx.bundle';
const webEntryFileName = '.web.bundle';

const ignoreDirs = ['node_modules', '.git', '.turbo', 'standalone'];
const ignoreFiles = ['.DS_Store', 'LICENSE', 'pnpm-lock.yaml'];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    local: '',
    repo: 'https://github.com/huxpro/vue-lynx',
    branch: 'main',
    prefix: 'vue-',
    build: false,
    vueLynxVersion: 'pre-alpha',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--local':
        opts.local = args[++i];
        break;
      case '--repo':
        opts.repo = args[++i];
        break;
      case '--branch':
        opts.branch = args[++i];
        break;
      case '--prefix':
        opts.prefix = args[++i];
        break;
      case '--build':
        opts.build = true;
        break;
      case '--vue-lynx-version':
        opts.vueLynxVersion = args[++i];
        break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (ignoreDirs.includes(entry) || ignoreFiles.includes(entry)) continue;
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      execSync(`cp -Lrfp "${srcPath}" "${destPath}"`);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getTemplateFiles(files) {
  const entries = [];
  for (const file of files) {
    if (file.endsWith(lynxEntryFileName)) {
      const parts = file.split('/');
      const name =
        parts.at(-1).replace(lynxEntryFileName, '') || parts.at(-2);
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

// ---------------------------------------------------------------------------
// Resolve source — clone if using git repo
// ---------------------------------------------------------------------------

function resolveExamplesDir(opts) {
  if (opts.local) {
    const localPath = path.resolve(opts.local);
    const examplesPath = path.join(localPath, 'examples');
    if (fs.existsSync(examplesPath)) return { dir: examplesPath, repoRoot: localPath, cleanup: null };
    // Maybe the path already points to examples/
    if (fs.existsSync(localPath)) return { dir: localPath, repoRoot: path.resolve(localPath, '..'), cleanup: null };
    throw new Error(`Local path not found: ${localPath}`);
  }

  // Clone from git repo
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-lynx-'));
  console.log(`Cloning ${opts.repo} (branch: ${opts.branch}) into ${tmpDir}…`);
  execSync(
    `git clone --depth 1 --branch "${opts.branch}" "${opts.repo}" "${tmpDir}"`,
    { stdio: 'inherit' },
  );

  const examplesPath = path.join(tmpDir, 'examples');
  if (!fs.existsSync(examplesPath)) {
    throw new Error(`No examples/ directory found in cloned repo at ${tmpDir}`);
  }
  return {
    dir: examplesPath,
    repoRoot: tmpDir,
    cleanup: () => {
      console.log('Cleaning up temporary clone…');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// Build examples if --build is set
// ---------------------------------------------------------------------------

function buildExamples(repoRoot, examplesDir, vueLynxVersion) {
  // Remove pnpm workspace config so each example installs independently
  // (otherwise pnpm resolves workspace:* to the local monorepo package)
  const workspaceYaml = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (fs.existsSync(workspaceYaml)) {
    console.log('Removing pnpm-workspace.yaml to install examples independently…');
    fs.unlinkSync(workspaceYaml);
  }

  const examples = fs.readdirSync(examplesDir).filter((name) => {
    if (ignoreDirs.includes(name)) return false;
    const dir = path.join(examplesDir, name);
    return (
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'package.json'))
    );
  });

  for (const example of examples) {
    const exampleDir = path.join(examplesDir, example);
    const pkgPath = path.join(exampleDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts?.build) continue;

    // Replace workspace:* vue-lynx dep with npm version
    let patched = false;
    for (const depField of ['dependencies', 'devDependencies']) {
      if (pkg[depField]?.['vue-lynx']?.startsWith('workspace:')) {
        pkg[depField]['vue-lynx'] = vueLynxVersion;
        patched = true;
      }
    }
    if (patched) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  Patched ${example}: vue-lynx → ${vueLynxVersion}`);
    }

    // Install deps for this example independently
    console.log(`  Installing ${example}…`);
    try {
      execSync('pnpm install --no-frozen-lockfile', {
        cwd: exampleDir,
        stdio: 'inherit',
      });
    } catch (e) {
      console.warn(`  ⚠ Install failed for "${example}", skipping`);
      continue;
    }

    // Build
    console.log(`  Building ${example}…`);
    try {
      execSync('pnpm build', { cwd: exampleDir, stdio: 'inherit' });
    } catch (e) {
      console.warn(`  ⚠ Build failed for "${example}", skipping`);
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs();
const { dir: examplesDir, repoRoot, cleanup } = resolveExamplesDir(opts);

if (opts.build) {
  const root = repoRoot || path.resolve(examplesDir, '..');
  buildExamples(root, examplesDir, opts.vueLynxVersion);
}

console.log(`Reading vue-lynx examples from: ${examplesDir}`);

// Ensure output dir exists (don't wipe — we keep existing @lynx-example data)
fs.mkdirSync(outputDir, { recursive: true });

// Build the git base URL for "View on GitHub" links
const gitBaseUrl = opts.local
  ? `https://github.com/huxpro/vue-lynx/tree/main`
  : `${opts.repo.replace(/\.git$/, '')}/tree/${opts.branch}`;

// Discover example subdirectories
const examples = fs.readdirSync(examplesDir).filter((name) => {
  if (ignoreDirs.includes(name)) return false;
  const dir = path.join(examplesDir, name);
  return (
    fs.statSync(dir).isDirectory() &&
    fs.existsSync(path.join(dir, 'package.json'))
  );
});

if (examples.length === 0) {
  console.log('No vue-lynx examples found.');
  if (cleanup) cleanup();
  process.exit(0);
}

let prepared = 0;
let skipped = 0;

for (const example of examples) {
  const srcDir = path.join(examplesDir, example);
  const distDir = path.join(srcDir, 'dist');

  // Check if example has been built
  if (!fs.existsSync(distDir)) {
    console.warn(`⚠ Skipping "${example}" — no dist/ directory (run \`rspeedy build\` first)`);
    skipped++;
    continue;
  }

  const outputName = `${opts.prefix}${example}`;
  const destDir = path.join(outputDir, outputName);

  // Clean previous output for this example
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  copyDir(srcDir, destDir);

  const allFiles = getAllFiles(srcDir, []);
  const files = allFiles.map((f) => path.relative(srcDir, f));
  const previewImageRe = /^preview-image\.(png|jpg|jpeg|webp|gif)$/;
  const filtered = files.filter(
    (f) => !previewImageRe.test(f) && f !== 'example-metadata.json',
  );
  const sorted = sortFiles(filtered);
  const previewImage = files.find((f) => previewImageRe.test(f));
  const templateFiles = getTemplateFiles(filtered);

  if (templateFiles.length === 0) {
    console.warn(`⚠ Skipping "${example}" — no .lynx.bundle files found in dist/`);
    fs.rmSync(destDir, { recursive: true, force: true });
    skipped++;
    continue;
  }

  fs.writeFileSync(
    path.join(destDir, 'example-metadata.json'),
    JSON.stringify(
      {
        name: `examples/${example}`,
        files: sorted,
        previewImage,
        templateFiles,
        exampleGitBaseUrl: gitBaseUrl,
      },
      null,
      2,
    ),
  );

  console.log(`  ✓ ${outputName} (${templateFiles.length} entries)`);
  prepared++;
}

if (cleanup) cleanup();

console.log(
  `\nDone. Prepared ${prepared} vue-lynx example(s)${skipped ? `, skipped ${skipped}` : ''}.`,
);
