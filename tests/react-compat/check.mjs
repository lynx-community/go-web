import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';

const fixture = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const consumer = path.join(root, 'tests/react-consumer.tsx');
const rootRequire = createRequire(path.join(root, 'package.json'));
const fixtureRequire = createRequire(import.meta.url);
const majors = process.argv.slice(2);
if (majors.length === 0) majors.push('18', '19');
assert(
  majors.every((major) => ['18', '19'].includes(major)),
  'Use 18 or 19',
);

const packageRoot = (require, name) =>
  path.dirname(require.resolve(`${name}/package.json`));
const packageJson = (dir) =>
  JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
const formatHost = {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
};

for (const major of majors) {
  const require = major === '18' ? rootRequire : fixtureRequire;
  const reactTypes = packageRoot(require, '@types/react');
  const domTypes = packageRoot(require, '@types/react-dom');
  const react = packageRoot(require, 'react');
  const reactDom = packageRoot(require, 'react-dom');
  for (const dir of [reactTypes, domTypes, react, reactDom]) {
    assert.equal(packageJson(dir).version.split('.')[0], major, dir);
  }

  const output = path.join(root, 'dist/react-compat', major);
  mkdirSync(output, { recursive: true });
  const { config, error } = ts.readConfigFile(
    path.join(root, 'tsconfig.json'),
    ts.sys.readFile,
  );
  assert.ifError(error);
  const parsed = ts.parseJsonConfigFileContent(
    {
      ...config,
      compilerOptions: {
        ...config.compilerOptions,
        types: ['node'],
        typeRoots: [
          path.join(major === '18' ? root : fixture, 'node_modules/@types'),
        ],
        paths: {
          react: [path.join(reactTypes, 'index.d.ts')],
          'react/*': [path.join(reactTypes, '*')],
          'react-dom': [path.join(domTypes, 'index.d.ts')],
          'react-dom/*': [path.join(domTypes, '*')],
          '@rspress/core': [
            path.join(fixture, 'node_modules/@rspress/core/dist/index.d.ts'),
          ],
          '@rspress/core/*': [
            path.join(fixture, 'node_modules/@rspress/core/dist/*'),
          ],
          '@theme': [
            path.join(
              packageRoot(fixtureRequire, '@rspress/core'),
              'dist/theme/index.d.ts',
            ),
          ],
        },
      },
      include: [
        'src',
        'tests/react-consumer.tsx',
        'tests/react-compat/runtime.tsx',
        'tests/react-compat/preview.tsx',
      ],
      exclude: [],
    },
    ts.sys,
    root,
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const files = program
    .getSourceFiles()
    .map((file) => realpathSync(file.fileName));
  for (const dir of [reactTypes, domTypes]) {
    assert(
      files.some((file) => file.startsWith(`${dir}/`)),
      `Missing ${dir}`,
    );
  }
  for (const file of files) {
    if (/\/node_modules\/@types\/react(?:-dom)?\//.test(file)) {
      assert(
        file.startsWith(`${reactTypes}/`) || file.startsWith(`${domTypes}/`),
        `Unexpected React declarations: ${file}`,
      );
    }
  }
  const pkg = packageJson(root);
  for (const subpath of Object.keys(pkg.exports)) {
    const specifier = subpath === '.' ? pkg.name : pkg.name + subpath.slice(1);
    const { resolvedModule } = ts.resolveModuleName(
      specifier,
      consumer,
      parsed.options,
      ts.sys,
    );
    assert(resolvedModule, `Unresolved export: ${specifier}`);
    assert(files.includes(realpathSync(resolvedModule.resolvedFileName)));
  }
  writeFileSync(
    path.join(output, 'type-resolution.json'),
    JSON.stringify(
      {
        react: packageJson(react).version,
        reactDOM: packageJson(reactDom).version,
        reactTypes: packageJson(reactTypes).version,
        reactDOMTypes: packageJson(domTypes).version,
        files: files.filter((file) => file.includes('/@types/react')),
      },
      null,
      2,
    ) + '\n',
  );
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) {
    console.error(`React ${major} type check failed:`);
    console.error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
    );
    process.exitCode = 1;
    continue;
  }
  console.log(
    `React ${major}: source and all package exports pass type checking.`,
  );

  for (const suite of ['runtime', 'preview']) {
    const bundle = path.join(output, `${suite}.mjs`);
    await build({
      entryPoints: [path.join(fixture, `${suite}.tsx`)],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'esm',
      external: ['@lynx-js/web-core/*'],
      define: { 'import.meta.env.SSG_MD': 'false' },
      banner: {
        js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
      },
      plugins: [
        {
          name: 'react-runtime',
          setup(builder) {
            builder.onResolve(
              { filter: /^react(?:-dom)?(?:\/.*)?$/ },
              ({ path: specifier }) => ({
                path: require.resolve(specifier),
                external: true,
              }),
            );
          },
        },
      ],
      loader: { '.scss': 'empty' },
      logLevel: 'warning',
    });
    const result = spawnSync(
      process.execPath,
      ['--test', path.join(fixture, `${suite}.test.mjs`)],
      {
        cwd: root,
        stdio: 'inherit',
        timeout: 30_000,
        env: {
          ...process.env,
          GO_WEB_REACT_MAJOR: major,
          GO_WEB_REACT_BUNDLE: bundle,
        },
      },
    );
    assert.ifError(result.error);
    if (result.status !== 0) process.exitCode = 1;
  }
}
