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
  it('a non-missed card event MUST NOT call ring.play() or buzz.play() (audio is owned by App.tsx)', () => {
    const audio = makeAudio();
    const event = [makeEvent(5, 1, false)];

    render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).not.toHaveBeenCalled();
    expect(audio.buzz.play).not.toHaveBeenCalled();
  });

  it('a missed card event MUST NOT call buzz.play() or ring.play() (audio is owned by App.tsx)', () => {
    const audio = makeAudio();
    const event = [makeEvent(7, 1, true)];

    render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={event} round={1} />
      </AudioContext.Provider>,
    );

    expect(audio.buzz.play).not.toHaveBeenCalled();
    expect(audio.ring.play).not.toHaveBeenCalled();
  });

  it('muted context: a card event MUST NOT call any play method', () => {
    const audio = makeAudio();
    const event = [makeEvent(5, 1, false)];

    render(
      <AudioContext.Provider value={audioSettings.silent}>
        <Latest event={event} round={1} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).not.toHaveBeenCalled();
    expect(audio.buzz.play).not.toHaveBeenCalled();
  });

  it('re-render with a NEW array carrying a new card value MUST still be silent', () => {
    const audio = makeAudio();

    const { rerender } = render(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={[makeEvent(5, 1, false)]} round={1} />
      </AudioContext.Provider>,
    );

    rerender(
      <AudioContext.Provider value={audioSettings.loud}>
        <Latest event={[makeEvent(6, 1, false)]} round={1} />
      </AudioContext.Provider>,
    );

    expect(audio.ring.play).not.toHaveBeenCalled();
    expect(audio.buzz.play).not.toHaveBeenCalled();
  });
});
