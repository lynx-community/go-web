import { describe, expect, it } from 'vitest';
import {
  activeCard,
  cardStackReducer,
  createInitialStack,
  type PreviewCard,
} from '../example/src/mpa/card-stack';
import { resolveDemoNavIntent } from '../example/src/mpa/nav-intent';
import type { PreviewRuntimeEntry } from '../src/example-preview/preview-runtime';

const root: PreviewCard = { id: 'root#1', entryName: 'home', src: 'home.web' };
const second: PreviewCard = {
  id: 'second#2',
  entryName: 'details',
  src: 'details.web',
};

const entries: PreviewRuntimeEntry[] = [
  { name: 'home', file: 'home.web.bundle', webUrl: 'home.web' },
  { name: 'details', file: 'details.web.bundle', webUrl: 'details.web' },
];

describe('cardStackReducer', () => {
  it('starts with a single root card', () => {
    const s = createInitialStack(root);
    expect(s.cards).toHaveLength(1);
    expect(activeCard(s)).toBe(root);
  });

  it('push opens a card on top; back pops it', () => {
    let s = createInitialStack(root);
    s = cardStackReducer(s, { type: 'push', card: second });
    expect(s.cards).toHaveLength(2);
    expect(activeCard(s)).toBe(second);

    s = cardStackReducer(s, { type: 'back' });
    expect(s.cards).toHaveLength(1);
    expect(activeCard(s)).toBe(root);
  });

  it('back on the root is a no-op — the root is never unmounted', () => {
    const s = createInitialStack(root);
    const after = cardStackReducer(s, { type: 'back' });
    expect(after.cards).toHaveLength(1);
    expect(activeCard(after)).toBe(root);
  });

  it('opening a second card and going back keeps the first card intact', () => {
    // Acceptance (Level B): "a multi-page example opens a second card and back
    // returns to the first with its state intact."
    let s = createInitialStack(root);
    s = cardStackReducer(s, { type: 'push', card: second });
    s = cardStackReducer(s, { type: 'back' });
    // Identity preserved => the root <lynx-view> keeps its React key and heap,
    // so its runtime state survives the round-trip.
    expect(activeCard(s)).toBe(root);
    expect(s.cards[0]).toBe(root);
  });

  it('reset replaces the stack with a fresh root', () => {
    let s = createInitialStack(root);
    s = cardStackReducer(s, { type: 'push', card: second });
    s = cardStackReducer(s, { type: 'reset', root: second });
    expect(s.cards).toEqual([second]);
  });
});

describe('resolveDemoNavIntent (embedder navigation convention)', () => {
  it('maps an "open" call with an entry name to a push intent', () => {
    const intent = resolveDemoNavIntent('open', { entry: 'details' }, entries);
    expect(intent).toEqual({ type: 'push', entry: entries[1] });
  });

  it('maps an "open" call with a url to a push intent', () => {
    const intent = resolveDemoNavIntent(
      'open',
      { url: 'details.web' },
      entries,
    );
    expect(intent).toEqual({ type: 'push', entry: entries[1] });
  });

  it('maps a "back" call to a back intent', () => {
    expect(resolveDemoNavIntent('back', undefined, entries)).toEqual({
      type: 'back',
    });
  });

  it('returns null for non-navigation calls (delegated to the embedder)', () => {
    expect(resolveDemoNavIntent('ping', { msg: 'hi' }, entries)).toBeNull();
  });

  it('end-to-end: an open intent drives a push that a back reverses', () => {
    let s = createInitialStack(root);
    const open = resolveDemoNavIntent('open', { entry: 'details' }, entries);
    expect(open?.type).toBe('push');
    if (open?.type === 'push') {
      s = cardStackReducer(s, {
        type: 'push',
        card: {
          id: 'details#9',
          entryName: open.entry.name,
          src: open.entry.webUrl,
        },
      });
    }
    expect(activeCard(s)?.entryName).toBe('details');

    const back = resolveDemoNavIntent('back', null, entries);
    expect(back).toEqual({ type: 'back' });
    s = cardStackReducer(s, { type: 'back' });
    expect(activeCard(s)).toBe(root);
  });
});
