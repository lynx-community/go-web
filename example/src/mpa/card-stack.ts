/**
 * Pure card-stack model for the demo MPA `PreviewRuntime` (Level B, shape B1).
 *
 * A multi-page (MPA) example demonstrates cross-page navigation by STACKING
 * `<lynx-view>` cards: opening a page pushes a card, `back` pops it. Because
 * lower cards are never unmounted (their `<lynx-view>` elements keep a stable
 * React key), each card's runtime heap — and therefore its state — survives
 * navigating forward and back.
 *
 * This model is deliberately framework-agnostic: it knows nothing about any
 * router's method names or URL scheme. The demo runtime maps native calls
 * (e.g. `router.open` / `back`) onto these actions; the mapping lives on the
 * embedder side, not here.
 */

export interface PreviewCard {
  /** Stable id — used as the React key and to keep the card's heap alive. */
  id: string;
  /** Entry whose web bundle this card renders. */
  entryName: string;
  /** Web bundle URL for this card. */
  src: string;
}

export interface CardStackState {
  /** Bottom-to-top: `cards[0]` is the root, the last item is the active card. */
  cards: PreviewCard[];
}

export type CardStackAction =
  | { type: 'reset'; root: PreviewCard }
  | { type: 'push'; card: PreviewCard }
  | { type: 'back' };

/** Initial stack containing just the root card. */
export function createInitialStack(root: PreviewCard): CardStackState {
  return { cards: [root] };
}

/** The active (top-most) card, or `undefined` for an empty stack. */
export function activeCard(state: CardStackState): PreviewCard | undefined {
  return state.cards[state.cards.length - 1];
}

/**
 * Reduce a navigation action.
 *
 * - `reset` — start a fresh stack from a new root (e.g. entry/example change).
 * - `push`  — open a new card on top (forward navigation).
 * - `back`  — pop the top card; a single-card stack is left untouched so the
 *   root is never unmounted and keeps its state.
 */
export function cardStackReducer(
  state: CardStackState,
  action: CardStackAction,
): CardStackState {
  switch (action.type) {
    case 'reset':
      return createInitialStack(action.root);
    case 'push':
      return { cards: [...state.cards, action.card] };
    case 'back':
      if (state.cards.length <= 1) return state;
      return { cards: state.cards.slice(0, -1) };
    default:
      return state;
  }
}
