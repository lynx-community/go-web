# Preinstalled Scripts

This directory contains scripts that are preloaded into the Lynx Web preview environment.

## vant-touch.js

**Source**: Imported from `lynx-stack/packages/web-platform/web-explorer/preinstalled/vant-touch.js`

**Purpose**: Touch event emulator for desktop browsers. Provides touch event polyfills that convert mouse events to touch events, enabling Lynx web components to work properly on non-touch devices during development.

**Why it's needed**: Lynx Web components rely on touch events for gesture handling. Desktop browsers don't natively support touch events, so this emulator converts mouse events (mousedown, mousemove, mouseup) into their touch equivalents (touchstart, touchmove, touchend).

**Usage**: Automatically imported in `src/example-preview/components/web-iframe.tsx` when the WebIframe component loads.

**License**: MIT License (from @vant/touch-emulator)
