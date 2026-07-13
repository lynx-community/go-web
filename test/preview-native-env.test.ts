import { describe, expect, it, vi } from 'vitest';
import type { LynxViewElement } from '@lynx-js/web-core/client';
import {
  applyPreviewNativeEnv,
  mergePreviewNativeEnv,
  resolveCloneableInput,
  type NativeModulesCall,
  type PreviewNativeEnv,
} from '../src/example-preview/preview-native-env';

/**
 * A faithful fake of the web-core `<lynx-view>` contract that matters for
 * Level A:
 *  - `nativeModulesMap` / `globalProps` / `initData` are read when the view
 *    STARTS (we snapshot them in `start()`), so they must be set beforehand.
 *  - native-module calls made BEFORE `onNativeModulesCall` is assigned are
 *    CACHED and flushed once the handler is set (late assignment is safe).
 */
class FakeLynxView {
  nativeModulesMap: Record<string, string> | undefined;
  napiModulesMap: Record<string, string> | undefined;
  onNapiModulesCall: ((...a: unknown[]) => unknown) | undefined;

  #globalProps: unknown = {};
  #initData: unknown = {};
  #handler: NativeModulesCall | undefined;
  #pending: Array<{
    name: string;
    data: unknown;
    moduleName: string;
    resolve: (v: unknown) => void;
  }> = [];

  startSnapshot: {
    globalProps: unknown;
    initData: unknown;
    nativeModulesMap: Record<string, string> | undefined;
  } | null = null;

  get globalProps() {
    return this.#globalProps;
  }
  set globalProps(v: unknown) {
    this.#globalProps = v;
  }
  get initData() {
    return this.#initData;
  }
  set initData(v: unknown) {
    this.#initData = v;
  }

  get onNativeModulesCall() {
    return this.#handler;
  }
  set onNativeModulesCall(handler: NativeModulesCall | undefined) {
    this.#handler = handler;
    // Flush cached calls, mirroring web-core's caching behavior.
    const pending = this.#pending;
    this.#pending = [];
    for (const call of pending) {
      call.resolve(handler?.(call.name, call.data, call.moduleName));
    }
  }

  /** Simulate the previewed bundle invoking a NativeModule method. */
  callNativeModule(name: string, data: unknown, moduleName: string) {
    if (this.#handler) {
      return Promise.resolve(this.#handler(name, data, moduleName));
    }
    return new Promise((resolve) => {
      this.#pending.push({ name, data, moduleName, resolve });
    });
  }

  /** Simulate web-core reading start-time properties when the view boots. */
  start() {
    this.startSnapshot = {
      globalProps: this.#globalProps,
      initData: this.#initData,
      nativeModulesMap: this.nativeModulesMap,
    };
  }
}

function makeView() {
  return new FakeLynxView() as unknown as LynxViewElement & FakeLynxView;
}

describe('resolveCloneableInput', () => {
  it('returns a static value unchanged', () => {
    expect(resolveCloneableInput({ a: 1 }, 'entry')).toEqual({ a: 1 });
  });
  it('invokes a factory with the entry name', () => {
    const factory = (name: string) => ({ containerId: `c:${name}` });
    expect(resolveCloneableInput(factory, 'second')).toEqual({
      containerId: 'c:second',
    });
  });
  it('passes through undefined', () => {
    expect(resolveCloneableInput(undefined, 'x')).toBeUndefined();
  });
});

describe('mergePreviewNativeEnv', () => {
  it('returns undefined when both are unset (default path preserved)', () => {
    expect(mergePreviewNativeEnv(undefined, undefined)).toBeUndefined();
  });
  it('per-instance keys win; present-but-undefined does not clobber base', () => {
    const base: PreviewNativeEnv = {
      nativeModulesMap: { A: 'a.js' },
      globalProps: { from: 'base' },
    };
    const override: PreviewNativeEnv = {
      globalProps: { from: 'override' },
      nativeModulesMap: undefined,
    };
    const merged = mergePreviewNativeEnv(base, override);
    expect(merged?.nativeModulesMap).toEqual({ A: 'a.js' });
    expect(merged?.globalProps).toEqual({ from: 'override' });
  });
});

describe('applyPreviewNativeEnv', () => {
  it('is a no-op when env is undefined (default behavior unchanged)', () => {
    const view = makeView();
    applyPreviewNativeEnv(view, undefined, 'entry', new WeakSet());
    view.start();
    expect(view.startSnapshot?.nativeModulesMap).toBeUndefined();
    expect(view.startSnapshot?.globalProps).toEqual({});
  });

  it('sets worker-init values before the view starts', () => {
    const view = makeView();
    const env: PreviewNativeEnv = {
      nativeModulesMap: { DemoModule: 'demo.js' },
      globalProps: (entryName) => ({ containerId: `go:${entryName}` }),
      initData: { seeded: true },
    };
    applyPreviewNativeEnv(view, env, 'second', new WeakSet());
    // The view boots after ref assignment.
    view.start();
    expect(view.startSnapshot).toEqual({
      nativeModulesMap: { DemoModule: 'demo.js' },
      globalProps: { containerId: 'go:second' },
      initData: { seeded: true },
    });
  });

  it('applies once per element (idempotent via the guard set)', () => {
    const view = makeView();
    const guard = new WeakSet<LynxViewElement>();
    applyPreviewNativeEnv(view, { globalProps: { v: 1 } }, 'e', guard);
    // A second call with different values must not re-apply.
    applyPreviewNativeEnv(view, { globalProps: { v: 2 } }, 'e', guard);
    view.start();
    expect(view.startSnapshot?.globalProps).toEqual({ v: 1 });
  });

  it('delivers native-module calls to the handler, incl. calls cached before assignment', async () => {
    const view = makeView();
    const handler = vi.fn<NativeModulesCall>((name, data) =>
      name === 'ping' ? { ok: true, echo: data } : undefined,
    );

    // A call made BEFORE the env is applied is cached by the fake view.
    const early = view.callNativeModule('ping', 'hello', 'DemoModule');

    applyPreviewNativeEnv(
      view,
      { onNativeModulesCall: handler },
      'entry',
      new WeakSet(),
    );

    // Cached call is flushed and routed to the embedder's handler.
    await expect(early).resolves.toEqual({ ok: true, echo: 'hello' });

    // A later call routes straight through.
    const late = await view.callNativeModule('ping', 'again', 'DemoModule');
    expect(late).toEqual({ ok: true, echo: 'again' });
    expect(handler).toHaveBeenCalledWith('ping', 'hello', 'DemoModule');
    expect(handler).toHaveBeenCalledWith('ping', 'again', 'DemoModule');
  });
});
