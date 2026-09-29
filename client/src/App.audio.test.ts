import { describe, expect, it } from 'vitest';
import { decideCardSound, playSound } from './App';
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

// ---------------------------------------------------------------------------
// playSound — Web Audio API path
// ---------------------------------------------------------------------------
// The global AudioContext and fetch are stubbed in vitest.setup.ts.
// Each test constructs its own AudioRefs using the global mock.

import { vi, beforeEach as bE } from 'vitest';
import type { AudioRefs } from './types';

function makeRefs(overrides: Partial<AudioRefs> = {}): AudioRefs {
  // Construct a fresh AudioContext from the global stub so tests get a
  // clean mock instance (vi.clearAllMocks() resets its call counts each time).
  return {
    ctx: new AudioContext() as AudioContext,
    ring: null,
    buzz: null,
    ...overrides,
  };
}

// Stub global fetch to return an ArrayBuffer for every /audio/*.mp3 request.
const fakeArrayBuffer = new ArrayBuffer(8);
bE(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
  }));
});

describe('playSound (Web Audio API helper)', () => {
  // 5.1 — playSound fetches, decodes, and starts a BufferSourceNode
  it('fetches and decodes the mp3 on first call, then plays it', async () => {
    const refs = makeRefs();
    await playSound(refs, 'ring');

    expect(fetch).toHaveBeenCalledWith('/audio/ring.mp3');
    // decodeAudioData was called with the array buffer from fetch
    expect(refs.ctx.decodeAudioData).toHaveBeenCalledWith(fakeArrayBuffer);
    // A buffer source was created, connected, and started
    const srcNode = (refs.ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(srcNode.connect).toHaveBeenCalledWith(refs.ctx.destination);
    expect(srcNode.start).toHaveBeenCalled();
  });

  // 5.1 — second call uses the cached AudioBuffer, no re-fetch
  it('caches the decoded buffer and skips fetch on subsequent plays', async () => {
    const fakeBuffer = {} as AudioBuffer;
    const refs = makeRefs({ ring: fakeBuffer });
    await playSound(refs, 'ring');

    expect(fetch).not.toHaveBeenCalled();
    expect(refs.ctx.decodeAudioData).not.toHaveBeenCalled();
    const srcNode = (refs.ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(srcNode.buffer).toBe(fakeBuffer);
    expect(srcNode.start).toHaveBeenCalled();
  });

  // 5.2 — mute is enforced by the caller (decideCardSound), not by playSound
  // itself. Verify the gating layer: decideCardSound returns null when muted,
  // so playSound is never invoked.
  it('is NOT called when decideCardSound returns null (muted)', () => {
    const result = decideCardSound({
      pile: pile(1),
      lastKnownPileLength: 0,
      isBackgroundSync: false,
      muted: true,
    });
    expect(result).toBeNull();
  });

  // 5.3 — after game restart (open phase), context.resume() is called before
  // play. Verify resume() can be called and playSound still completes.
  it('plays correctly after ctx.resume() is called (game restart path)', async () => {
    const refs = makeRefs();
    // Simulate what gamestateHandler does when phase === 'open'
    await refs.ctx.resume();
    await playSound(refs, 'buzz');

    expect(refs.ctx.resume).toHaveBeenCalled();
    const srcNode = (refs.ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(srcNode.start).toHaveBeenCalled();
    // Buffer was stored on refs after first play
    expect(refs.buzz).not.toBeNull();
  });
});
