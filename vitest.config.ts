import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic tests (no DOM). Faithful fakes stand in for `<lynx-view>`.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
