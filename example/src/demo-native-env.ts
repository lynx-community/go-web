/**
 * Demo `PreviewNativeEnv` (Level A) for the example app.
 *
 * Shows the three generic hooks go-web forwards to the previewed `<lynx-view>`:
 *   1. `onNativeModulesCall` — receives native-module calls made by the bundle.
 *   2. `nativeModulesMap`    — `module-name -> ESM url` definition consumed by
 *      the worker at init (here an inline `data:` module, purely illustrative;
 *      it stays dormant unless a bundle actually imports that module).
 *   3. `globalProps`         — a `(entryName) => Cloneable` factory injecting a
 *      per-card container id / query params.
 *
 * These are opt-in: examples that don't use native modules are unaffected.
 */
import type { PreviewNativeEnv } from '../../src/index';

/** An inline ESM native module, referenced by `nativeModulesMap` below. */
const DEMO_MODULE_URL =
  'data:text/javascript,' +
  encodeURIComponent(
    `export default function (NativeModules, NativeModulesCall) {
       return {
         ping: (msg) => NativeModulesCall('ping', msg, 'DemoModule'),
       };
     }`,
  );

export const demoNativeEnv: PreviewNativeEnv = {
  // 1. Handler — every native-module call the bundle makes lands here.
  onNativeModulesCall: (name, data, moduleName) => {
    console.log('[demo native call]', { moduleName, name, data });
    if (name === 'ping') {
      return { ok: true, echo: data, at: 'go-web-demo' };
    }
    // Returning undefined leaves other modules to their defaults.
    return undefined;
  },

  // 2. Native-modules definition passthrough (module-name -> ESM url).
  nativeModulesMap: {
    DemoModule: DEMO_MODULE_URL,
  },

  // 3. Per-card globalProps factory — inject a container id derived from entry.
  //    `Cloneable` values are flat primitives (web-core structured-clone shape).
  globalProps: (entryName) => ({
    containerId: `go-web-demo:${entryName}`,
    source: 'go-web',
    preview: true,
  }),
};
