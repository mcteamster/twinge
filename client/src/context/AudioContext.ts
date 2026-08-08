import React from 'react';
import type { AudioSettings } from '../types';

export const audioSettings: { loud: AudioSettings; silent: AudioSettings } = {
  loud: {
    mute: false,
  },
  silent: {
    mute: true,
  }
};

export const AudioContext = React.createContext<AudioSettings>(audioSettings.loud);
