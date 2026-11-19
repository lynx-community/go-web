import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const run = async (args, cwd) => {
  const { stdout } = await exec('pnpm', args, {
    cwd,
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout;
};
const installedDependencies = async (cwd) => {
  const [pkg] = JSON.parse(await run(['list', '--depth', '0', '--json'], cwd));
  return { ...pkg.dependencies, ...pkg.devDependencies };
};

export async function checkInstalledConsumer({
  root,
  fixture,
  consumer,
  major,
  config,
}) {
  // Stay outside the repository so package resolution cannot find its
  // development dependencies, including the missing clipboard declarations.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'go-web-consumer-'));
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const rootDependencies = await installedDependencies(root);
    const reactDependencies =
      major === '18' ? rootDependencies : await installedDependencies(fixture);
    const dependencies = Object.fromEntries(
      Object.keys(pkg.peerDependencies).map((name) => [
        name,
        (reactDependencies[name] ?? rootDependencies[name]).version,
      ]),
    );
    for (const name of [
      '@types/node',
      '@types/react',
      '@types/react-dom',
      'typescript',
    ]) {
      dependencies[name] = reactDependencies[name].version;
    }
    await run(['pack', '--out', path.join(dir, 'go-web.tgz')], root);
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'go-web-installed-consumer',
        private: true,
        type: 'module',
        dependencies: { ...dependencies, [pkg.name]: 'file:./go-web.tgz' },
      }),
    );
    await run(['install', '--ignore-scripts'], dir);
    copyFileSync(consumer, path.join(dir, 'consumer.tsx'));
    const require = createRequire(path.join(dir, 'package.json'));
    const ts = require('typescript');
    const parsed = ts.parseJsonConfigFileContent(
      {
        compilerOptions: {
          ...config.compilerOptions,
          types: ['node'],
          typeRoots: ['./node_modules/@types'],
          paths: {
            react: ['./node_modules/@types/react/index.d.ts'],
            'react/*': ['./node_modules/@types/react/*'],
            'react-dom': ['./node_modules/@types/react-dom/index.d.ts'],
            'react-dom/*': ['./node_modules/@types/react-dom/*'],
            '@theme': ['./node_modules/@rspress/core/dist/theme/index.d.ts'],
          },
        },
        include: ['consumer.tsx', 'node_modules/@lynx-js/go-web/src/env.d.ts'],
      },
      ts.sys,
      dir,
    );
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const files = program
      .getSourceFiles()
      .map((file) => realpathSync(file.fileName));
    assert(
      files.every((file) => !file.startsWith(`${realpathSync(root)}/`)),
      'Installed consumers must not resolve repository source or dependencies',
    );
    const reactTypeRoots = ['react', 'react-dom'].map((name) =>
      realpathSync(path.join(dir, 'node_modules/@types', name)),
    );
    for (const file of files) {
      if (/\/node_modules\/@types\/react(?:-dom)?\//.test(file)) {
        assert(
          reactTypeRoots.some((types) => file.startsWith(`${types}/`)),
          `Unexpected installed React declarations: ${file}`,
        );
      }
    }
    for (const subpath of Object.keys(pkg.exports)) {
      const specifier =
        subpath === '.' ? pkg.name : pkg.name + subpath.slice(1);
      const { resolvedModule } = ts.resolveModuleName(
        specifier,
        path.join(dir, 'consumer.tsx'),
        parsed.options,
        ts.sys,
      );
      assert(resolvedModule, `Unresolved installed export: ${specifier}`);
      assert(files.includes(realpathSync(resolvedModule.resolvedFileName)));
    }
    const diagnostics = [
      ...parsed.errors,
      ...ts.getPreEmitDiagnostics(program),
    ];
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => dir,
        getNewLine: () => '\n',
      }),
    );
    console.log(
      `React ${major}: installed tarball and all exports pass type checking without consumer clipboard typings.`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
