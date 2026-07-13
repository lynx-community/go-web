/**
 * Level A — configurable native environment for the previewed `<lynx-view>`.
 *
 * go-web stays PRODUCT-AGNOSTIC: it does not know any framework's native module
 * names or URL scheme. It only forwards a small, generic set of hooks to the
 * underlying web-core `<lynx-view>` element so an embedder can register a
 * native-modules bridge, inject per-card `globalProps`/`initData`, and handle
 * native-module calls made by the previewed bundle.
 *
 * All hooks are opt-in. When unset, preview behavior is identical to before.
 *
 * The concrete web-core types are DERIVED from `LynxViewElement` so this file
 * stays correct across web-core versions without importing internal type paths.
 */
import type { LynxViewElement } from '@lynx-js/web-core/client';

/** A structured-clone-safe value, as accepted by `<lynx-view>`. */
export type Cloneable = LynxViewElement['globalProps'];

/**
 * Handler invoked when the previewed bundle calls a NativeModule.
 * web-core CACHES calls made before this handler is assigned, so forwarding it
 * via the element `ref` (after connect) is safe.
 */
export type NativeModulesCall = NonNullable<
  LynxViewElement['onNativeModulesCall']
>;

/** Map of `module-name -> ESM url`, consumed by the worker at init time. */
export type NativeModulesMap = NonNullable<LynxViewElement['nativeModulesMap']>;

/** Handler invoked when the previewed bundle calls a NapiModule (advanced). */
export type NapiModulesCall = NonNullable<LynxViewElement['onNapiModulesCall']>;

/** Map of `module-name -> ESM url` for napi modules (advanced). */
export type NapiModulesMap = NonNullable<LynxViewElement['napiModulesMap']>;

/**
 * A `globalProps`/`initData` value: either a static `Cloneable`, or a factory
 * that derives the value from the entry name (e.g. to inject a per-card
 * container id or query params). The factory is called once per card, right
 * before the view starts.
 */
export type CloneableInput = Cloneable | ((entryName: string) => Cloneable);

/**
 * Opt-in native environment forwarded to the previewed `<lynx-view>`.
 *
 * Can be set site-wide via `GoConfig.previewNativeEnv` and/or per-instance via
 * the `nativeEnv` prop on `<Go>` / `<ExamplePreview>`. Per-instance values are
 * shallow-merged over the site-wide config (see {@link mergePreviewNativeEnv}).
 */
export interface PreviewNativeEnv {
  /**
   * Handler for NativeModules calls made by the previewed bundle. Forwarded to
   * `<lynx-view>.onNativeModulesCall`. Late assignment is safe (web-core caches
   * pre-assignment calls).
   */
  onNativeModulesCall?: NativeModulesCall;
  /**
   * Native-modules DEFINITION: `module-name -> ESM url`. Forwarded to
   * `<lynx-view>.nativeModulesMap`. Read by the worker at init, so it is applied
   * before the view starts.
   */
  nativeModulesMap?: NativeModulesMap;
  /** Napi-modules definition: `module-name -> ESM url` (advanced). */
  napiModulesMap?: NapiModulesMap;
  /** Handler for NapiModules calls made by the previewed bundle (advanced). */
  onNapiModulesCall?: NapiModulesCall;
  /**
   * Per-card `globalProps`: a static `Cloneable` or a `(entryName) => Cloneable`
   * factory. Read by web-core when the view starts.
   */
  globalProps?: CloneableInput;
  /**
   * Per-card `initData`: a static `Cloneable` or a `(entryName) => Cloneable`
   * factory. Read by web-core when the view starts.
   */
  initData?: CloneableInput;
}

/**
 * Resolve a {@link CloneableInput} to a concrete `Cloneable` for a given entry.
 * A function input is invoked with `entryName`; anything else is returned as-is.
 */
export function resolveCloneableInput(
  input: CloneableInput | undefined,
  entryName: string,
): Cloneable | undefined {
  if (typeof input === 'function') {
    return input(entryName);
  }
  return input;
}

/**
 * Shallow-merge a per-instance native env over a site-wide one. Per-instance
 * keys win; a key that is present but `undefined` does not override the base.
 * Returns `undefined` when both inputs are absent, so the default (unset) path
 * is preserved.
 */
export function mergePreviewNativeEnv(
  base: PreviewNativeEnv | undefined,
  override: PreviewNativeEnv | undefined,
): PreviewNativeEnv | undefined {
  if (!base) return override;
  if (!override) return base;
  const merged: PreviewNativeEnv = { ...base };
  for (const key of Object.keys(override) as (keyof PreviewNativeEnv)[]) {
    const value = override[key];
    if (value !== undefined) {
      // Each key is independently typed; the assignment is safe per-key.
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * Imperatively apply a resolved native env to a `<lynx-view>` element for a
 * given entry. Idempotent per element+env via the provided `applied` guard set.
 *
 * ORDERING: web-core reads `nativeModulesMap` / `napiModulesMap` / `globalProps`
 * / `initData` asynchronously inside its `#render()` microtask (after awaiting
 * the iframe realm), so assigning them from the element `ref` — as done here and
 * as the existing `browserConfig` init already does — happens before the worker
 * consumes them. `onNativeModulesCall` / `onNapiModulesCall` are additionally
 * safe to assign late because web-core caches pre-assignment calls.
 */
export function applyPreviewNativeEnv(
  el: LynxViewElement,
  env: PreviewNativeEnv | undefined,
  entryName: string,
  applied: WeakSet<LynxViewElement>,
): void {
  if (!env) return;
  if (applied.has(el)) return;
  applied.add(el);

  // Worker-init values first, before any late handler assignment.
  if (env.nativeModulesMap !== undefined) {
    el.nativeModulesMap = env.nativeModulesMap;
  }
  if (env.napiModulesMap !== undefined) {
    el.napiModulesMap = env.napiModulesMap;
  }
  const globalProps = resolveCloneableInput(env.globalProps, entryName);
  if (globalProps !== undefined) {
    el.globalProps = globalProps;
  }
  const initData = resolveCloneableInput(env.initData, entryName);
  if (initData !== undefined) {
    el.initData = initData;
  }
  if (env.onNativeModulesCall !== undefined) {
    el.onNativeModulesCall = env.onNativeModulesCall;
  }
  if (env.onNapiModulesCall !== undefined) {
    el.onNapiModulesCall = env.onNapiModulesCall;
  }
}
