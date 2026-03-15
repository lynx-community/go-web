/**
 * Pure Node.js function for build-time SSG pre-rendering.
 *
 * This file deliberately has NO JSX or React imports so that it can
 * be loaded by jiti (rsbuild's config loader) without a JSX parser.
 */
import fs from 'fs';
import path from 'path';
import type { ExampleMetadata } from './example-preview';
import { getFileCodeLanguage } from './example-preview/utils/example-data';

const TEXT: Record<string, string> = {
  zh: '下面是一个示例: ',
  en: 'This is an example below: ',
};

export interface GenerateSSGHTMLOptions {
  /** Absolute disk path to examples directory */
  exampleRoot: string;
  /** Example name (directory under exampleRoot) */
  example: string;
  /** Default file to show, defaults to 'package.json' */
  defaultFile?: string;
  /** Language for intro text */
  lang?: string;
  /** File extension → language alias mapping */
  langAlias?: Record<string, string>;
}

/**
 * Generate a static HTML string for an example's code preview.
 * Designed for use in build tools (e.g. rsbuild.config.ts) to inject
 * SSG previews as build-time constants.
 */
export function generateSSGHTML(options: GenerateSSGHTMLOptions): string {
  const {
    exampleRoot,
    example,
    defaultFile = 'package.json',
    lang = 'en',
    langAlias,
  } = options;

  const metadataPath = path.join(
    exampleRoot,
    example,
    'example-metadata.json',
  );
  let metadata: ExampleMetadata | null = null;
  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    metadata = JSON.parse(content) as ExampleMetadata;
  } catch {
    // metadata not available
  }

  let codeContent = '';
  try {
    codeContent = fs.readFileSync(
      path.join(exampleRoot, example, defaultFile),
      'utf-8',
    );
  } catch {
    // file not available
  }

  const codeLanguage = getFileCodeLanguage(defaultFile, langAlias);

  const parts: string[] = [];

  // Title
  parts.push(
    '<p><strong>' + escapeHtml(TEXT[lang] ?? TEXT.en) + escapeHtml(example) + '</strong></p>',
  );

  // Entry info
  if (metadata?.templateFiles?.[0]) {
    const entry = metadata.templateFiles[0];
    let entryHtml = '<p><strong>Bundle:</strong> <code>' + escapeHtml(entry.file) + '</code>';
    if (entry.webFile) {
      entryHtml += ' | Web: <code>' + escapeHtml(entry.webFile) + '</code>';
    }
    entryHtml += '</p>';
    parts.push(entryHtml);
  }

  // Code block
  if (codeContent) {
    parts.push(
      '<pre><code class="language-' + escapeHtml(codeLanguage) + '">' + escapeHtml(codeContent) + '</code></pre>',
    );
  }

  return parts.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
