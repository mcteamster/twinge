import { describe, expect, it } from 'vitest';
import { decideCardSound } from './App';
import type { PileEvent } from './types';

// A helper to build a pile of N cards; the last card's `missed` flag is
// controllable to exercise the ring/buzz branch.
function pile(length: number, lastMissed = false): PileEvent[] {
  return Array.from({ length }, (_, i) => ({
    card: i + 1,
    round: 1,
    missed: i === length - 1 ? lastMissed : false,
  }));
}

describe('decideCardSound (gamestateHandler audio gating)', () => {
  // 4.2 — live new card plays ring
  it('plays ring for a live delivery that introduces a new, un-missed card', () => {
    expect(
      decideCardSound({ pile: pile(1), lastKnownPileLength: 0, isBackgroundSync: false, muted: false }),
    ).toBe('ring');
  });

  // 4.2 — live missed card plays buzz
  it('plays buzz for a live delivery whose new card is marked missed', () => {
    expect(
      decideCardSound({ pile: pile(2, true), lastKnownPileLength: 1, isBackgroundSync: false, muted: false }),
    ).toBe('buzz');
  });

  // 4.2 — background sync plays nothing (even when the pile grows)
  it('plays nothing for a background sync delivery, even with new cards', () => {
    expect(
      decideCardSound({ pile: pile(3), lastKnownPileLength: 1, isBackgroundSync: true, muted: false }),
    ).toBeNull();
  });

  // 4.2 — rejoin / reload arrive as background deliveries -> nothing.
  // The delivery classification (background) is what silences rejoin and
  // reload; from this helper's view they are indistinguishable background
  // deliveries, so one assertion covers both paths.
  it('plays nothing for a rejoin/reload (background) delivery restoring a full pile', () => {
    expect(
      decideCardSound({ pile: pile(5), lastKnownPileLength: 0, isBackgroundSync: true, muted: false }),
    ).toBeNull();
  });

  // 4.2 — live delivery with no new cards plays nothing
  it('plays nothing for a live delivery that only re-delivers known cards', () => {
    expect(
      decideCardSound({ pile: pile(2), lastKnownPileLength: 2, isBackgroundSync: false, muted: false }),
    ).toBeNull();
    // Shorter/equal pile (stale re-delivery) also stays silent.
    expect(
      decideCardSound({ pile: pile(1), lastKnownPileLength: 2, isBackgroundSync: false, muted: false }),
    ).toBeNull();
  });

  // 4.3 — muted live new card plays nothing
  it('plays nothing on a live new card while muted', () => {
    expect(
      decideCardSound({ pile: pile(1), lastKnownPileLength: 0, isBackgroundSync: false, muted: true }),
    ).toBeNull();
    // Muted also suppresses a missed live card.
    expect(
      decideCardSound({ pile: pile(2, true), lastKnownPileLength: 1, isBackgroundSync: false, muted: true }),
    ).toBeNull();
  });

  it('plays nothing for an empty pile', () => {
    expect(
      decideCardSound({ pile: [], lastKnownPileLength: 0, isBackgroundSync: false, muted: false }),
    ).toBeNull();
  });
});
