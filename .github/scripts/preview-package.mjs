import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const [baseRef, statusFile] = process.argv.slice(2);
if (!baseRef || !statusFile || !process.env.GITHUB_OUTPUT) {
  throw new Error('Expected base ref, status file, and GITHUB_OUTPUT');
}

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=AMR', baseRef, '--', '.changeset'],
  { encoding: 'utf8' },
).split('\n');
const hasChangeset = changedFiles.some(
  (file) =>
    /^\.changeset\/[^./][^/]*\.md$/.test(file) &&
    !/^\.changeset\/README\.md$/i.test(file),
);

let publish = false;
// Changesets 2 exits before writing status for changed packages without
// changesets. Skip those PRs before invoking the CLI, not on CLI failure.
if (hasChangeset) {
  execFileSync(
    'pnpm',
    ['changeset', 'status', '--since', baseRef, '--output', statusFile],
    { stdio: 'inherit' },
  );
  const { releases } = JSON.parse(readFileSync(statusFile, 'utf8'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  publish =
    !pkg.private &&
    releases.some(
      (release) =>
        release.name === pkg.name &&
        ['patch', 'minor', 'major'].includes(release.type),
    );
}

appendFileSync(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
console.log(
  publish
    ? 'Publishing the root package to pkg.pr.new.'
    : 'No publishable package bump in PR changesets; skipping preview.',
);
