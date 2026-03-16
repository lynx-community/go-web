import { defineConfig } from '@rspress/core';
import { pluginSass } from '@rsbuild/plugin-sass';
import path from 'node:path';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'Go Web - Rspress Example',
  source: {
    include: [/[\\/]go-web[\\/]/],
  },
  builderConfig: {
    plugins: [pluginSass()],
    tools: {
      rspack: {
        resolve: {
          // The SSG component imports fs/path for reading example files at
          // build time. These must be stubbed out in the browser bundle.
          fallback: {
            fs: false,
            path: false,
          },
        },
      },
    },
  },
});
