import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import type { AudioRefs, PileEvent } from '../types';
import { AudioContext, audioSettings } from '../context/AudioContext';

// Table transitively imports constants/discord, which loads the Discord
// embedded-app SDK at module scope. Mock it so no browser-only SDK setup runs.
vi.mock('../constants/discord', () => ({ discordSdk: undefined, initaliseDiscord: () => false }));

import { Latest } from './Table';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeAudio(): AudioRefs {
  return {
    ring: { play: vi.fn() } as unknown as HTMLAudioElement,
    buzz: { play: vi.fn() } as unknown as HTMLAudioElement,
  };
}

function makeEvent(card: number, round: number, missed = false): PileEvent {
  return { card, round, missed };
}

describe('Latest — audio behaviour', () => {
  it('muted context: a card event MUST NOT call buzz.play() or ring.play()', () => {
    const audio = makeAudio();
    const event = [makeEvent(5, 1, false)];

    render(
      <AudioContext.Provider value={audioSettings.silent}>
        <Latest event={event} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).not.toHaveBeenCalled();
    expect(audio.buzz.play).not.toHaveBeenCalled();
  });

  it('unmuted context: a successful (non-missed) card event MUST call ring.play() exactly once', () => {
    const audio = makeAudio();
    const event = [makeEvent(5, 1, false)];

    render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).toHaveBeenCalledTimes(1);
    expect(audio.buzz.play).not.toHaveBeenCalled();
  });

  it('unmuted context: a missed card event MUST call buzz.play() exactly once', () => {
    const audio = makeAudio();
    const event = [makeEvent(7, 1, true)];

    render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    expect(audio.buzz.play).toHaveBeenCalledTimes(1);
    expect(audio.ring.play).not.toHaveBeenCalled();
  });

  it('re-render with the same event reference MUST NOT call play() again', () => {
    const audio = makeAudio();
    const event = [makeEvent(5, 1, false)];

    const { rerender } = render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    // First render fires once
    expect(audio.ring.play).toHaveBeenCalledTimes(1);

    // Re-render with the same event array reference — React skips the effect entirely
    rerender(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).toHaveBeenCalledTimes(1);
  });

  it('re-render with a NEW array carrying the same card value MUST NOT call play() again (lastCardRef dedup)', () => {
    const audio = makeAudio();

    const { rerender } = render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={[makeEvent(5, 1, false)]} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    // First render fires once
    expect(audio.ring.play).toHaveBeenCalledTimes(1);

    // Re-render with a fresh array but the same card value — the effect runs again but
    // lastCardRef suppresses the second play() call
    rerender(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={[makeEvent(5, 1, false)]} round={1} audio={audio} />
      </AudioContext.Provider>,
    );

    // lastCardRef.current === 5, so the inner guard fires and no second play() is issued
    expect(audio.ring.play).toHaveBeenCalledTimes(1);
  });
});
