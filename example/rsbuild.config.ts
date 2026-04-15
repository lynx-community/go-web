import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import path from 'node:path';
import fs from 'node:fs';

// Discover examples from public/lynx-examples/ (populated by `pnpm prepare`
// which processes @lynx-example/* npm packages).
const examplesDir = path.resolve(__dirname, 'public/lynx-examples');
const exampleNames = fs.existsSync(examplesDir)
  ? fs
      .readdirSync(examplesDir)
      .filter((name) => fs.statSync(path.join(examplesDir, name)).isDirectory())
      .sort()
  : ['hello-world'];

// Read example files at build time to produce the same raw markdown that
// ExamplePreviewSSG renders during rspress SSG. This lets the example app
// show the real SSG output as a visual reference.
function readSSGMarkdown(
  exampleName: string,
  defaultFile = 'src/App.tsx',
): string | null {
  try {
    const code = fs.readFileSync(
      path.join(examplesDir, exampleName, defaultFile),
      'utf-8',
    );
    const ext = defaultFile.split('.').pop() || 'txt';
    const lang = ext === 'mjs' ? 'js' : ext;
    return [
      `**This is an example below: ${exampleName}**\n`,
      '```' + lang + '\n' + code + '\n```',
      '',
    ].join('\n');
  } catch {
    return null;
  }
}

const ssgPreviews: Record<string, string> = {};
for (const name of exampleNames) {
  const defaultFile = name.startsWith('vue-') ? 'src/App.vue' : 'src/App.tsx';
  const md = readSSGMarkdown(name, defaultFile);
  if (md) ssgPreviews[name] = md;
}

export default defineConfig({
  plugins: [pluginReact(), pluginSass()],

  server: {
    port: 5969,
    proxy: {
      // Proxy requests to production examples when local examples are not available.
      // This avoids CORS issues when testing the embed with go.lynxjs.org data.
      '/proxy-lynx-examples': {
        target: 'https://go.lynxjs.org',
        pathRewrite: { '^/proxy-lynx-examples': '/lynx-examples' },
        changeOrigin: true,
      },
    },
  },

  html: {
    template: ({ entryName }) =>
      entryName === 'embed' ? './embed.html' : './index.html',
  },

  source: {
    entry: {
      index: './src/main.tsx',
      embed: './src/embed-entry.tsx',
    },
    define: {
      // Inject the example list as a build-time constant
      'import.meta.env.EXAMPLES': JSON.stringify(exampleNames),
      // Inject SSG previews as a build-time constant
      'import.meta.env.SSG_PREVIEWS': JSON.stringify(ssgPreviews),
    },
  },

  resolve: {
    alias: {
      // --- Deduplicate React (go-web source uses relative imports) ---
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),

      // --- Semi UI CSS: bypass exports map restriction ---
      '@douyinfe/semi-ui/dist/css/semi.min.css': path.resolve(
        __dirname,
        'node_modules/@douyinfe/semi-ui/dist/css/semi.min.css',
      ),
    },
  },

  tools: {
    sass: {
      sassOptions: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
});
