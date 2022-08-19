import React from 'react';

export const audioSettings = {
  loud: {
    mute: false,
  },
  silent: {
    mute: true,
  }
};

export const AudioContext = React.createContext(audioSettings.loud)