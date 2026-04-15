/**
 * Built-in SSG (Static Site Generation) support for go-web.
 *
 * Exports:
 * - `ExamplePreviewSSG` — React component for rspress/SSR contexts
 * - `generateSSGHTML`   — Pure Node.js function (re-exported from ssg-generate.ts)
 *
 * This module imports Node.js `fs`/`path` and must NOT be bundled into
 * browser code. Use the separate `@lynx-js/go-web/ssg` export.
 */
import fs from 'fs';
import path from 'path';
import { useMemo } from 'react';
import { useGoConfig } from './config';
import type { ExampleMetadata, ExamplePreviewProps } from './example-preview';
import { getFileCodeLanguage } from './example-preview/utils/example-data';

export { generateSSGHTML } from './ssg-generate';
export type { GenerateSSGHTMLOptions } from './ssg-generate';

const TEXT: Record<string, string> = {
  zh: '下面是一个示例: ',
  en: 'This is an example below: ',
};

// ---------------------------------------------------------------------------
// React component — for rspress / SSR
// ---------------------------------------------------------------------------

/**
 * SSG-aware React component that reads example files from disk at
 * render time (during SSG/SSR). Requires `ssgExampleRoot` in GoConfig.
 */
export const ExamplePreviewSSG = ({
  example,
  defaultFile = 'package.json',
  defaultEntryFile,
  defaultEntryName,
  highlight,
  entry,
  langAlias,
}: ExamplePreviewProps) => {
  const { useLang, ssgExampleRoot } = useGoConfig();
  const lang = useLang?.() ?? 'en';

  const exampleRoot = ssgExampleRoot!;
  const codeLanguage = getFileCodeLanguage(defaultFile, langAlias);

  const exampleMetadata = useMemo<ExampleMetadata | null>(() => {
    const metadataPath = path.join(
      exampleRoot,
      example,
      'example-metadata.json',
    );
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content) as ExampleMetadata;
  }, [example, exampleRoot]);

  const codeContent = useMemo(() => {
    return fs.readFileSync(
      path.join(exampleRoot, example, defaultFile),
      'utf-8',
    );
  }, [example, defaultFile, exampleRoot]);

  const highlightMeta = useMemo(() => {
    if (typeof highlight === 'string') {
      return highlight;
    }
    if (highlight && typeof highlight === 'object') {
      return highlight[defaultFile] || '';
    }
    return '';
  }, [highlight, defaultFile]);

  const entryFileInfo = useMemo(() => {
    if (!exampleMetadata?.templateFiles) {
      return null;
    }

    let targetEntry;
    if (defaultEntryFile) {
      targetEntry =
        exampleMetadata.templateFiles.find(
          (file) => file.file === defaultEntryFile,
        ) ||
        exampleMetadata.templateFiles.find((file) =>
          file.file.startsWith(defaultEntryFile),
        );
    } else if (defaultEntryName) {
      targetEntry = exampleMetadata.templateFiles.find(
        (file) => file.name === defaultEntryName,
      );
    } else {
      targetEntry = exampleMetadata.templateFiles[0];
    }

    return targetEntry || null;
  }, [exampleMetadata, defaultEntryFile, defaultEntryName]);

  const markdownContent = useMemo(() => {
    const parts: string[] = [];

    parts.push(`**${TEXT[lang] ?? TEXT.en}${example}**\n\n`);

    if (entry) {
      const entryText = Array.isArray(entry) ? entry.join(', ') : entry;
      parts.push(`**Entry:** \`${entryText}\`\n`);
    }

    if (entryFileInfo) {
      parts.push(`**Bundle:** \`${entryFileInfo.file}\``);
      if (entryFileInfo.webFile) {
        parts.push(` | Web: \`${entryFileInfo.webFile}\``);
      }
      parts.push('\n\n');
    }

    if (codeContent) {
      const codeBlock = highlightMeta
        ? `\`\`\`${codeLanguage} ${highlightMeta}\n${codeContent}\n\`\`\``
        : `\`\`\`${codeLanguage}\n${codeContent}\n\`\`\``;
      parts.push(codeBlock);
      parts.push('\n');
    }
    return parts.join('');
  }, [
    lang,
    example,
    entry,
    entryFileInfo,
    codeContent,
    codeLanguage,
    highlightMeta,
  ]);

  return <p>{markdownContent}</p>;
};
