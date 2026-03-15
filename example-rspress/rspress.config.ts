import { defineConfig } from '@rspress/core';
import { pluginSass } from '@rsbuild/plugin-sass';
import path from 'node:path';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'Go Web - Rspress Example',
  ssg: false,
  source: {
    include: [/[\\/]go-web[\\/]/],
  },
  builderConfig: {
    plugins: [pluginSass()],
  },
});
