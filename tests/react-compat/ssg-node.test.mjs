import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bundle = pathToFileURL(process.env.GO_WEB_REACT_BUNDLE);
const { generateSSGHTML, ExamplePreviewSSG } = await import(bundle.href);
const exampleRoot = mkdtempSync(
  path.join(path.dirname(fileURLToPath(bundle)), 'ssg-node-'),
);
const exampleDir = path.join(exampleRoot, 'example');
mkdirSync(exampleDir);
writeFileSync(
  path.join(exampleDir, 'example-metadata.json'),
  JSON.stringify({ version: '1.2.3-beta.1', templateFiles: [] }),
);
writeFileSync(
  path.join(exampleDir, 'package.json'),
  JSON.stringify({ name: 'example', version: '1.2.3-beta.1' }),
);
after(() => rmSync(exampleRoot, { recursive: true }));

test('the public SSG entry generates HTML in Node without DOM or styles', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof ExamplePreviewSSG, 'function');
  const options = { exampleRoot, example: 'example' };
  const html = generateSSGHTML(options);
  assert.match(html, /<p>v1\.2\.3-beta\.1<\/p>/);
  assert.match(html, /class="language-json"/);
  assert.match(
    generateSSGHTML({ ...options, lang: 'zh-CN' }),
    /v1\.2\.3-beta\.1/,
  );
});

test('Node HTML omits invalid versions and escapes metadata version text', () => {
  const options = { exampleRoot, example: 'example' };
  const metadataPath = path.join(exampleDir, 'example-metadata.json');
  for (const version of [undefined, '', '   ', 123]) {
    writeFileSync(metadataPath, JSON.stringify({ version, templateFiles: [] }));
    assert.doesNotMatch(generateSSGHTML(options), /<p>v[^<]*<\/p>/);
  }
  writeFileSync(
    metadataPath,
    JSON.stringify({ version: '1.0.0-<preview>&"quote"', templateFiles: [] }),
  );
  assert.match(
    generateSSGHTML(options),
    /<p>v1\.0\.0-&lt;preview&gt;&amp;&quot;quote&quot;<\/p>/,
  );
});
