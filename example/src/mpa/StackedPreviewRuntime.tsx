/**
 * Demo `PreviewRuntime` (Level B, shape B1) — an in-process card stack.
 *
 * Replaces go-web's built-in single-card web preview with a stack of
 * `<lynx-view>` cards so a multi-page (MPA) example can open a second card and
 * navigate `back`. go-web still owns the tab bar, QR, code browser, and
 * scaling; this component only renders (and routes between) the cards.
 *
 * Why B1 here: no cross-origin/postMessage handshake, type-safe React
 * composition, and lower cards stay mounted (stable React key) so their runtime
 * heap — and state — survives forward/back navigation. An embedder that already
 * has a full-page "web shell" can instead implement B2 by rendering an
 * `<iframe src={runtimeUrl}>` from a `PreviewRuntime` of their own; both plug
 * into the same `GoConfig.PreviewRuntime` hook.
 *
 * This file is a COPYABLE PROTOTYPE. The navigation convention (native `open` /
 * `back`) lives in `./nav-intent`, on the embedder side — go-web knows none of
 * it.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { LynxViewElement } from '@lynx-js/web-core/client';
import {
  applyPreviewNativeEnv,
  type PreviewNativeEnv,
  type PreviewRuntimeProps,
} from '../../../src/index';
import {
  activeCard,
  cardStackReducer,
  createInitialStack,
  type PreviewCard,
} from './card-stack';
import { resolveDemoNavIntent } from './nav-intent';

const LYNX_GROUP_ID = 43;

let cardSeq = 0;
function nextCardId(entryName: string): string {
  cardSeq += 1;
  return `${entryName}#${cardSeq}`;
}

/** A single stacked `<lynx-view>` card. */
function Card({
  card,
  visible,
  nativeEnv,
}: {
  card: PreviewCard;
  visible: boolean;
  nativeEnv?: PreviewNativeEnv;
}) {
  const appliedRef = useRef<WeakSet<LynxViewElement>>(new WeakSet());

  const handleRef = useCallback(
    (el: LynxViewElement | null) => {
      if (!el) return;
      // Apply the resolved native env before the view starts (see
      // applyPreviewNativeEnv for the ordering guarantee), tagging each card
      // with its own id via globalProps so stacked containers stay distinct.
      applyPreviewNativeEnv(el, nativeEnv, card.entryName, appliedRef.current);
    },
    [card.entryName, nativeEnv],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        background: 'var(--sb-bg, #fff)',
      }}
    >
      {React.createElement('lynx-view' as unknown as 'div', {
        key: card.id,
        ref: handleRef as never,
        url: card.src,
        'lynx-group-id': LYNX_GROUP_ID,
        'transform-vh': true,
        'transform-vw': true,
        style: {
          width: '100%',
          height: '100%',
          containerType: 'size',
          '--rpx-unit': 'calc(100cqw / 750)',
          '--vh-unit': '1cqh',
          '--vw-unit': '1cqw',
        } as React.CSSProperties,
      })}
    </div>
  );
}

export function StackedPreviewRuntime({
  entries,
  activeEntry,
  src,
  show,
  nativeEnv,
}: PreviewRuntimeProps) {
  const rootCard = useMemo<PreviewCard>(
    () => ({
      id: nextCardId(activeEntry || 'root'),
      entryName: activeEntry,
      src,
    }),
    // A new root card whenever the active entry or its url changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEntry, src],
  );

  const [state, dispatch] = useReducer(
    cardStackReducer,
    rootCard,
    createInitialStack,
  );

  // Reset the stack when the root card changes (entry/example switch).
  const rootIdRef = useRef(rootCard.id);
  useEffect(() => {
    if (rootIdRef.current !== rootCard.id) {
      rootIdRef.current = rootCard.id;
      dispatch({ type: 'reset', root: rootCard });
    }
  }, [rootCard]);

  const top = activeCard(state);

  // Wrap the embedder's native env: intercept navigation calls, delegate the
  // rest. globalProps is augmented per card with its stack id.
  const runtimeEnv = useMemo<PreviewNativeEnv>(() => {
    const baseGlobalProps = nativeEnv?.globalProps;
    return {
      ...nativeEnv,
      globalProps: (entryName: string) => {
        const resolved =
          typeof baseGlobalProps === 'function'
            ? baseGlobalProps(entryName)
            : baseGlobalProps;
        return { ...(resolved as object), __previewEntry: entryName };
      },
      onNativeModulesCall: (
        name: string,
        data: unknown,
        moduleName: string,
      ) => {
        const intent = resolveDemoNavIntent(name, data, entries);
        if (intent) {
          if (intent.type === 'back') {
            dispatch({ type: 'back' });
          } else {
            dispatch({
              type: 'push',
              card: {
                id: nextCardId(intent.entry.name),
                entryName: intent.entry.name,
                src: intent.entry.webUrl,
              },
            });
          }
          return undefined;
        }
        return nativeEnv?.onNativeModulesCall?.(name, data, moduleName);
      },
    };
  }, [entries, nativeEnv]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Every card in the stack stays mounted so lower cards keep their state;
          only the top card is visible. */}
      {state.cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          visible={show && card.id === top?.id}
          nativeEnv={runtimeEnv}
        />
      ))}
      {state.cards.length > 1 && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'back' })}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            padding: '4px 10px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--sb-border, #ccc)',
            background: 'var(--sb-surface, rgba(255,255,255,0.85))',
            cursor: 'pointer',
          }}
          aria-label="Back"
        >
          ‹ Back
        </button>
      )}
    </div>
  );
}
