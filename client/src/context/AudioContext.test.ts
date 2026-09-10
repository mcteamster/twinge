import { describe, expect, it } from 'vitest';
import { createElement, useContext } from 'react';
import { render } from '@testing-library/react';
import { AudioContext, audioSettings } from './AudioContext';
import type { AudioSettings } from '../types';

describe('AudioContext', () => {
  it('exposes loud and silent presets with the expected mute shape', () => {
    expect(audioSettings.loud).toEqual({ mute: false });
    expect(audioSettings.silent).toEqual({ mute: true });
  });

  it('default context value matches the loud (unmuted) preset', () => {
    let captured: AudioSettings | undefined;
    function Probe(): null {
      captured = useContext(AudioContext);
      return null;
    }
    render(createElement(Probe));
    expect(captured).toEqual({ mute: false });
  });
});
