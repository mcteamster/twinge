import React, { useContext, useEffect, useRef, useState } from 'react';
import { AudioContext } from '../context/AudioContext';
import { LoadingContext } from '../context/LoadingContext';
import { discordSdk } from '../constants/discord';

function Players({ players, state, sendMsg, context }) {
  let playerElements = players.map((player, i) => {
    if (context === 'lobby') {
      if (i === 0 && !player.name.startsWith("⭐️")) {
        player.name = `⭐️ ${player.name}`
      }
      return <Player key={`p${i + 1}`} state={state} sendMsg={sendMsg} context='lobby' number={i + 1} name={player.name} strikes={player.strikes} connected={player.connected} style={player.playerId && { border: '0.25em solid skyblue' }}></Player>
    } else {
      return <Player key={`p${i + 1}`} state={state} sendMsg={sendMsg} number={i + 1} name={player.name} handSize={player.handSize} strikes={player.strikes} connected={player.connected} pin={player.playerId === state.playerId}></Player>
    }
  });
  let featuredPlayers = playerElements.sort((a, b) => {
    if (a.props.pin) {
      return -1
    } else if (b.props.pin) {
      return 1
    } else {
      return b.props?.handSize - a.props.handSize
    }
  })
  return <div className={`Players`} >
    <div className={`${context === 'lobby' ? 'playerLobby' : 'playerTable'}`}>
      {featuredPlayers}
    </div>
  </div>
}

const Player = React.memo(function Player(props) {
  const id = `p${props.number}`;
  const [kickBuffer, setKickBuffer] = useState(0);
  const intervalRef = useRef(null);
  const handSizeRef = useRef(props.handSize);
  const stateHashRef = useRef(props.state.stateHash);
  const kickBufferRef = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (props.handSize !== handSizeRef.current && kickBuffer === 0) {
      highlight();
    }
    handSizeRef.current = props.handSize;
  }, [props.handSize]);

  useEffect(() => { kickBufferRef.current = kickBuffer; }, [kickBuffer]);

  function highlight() {
    try {
      if (props?.context !== 'lobby') {
        document.getElementById(id).classList.add('playerHighlight');
        setTimeout(() => {
          document.getElementById(id).classList.remove('playerHighlight');
        }, 500)
      }
    } catch (err) {
      console.error(err);
    }
  }

  function startBuffer(buffer) {
    cancelBuffer();
    intervalRef.current = setInterval(() => {
      if (stateHashRef.current !== propsRef.current.state.stateHash) {
        cancelBuffer();
      } else if (buffer === 'kickBuffer') {
        setKickBuffer(prev => prev < 100 ? prev + 1 : prev);
      }
    }, 20)
  }

  function triggerBuffer(buffer) {
    if (kickBufferRef.current >= 100) {
      props.sendMsg({
        action: 'play',
        gameId: props.state.gameId,
        playerId: props.state.playerId,
        actionType: 'kick',
        target: (props.number - 1),
        stateHash: props.state.stateHash,
      });
    }
    cancelBuffer();
  }

  function cancelBuffer() {
    stateHashRef.current = props.state.stateHash;
    clearInterval(intervalRef.current);
    setKickBuffer(0);
  }

  if (props.context === 'lobby') {
    return <div key={id} id={id} className={`Player ${props.strikes > 0 && 'strikes'}`}
      style={{ ...props.style, background: `radial-gradient(circle, rebeccapurple, rebeccapurple ${1 * kickBuffer}%, white ${1 * kickBuffer}%, white)` }}
      onMouseDown={() => { startBuffer('kickBuffer') }}
      onMouseUp={() => { triggerBuffer('kickBuffer') }}
      onMouseLeave={() => { cancelBuffer() }}
      onTouchStart={() => { startBuffer('kickBuffer') }}
      onTouchEnd={() => { triggerBuffer('kickBuffer') }}
    >
      <div className={`playerValue ${(props.connected === false) && 'disconnected'}`} >{`${props.name} ${props.strikes < 0 ? '👀' : ''}`}</div>
    </div>
  } else {
    return <div key={id} id={id} className={`Player ${props.hidden && 'hidden'} ${props.strikes > 0 && 'strikes'} ${props.handSize === 0 && 'stale'}`}
      style={{ background: `radial-gradient(circle, rebeccapurple, rebeccapurple ${1 * kickBuffer}%, white ${1 * kickBuffer}%, white)` }}
      onMouseDown={() => { startBuffer('kickBuffer') }}
      onMouseUp={() => { triggerBuffer('kickBuffer') }}
      onMouseLeave={() => { cancelBuffer() }}
      onTouchStart={() => { startBuffer('kickBuffer') }}
      onTouchEnd={() => { triggerBuffer('kickBuffer') }}
    >
      <div className={`playerValue ${(props.connected === false) && 'disconnected'}`} style={{ background: `${props.pin && "skyblue"}` }} >
        <div className='playerName'>{props.name}</div>
        {`${props.strikes === -1 ? `👀 ${props.handSize || ''}` : `✋ ${props.handSize}`}`}
      </div>
    </div>
  }
});

function Status({ state }) {
  function calculateMaxRounds(currentRound, numPlayers, remainingCards) {
    if (numPlayers > 0) {
      let remainingRounds = 0;
      while (remainingCards > 0) {
        remainingRounds += 1;
        remainingCards = remainingCards - numPlayers * (currentRound + remainingRounds);
      }
      return remainingRounds + currentRound
    } else {
      return false
    }
  }

  let round = Number(state?.gamestate?.meta?.round);
  let numPlayers = Number(state?.gamestate?.players.length - state?.gamestate?.players.reduce((spectators, p) => { return p.strikes === -1 ? spectators + 1 : spectators }, 0));
  let remainingCards = Number(state?.gamestate?.public?.remaining);

  let lives = '';
  let currentLives = state?.gamestate?.public?.lives;
  let maxLives = state?.gamestate?.config?.maxLives;
  if (maxLives <= 10) {
    lives += '❤️'.repeat(currentLives);
    lives += '🤍'.repeat((maxLives - currentLives) > 0 ? (maxLives - currentLives) : 0);
  } else {
    lives = `${currentLives} ❤️`
  }

  let deck = `${(100*(state?.gamestate?.config?.deckSize - remainingCards)/state?.gamestate?.config?.deckSize).toFixed(1)}%`;
  return <div className='Status' style={ (discordSdk && ((window.innerWidth/window.innerHeight) < 1)) ? { top: '6em' } : {} }>
    <div style={{ width: '4em'}}>
      <b>Level</b>
      <br></br>
      {round} of {calculateMaxRounds(round, numPlayers, remainingCards) || "N/A"}
    </div>
    <div>{lives}</div>
    <div style={{ width: '4em'}}>
      <b>Dealt</b>
      <br></br>
      {deck}
    </div>
  </div>
}

function Latest({ event, round, audio }) {
  const audioContext = useContext(AudioContext);
  const lastCardRef = useRef(0);

  useEffect(() => {
    if (event[0] && event[0].round === round) {
      const card = event[0].card;
      if (card !== lastCardRef.current) {
        if (!audioContext.mute) {
          if (event[0].missed) {
            audio.buzz.play();
          } else {
            audio.ring.play();
          }
        }
      }
    }
    lastCardRef.current = event[0]?.card || 0;
  }, [event]);

  if (event[0]) {
    let e = event[0];
    let card;
    if (e.round === round) {
      card = <Card value={e?.card} missed={e?.missed} playerName={e?.playerName}></Card>
    } else {
      card = <Card value='0' stale={true}></Card>
    }
    return <div className='Latest centered'>{card}</div>
  } else {
    return <div className='Latest centered'>
      <Card value='0' stale={true}></Card>
    </div>
  }
}

function Pile({ pile, round }) {
  if (pile && round) {
    let pileCards = pile.map((event, i) => {
      if (event.round === round) {
        return <Card key={`c${i + 1}`} value={event.card} missed={event.missed} playerName={event?.playerName}></Card>
      } else {
        return <Card key={`c${i + 1}`} value={event.card} missed={event.missed} playerName={event?.playerName} stale={true}></Card>
      }
    });
    return <div className='Pile'>
      {pile?.slice(-1)[0]?.round === round ? pileCards.slice(-7, -1) : pileCards.slice(-6)}
    </div>
  } else {
    return null
  }
}

function Hand({ state, sendMsg, audio }) {
  const loading = useContext(LoadingContext);
  const [cardBuffer, setCardBuffer] = useState(0);
  const [nextBuffer, setNextBuffer] = useState(0);
  const [replayBuffer, setReplayBuffer] = useState(0);
  const [endBuffer, setEndBuffer] = useState(0);
  const intervalRef = useRef(null);
  const stateHashRef = useRef(state.stateHash);
  const stateRef = useRef(state);
  // Refs mirroring buffer state to avoid stale closures in keyboard handlers
  const cardBufferRef = useRef(0);
  const nextBufferRef = useRef(0);
  const replayBufferRef = useRef(0);

  // Keep stateRef current on every render
  stateRef.current = state;

  useEffect(() => { cardBufferRef.current = cardBuffer; }, [cardBuffer]);
  useEffect(() => { nextBufferRef.current = nextBuffer; }, [nextBuffer]);
  useEffect(() => { replayBufferRef.current = replayBuffer; }, [replayBuffer]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key == " ") {
        if (stateRef.current.gamestate.meta.phase === 'won' || stateRef.current.gamestate.meta.phase === 'lost') {
          if (replayBufferRef.current == 0) startBuffer('replayBuffer');
        } else {
          let unplayedCards = stateRef.current.gamestate.players.reduce((playerCards, player) => { return playerCards += player.handSize }, 0);
          if (unplayedCards > 0) {
            if (cardBufferRef.current == 0) startBuffer('cardBuffer');
          } else {
            if (nextBufferRef.current == 0) startBuffer('nextBuffer');
          }
        }
      }
    };
    const onKeyUp = (e) => {
      if (e.key == " ") {
        if (cardBufferRef.current > 0) triggerBuffer('cardBuffer', 'twinge');
        if (nextBufferRef.current > 0) triggerBuffer('nextBuffer', 'next');
        if (replayBufferRef.current > 0) triggerBuffer('replayBuffer', 'restart');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function sendMsg2(type) {
    sendMsg({
      action: 'play',
      gameId: stateRef.current.gameId,
      playerId: stateRef.current.playerId,
      actionType: type,
      stateHash: stateHashRef.current,
    });
  }

  function startBuffer(buffer) {
    if (!loading) {
      cancelBuffer();
      const setter = { cardBuffer: setCardBuffer, nextBuffer: setNextBuffer, replayBuffer: setReplayBuffer, endBuffer: setEndBuffer }[buffer];
      intervalRef.current = setInterval(() => {
        if (buffer === 'cardBuffer' && stateHashRef.current !== stateRef.current.stateHash) {
          cancelBuffer();
        } else {
          setter(prev => prev == 0 ? 10 : prev + 1);
        }
      }, 20)
    }
  }

  function triggerBuffer(buffer, msg) {
    const val = { cardBuffer: cardBufferRef.current, nextBuffer: nextBufferRef.current, replayBuffer: replayBufferRef.current, endBuffer: endBuffer }[buffer];
    if (val <= 150 && val > 25) {
      sendMsg2(msg);
    }
    cancelBuffer();
  }

  function cancelBuffer() {
    stateHashRef.current = state.stateHash;
    clearInterval(intervalRef.current);
    setCardBuffer(0);
    setNextBuffer(0);
    setReplayBuffer(0);
    setEndBuffer(0);
  }

  function bufferColor(buffer, initial) {
    let [hue, saturation, lightness] = [197.4, 71.4, 72.5]
    if (initial === 'royalblue') {
      [hue, saturation, lightness] = [225, 72.7, 56.9]
    }
    if (buffer > 150) {
      [hue, saturation, lightness] = [0, 0, 100]
    } else if (buffer > 125) {
      [hue, saturation, lightness] = [270, 67, 60]
    } else if (buffer > 25) {
      if (initial === 'royalblue') {
        hue = 225 - (225 - 270) * (buffer - 25) / 100;
        saturation = 72.7 - (72.7 - 67) * (buffer - 25) / 100;
        lightness = 56.9 - (56.9 - 60) * (buffer - 25) / 100;
      } else {
        hue = 197.4 - (197.4 - 270) * (buffer - 25) / 100;
        saturation = 71.4 - (71.4 - 67) * (buffer - 25) / 100;
        lightness = 72.5 - (72.5 - 60) * (buffer - 25) / 100;
      }
    }
    return `HSL(${hue}, ${saturation}%, ${lightness}%)`
  }

  if (state.gamestate) {
    if (state.gamestate.meta.phase === 'won' || state.gamestate.meta.phase === 'lost') {
      return <div className='Hand centered unselectable' style={{ opacity: loading && 0.5 }}>
        <div className='Button centered replay'
          style={{ background: `radial-gradient(circle, ${bufferColor(replayBuffer)}, ${bufferColor(replayBuffer)} ${4 * replayBuffer}%, white ${4 * replayBuffer}%, white)` }}
          onMouseDown={() => { startBuffer('replayBuffer') }}
          onMouseUp={() => { triggerBuffer('replayBuffer', 'restart') }}
          onMouseLeave={() => { cancelBuffer() }}
          onTouchStart={() => { startBuffer('replayBuffer') }}
          onTouchEnd={() => { triggerBuffer('replayBuffer', 'restart') }}
        >
          Replay
        </div>
        <div className='Button centered endgame'
          style={{ background: `radial-gradient(circle, ${bufferColor(endBuffer, 'royalblue')}, ${bufferColor(endBuffer, 'royalblue')} ${4 * endBuffer}%, white ${4 * endBuffer}%, white)` }}
          onMouseDown={() => { startBuffer('endBuffer') }}
          onMouseUp={() => { triggerBuffer('endBuffer', 'end') }}
          onMouseLeave={() => { cancelBuffer() }}
          onTouchStart={() => { startBuffer('endBuffer') }}
          onTouchEnd={() => { triggerBuffer('endBuffer', 'end') }}
        >
          Finish
        </div>
      </div>
    } else {
      let unplayedCards = state.gamestate.players.reduce((playerCards, player) => { return playerCards += player.handSize }, 0);
      let numPlayers = Number(state?.gamestate?.players.length - state?.gamestate?.players.reduce((spectators, p) => { return p.strikes === -1 ? spectators + 1 : spectators }, 0));
      if (unplayedCards === 0) {
        return <div className='Hand centered unselectable'
          style={{ 
            opacity: loading && 0.5,
            background: `radial-gradient(circle, ${bufferColor(nextBuffer)}, ${bufferColor(nextBuffer)} ${4 * nextBuffer}%, white ${4 * nextBuffer}%, white)`
          }}
          onMouseDown={() => { startBuffer('nextBuffer') }}
          onMouseUp={() => { triggerBuffer('nextBuffer', 'next') }}
          onMouseLeave={() => { cancelBuffer() }}
          onTouchStart={() => { startBuffer('nextBuffer') }}
          onTouchEnd={() => { triggerBuffer('nextBuffer', 'next') }}
        >
          <div className='Button'>{numPlayers ? 'Next Level' : 'No Active Players'}</div>
        </div>
      } else {
        let activePlayer = state.gamestate.players.find((player) => { return player.playerId === state.playerId });
        if (!activePlayer || !activePlayer.hand) {
          return <div className='Hand'></div>;
        }
        let hand = activePlayer.hand.map((card, i, a) => {
          let wrapperClass = '';
          let borderStyle = { position: "relative" };
          let bufferStyle = { position: "relative" };
          if (a.length === unplayedCards) {
            wrapperClass = 'autoCard';
            borderStyle.bottom = cardBuffer < 150 ? (cardBuffer < 25 ? `${cardBuffer * (-0.08)}em` : "-2em") : 0;
            bufferStyle.background = `radial-gradient(circle, ${bufferColor(cardBuffer, 'royalblue')}, ${bufferColor(cardBuffer, 'royalblue')} ${4 * cardBuffer}%, white ${4 * cardBuffer}%, white)`;
          } else if (card === a[0] + i) {
            wrapperClass = 'nextCard';
            borderStyle.bottom = cardBuffer < 150 ? (cardBuffer < 25 ? `${cardBuffer * (-0.08)}em` : "-2em") : 0;
            bufferStyle.background = `radial-gradient(circle, ${bufferColor(cardBuffer)}, ${bufferColor(cardBuffer)} ${4 * cardBuffer}%, white ${4 * cardBuffer}%, white)`;
          }
          return <div key={`h${card}`} className={`cardWrapper ${wrapperClass}`} style={{ ...borderStyle, 'zIndex': a.length - i }}>
            <Card value={card} style={bufferStyle}></Card>
          </div>
        });
        if (hand.length > 0) {
          return <div className='Hand unselectable'
            onMouseDown={() => { startBuffer('cardBuffer') }}
            onMouseUp={() => { triggerBuffer('cardBuffer', 'twinge') }}
            onMouseLeave={() => { cancelBuffer() }}
            onTouchStart={() => { startBuffer('cardBuffer') }}
            onTouchEnd={() => { triggerBuffer('cardBuffer', 'twinge') }}
            style={{ opacity: loading && 0.5 }}
          >
            {state.gamestate.meta.round <= 4 &&
              <div className='handTooltip'>
                {(cardBuffer <= 25 || cardBuffer > 150) && 
                  <div>
                    👇 PRESS to Start when you<br></br>
                     think you're the lowest ⬇️<br></br>
                  </div>
                }
                {(cardBuffer > 25 && cardBuffer <= 150) &&
                  <div>
                    👋 RELEASE to Send or<br></br>
                    KEEP HOLDING to Cancel 🙅
                  </div>
                }
              </div>
            }
            <div className='handWrapper'>
              {hand.reverse()}
            </div>
          </div>
        } else {
          return <div className='Hand centered unselectable' style={{ opacity: loading && 0.5 }}>
            <div className='Button'>{unplayedCards} Card{unplayedCards !== 1 ? 's' : ''} Remaining</div>
          </div>
        }
      }
    }
  } else {
    return null
  }
}

function Card({ value, missed, stale, style, playerName }) {
  return <>
    <div key={value} className={`Card column ${missed && 'missed'} ${stale && 'stale'}`} style={style}>
      <div>{value}</div>
      <div style={{ fontSize: 'calc(max(6pt, 40%)' }}>{playerName}</div>
    </div>
  </>
}

export {
  Players,
  Status,
  Latest,
  Pile,
  Hand,
  Card,
}