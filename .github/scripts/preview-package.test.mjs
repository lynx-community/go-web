import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('./preview-package.mjs', import.meta.url));

function fixture(t, ref) {
  const dir = mkdtempSync(path.join(tmpdir(), 'go-web-preview-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cwd = path.join(dir, 'repo');
  execFileSync('git', ['clone', '--quiet', '--shared', root, cwd]);
  if (ref) {
    execFileSync('git', ['switch', '--quiet', '--detach', ref], { cwd });
  }
  copyFileSync(
    path.join(root, '.changeset/config.json'),
    path.join(cwd, '.changeset/config.json'),
  );
  symlinkSync(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'));
  const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const output = path.join(dir, 'output');
  const status = path.join(dir, 'status.json');
  return {
    change(file, contents) {
      writeFileSync(path.join(cwd, file), contents);
      execFileSync('git', ['add', '--', file], { cwd });
    },
    rename(from, to) {
      execFileSync('git', ['mv', '--', from, to], { cwd });
      return execFileSync('git', ['diff', '--name-status', baseRef], {
        cwd,
        encoding: 'utf8',
      });
    },
    run(ref = baseRef) {
      const result = spawnSync(process.execPath, [script, ref, status], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: output },
      });
      return {
        ...result,
        output: existsSync(output) ? readFileSync(output, 'utf8') : '',
        hasStatus: existsSync(status),
      };
    },
  };
}

test('documentation without a changeset skips the v2 status CLI', (t) => {
  const repo = fixture(t);
  repo.change('README.md', '# Documentation update\n');
  repo.change('.changeset/README.md', '# Changeset documentation\n');
  const result = repo.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'publish=false\n');
  assert.equal(result.hasStatus, false);
});

test('an empty changeset succeeds without publishing', (t) => {
  const repo = fixture(t);
  repo.change('.changeset/preview-empty.md', '---\n---\n\nNo release.\n');
  const result = repo.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'publish=false\n');
  assert.equal(result.hasStatus, true);
});

for (const bump of ['patch', 'minor', 'major']) {
  test(`a ${bump} changeset publishes the root package`, (t) => {
    const repo = fixture(t);
    repo.change(
      '.changeset/preview-release.md',
      `---\n'@lynx-js/go-web': ${bump}\n---\n\nPreview release.\n`,
    );
    const result = repo.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'publish=true\n');
  });
}

test('renaming an existing changeset still publishes the root package', (t) => {
  const repo = fixture(t, '62897fdd72319572994f16c9fdb2191fa643ee9b');
  const diff = repo.rename(
    '.changeset/tidy-pianos-search.md',
    '.changeset/preview-renamed.md',
  );
  assert.match(
    diff,
    /^R100\t\.changeset\/tidy-pianos-search\.md\t\.changeset\/preview-renamed\.md$/m,
  );
  const result = repo.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'publish=true\n');
});

test('a malformed changeset fails instead of silently skipping', (t) => {
  const repo = fixture(t);
  repo.change('.changeset/preview-invalid.md', 'Invalid changeset.\n');
  const result = repo.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.output, '');
});

test('an invalid base ref fails instead of silently skipping', (t) => {
  const result = fixture(t).run('missing-preview-base');
  assert.notEqual(result.status, 0);
  assert.equal(result.output, '');
});
