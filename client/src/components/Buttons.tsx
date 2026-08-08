import React, { useContext } from 'react';
import { LoadingContext } from '../context/LoadingContext';
import type { AppState } from '../types';

type SendMsg = (msg: Record<string, unknown>) => void;

interface CreateProps {
  sendMsg: SendMsg;
}

interface JoinProps {
  sendMsg: SendMsg;
}

interface RenameProps {
  state: AppState;
  sendMsg: SendMsg;
}

interface StartProps {
  state: AppState;
  sendMsg: SendMsg;
}

function Create({ sendMsg }: CreateProps): React.ReactElement {
  return <div className='Create centered' onClick={() => {
    const create = document.querySelector('.Create');
    if (!create) return;
    create.classList.remove('clickedButton');
    create.classList.add('clickedButton');
    setTimeout(() => {
      const create = document.querySelector('.Create');
      if (create) create.classList.remove('clickedButton');
    }, 1000);
    const deckSize = (document.getElementById('deckSize') as HTMLInputElement).value;
    const maxLives = (document.getElementById('maxLives') as HTMLInputElement).value;
    sendMsg({ action: 'play', actionType: 'new', config: { deckSize, maxLives } });
  }}>
    <div>Create</div>
  </div>
}

function Join({ sendMsg }: JoinProps): React.ReactElement {
  const loading = useContext(LoadingContext);
  return <input id='inputBox' type='text' pattern='[A-Z]' maxLength={4} placeholder='or Join Game' className='Join centered'
    onKeyUp={(event: React.KeyboardEvent<HTMLInputElement>) => {
      const inputBox = document.getElementById('inputBox') as HTMLInputElement | null;
      if (inputBox && inputBox.value.length === 4 && event.key !== 'Enter') {
        if (!loading) {
          sendMsg({ action: 'play', actionType: 'join', roomCode: inputBox.value });
          window.scrollTo(0, 0);
        }
      }
    }}
    onSelect={() => {
      const inputBox = document.getElementById('inputBox') as HTMLInputElement | null;
      if (inputBox) inputBox.placeholder = 'e.g. "TWNG"';
    }}>
  </input>
}

function Rename({ state, sendMsg }: RenameProps): React.ReactElement {
  return <input id='inputBox' type='text' maxLength={10} placeholder='Set Name' className='Rename centered'
    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
      sendMsg({
        action: 'play',
        actionType: 'rename',
        name: (event.target.value.length > 0 ? event.target.value : 'ANON'),
        gameId: state.gameId,
        playerId: state.playerId,
      });
    }}
    onKeyUp={(event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') window.scrollTo(0, 0);
    }}
  />
}

function Start({ state, sendMsg }: StartProps): React.ReactElement {
  return <div className='Start centered' onClick={() => {
    const start = document.querySelector('.Start');
    if (!start) return;
    start.classList.remove('clickedButton');
    start.classList.add('clickedButton');
    setTimeout(() => {
      const start = document.querySelector('.Start');
      if (start) start.classList.remove('clickedButton');
    }, 1000);
    sendMsg({ action: 'play', actionType: 'start', gameId: state.gameId, playerId: state.playerId });
  }}>
    <div>Start</div>
  </div>
}

export { Create, Join, Rename, Start }
