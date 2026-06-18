import React, { useContext } from 'react';
import { LoadingContext } from '../context/LoadingContext';

function Create({ sendMsg }) {
  return <div className='Create centered' onClick={() => {
    let create = document.querySelector('.Create');
    create.classList.remove('clickedButton');
    create.classList.add('clickedButton');
    setTimeout(() => {
      create.classList.remove('clickedButton');
    }, 1000);
    let deckSize = document.getElementById('deckSize').value;
    let maxLives = document.getElementById('maxLives').value;
    sendMsg({ action: 'play', actionType: 'new', config: { deckSize, maxLives } });
  }}>
    <div>Create</div>
  </div>
}

function Join({ sendMsg }) {
  const loading = useContext(LoadingContext);
  return <input id='inputBox' type='text' pattern='[A-Z]' maxLength="4" placeholder='or Join Game' className='Join centered'
    onKeyUp={(event) => {
      if (document.getElementById('inputBox').value.length === 4 && event.key !== 'Enter') {
        if (!loading) {
          sendMsg({ action: 'play', actionType: 'join', roomCode: document.getElementById('inputBox').value });
          window.scrollTo(0, 0);
        }
      }
    }}
    onSelect={() => {
      document.getElementById('inputBox').placeholder = 'e.g. "TWNG"';
    }}>
  </input>
}

function Rename({ state, sendMsg }) {
  return <input id='inputBox' type='text' maxLength="10" placeholder='Set Name' className='Rename centered'
    onChange={(event) => {
      sendMsg({
        action: 'play',
        actionType: 'rename',
        name: (event.target.value.length > 0 ? event.target.value : 'ANON'),
        gameId: state.gameId,
        playerId: state.playerId,
      });
    }}
    onKeyUp={(event) => {
      if (event.key === 'Enter') window.scrollTo(0, 0);
    }}
  />
}

function Start({ state, sendMsg }) {
  return <div className='Start centered' onClick={() => {
    let start = document.querySelector('.Start');
    start.classList.remove('clickedButton');
    start.classList.add('clickedButton');
    setTimeout(() => {
      start.classList.remove('clickedButton');
    }, 1000);
    sendMsg({ action: 'play', actionType: 'start', gameId: state.gameId, playerId: state.playerId });
  }}>
    <div>Start</div>
  </div>
}

export { Create, Join, Rename, Start }
