import React from 'react';
import { AudioContext } from '../context/AudioContext';

class Players extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 0,
    }
  }

  render() {
    let players = this.props.players.map((player, i) => {
      if (this.props.context === 'lobby') {
        if (i === 0 && !player.name.startsWith("⭐️")) {
          player.name = `⭐️ ${player.name}`
        }
        return <Player key={`p${i + 1}`} state={this.props.state} sendMsg={this.props.sendMsg} context='lobby' number={i + 1} name={player.name} strikes={player.strikes} connected={player.connected} style={player.playerId && { border: '0.25em solid greenyellow' }}></Player>
      } else {
        return <Player key={`p${i + 1}`} state={this.props.state} sendMsg={this.props.sendMsg} number={i + 1} name={player.name} handSize={player.handSize} strikes={player.strikes} connected={player.connected} pin={player.playerId === this.props.state.playerId}></Player>
      }
    });
    let featuredPlayers = players.sort((a, b) => {
      if (a.props.pin) {
        return -1
      } else if (b.props.pin) {
        return 1
      } else {
        return b.props?.handSize - a.props.handSize
      }
    })
    return <div className={`Players`} >
      <div className={`${this.props.context === 'lobby' ? 'playerLobby' : 'playerTable'}`}>
        {featuredPlayers}
      </div>
    </div>
  }
}

class Player extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      id: `p${this.props.number}`,
      kickBuffer: 0,
    };
    this.handSize = this.props.handSize;
    this.stateHash = this.props.state.stateHash;
  }

  componentDidUpdate() {
    if ((this.handSize !== this.props.handSize) && (this.state.kickBuffer === 0)) {
      this.highlight();
    }
    this.handSize = this.props.handSize;
  }

  highlight = () => {
    try {
      if (this.props?.context !== 'lobby') {
        document.getElementById(this.state.id).classList.add('playerHighlight');
        setTimeout(() => {
          document.getElementById(this.state.id).classList.remove('playerHighlight');
        }, 500)
      }
    } catch (err) {
      console.error(err);
    }
  }

  startBuffer = (buffer) => {
    this.cancelBuffer();
    this.interval = setInterval(() => {
      if (this.stateHash !== this.props.state.stateHash) {
        this.cancelBuffer();
      } else if (this.state[buffer] < 100) {
        let state = {};
        state[buffer] = this.state[buffer] + 1;
        this.setState(state)
      }
    }, 20)
  }

  triggerBuffer = (buffer) => {
    if (this.state[buffer] >= 100) {
      this.props.sendMsg({
        action: 'play',
        gameId: this.props.state.gameId,
        playerId: this.props.state.playerId,
        actionType: 'kick',
        target: (this.props.number - 1),
        stateHash: this.props.state.stateHash,
      });
    }
    this.cancelBuffer();
  }

  cancelBuffer = () => {
    this.stateHash = this.props.state.stateHash;
    clearInterval(this.interval);
    this.setState({
      kickBuffer: 0,
    })
  }

  render() {
    if (this.props.context === 'lobby') {
      return <div key={`p${this.state.id}`} id={this.state.id} className={`Player ${this.props.strikes > 0 && 'strikes'}`}
        style={{ ...this.props.style, background: `radial-gradient(circle, orange, orange ${1 * this.state.kickBuffer}%, white ${1 * this.state.kickBuffer}%, white)` }}
        onMouseDown={() => { this.startBuffer('kickBuffer') }}
        onMouseUp={() => { this.triggerBuffer('kickBuffer') }}
        onMouseLeave={() => { this.cancelBuffer() }}
        onTouchStart={() => { this.startBuffer('kickBuffer') }}
        onTouchEnd={() => { this.triggerBuffer('kickBuffer') }}
      >
        <div className={`playerValue ${(this.props.connected === false) && 'disconnected'}`} >{`${this.props.name} ${this.props.strikes < 0 ? '👀' : ''}`}</div>
      </div>
    } else {
      return <div key={`p${this.state.id}`} id={this.state.id} className={`Player ${this.props.hidden && 'hidden'} ${this.props.strikes > 0 && 'strikes'} ${this.props.handSize === 0 && 'stale'}`}
        style={{ background: `radial-gradient(circle, orange, orange ${1 * this.state.kickBuffer}%, white ${1 * this.state.kickBuffer}%, white)` }}
        onMouseDown={() => { this.startBuffer('kickBuffer') }}
        onMouseUp={() => { this.triggerBuffer('kickBuffer') }}
        onMouseLeave={() => { this.cancelBuffer() }}
        onTouchStart={() => { this.startBuffer('kickBuffer') }}
        onTouchEnd={() => { this.triggerBuffer('kickBuffer') }}
      >
        <div className={`playerValue ${(this.props.connected === false) && 'disconnected'}`} style={{ background: `${this.props.pin && "lightyellow"}` }} >
          <div className='playerName'>{this.props.name}</div>
          {`${this.props.strikes === -1 ? `👀 ${this.props.handSize || ''}` : `✋ ${this.props.handSize}`}`}
        </div>
      </div>
    }
  }
}

class Status extends React.Component {
  calculateMaxRounds(currentRound, numPlayers, remainingCards) {
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

  render() {
    // Levels
    let round = Number(this.props.state?.gamestate?.meta?.round);
    let numPlayers = Number(this.props.state?.gamestate?.players.length - this.props.state?.gamestate?.players.reduce((spectators, p) => { return p.strikes === -1 ? spectators + 1 : spectators }, 0));
    let remainingCards = Number(this.props.state?.gamestate?.public?.remaining);

    // Lives
    let lives = '';
    let currentLives = this.props.state?.gamestate?.public?.lives;
    let maxLives = this.props.state?.gamestate?.config?.maxLives;
    if (maxLives <= 10) {
      lives += '❤️'.repeat(currentLives);
      lives += '🤍'.repeat((maxLives - currentLives) > 0 ? (maxLives - currentLives) : 0);
    } else {
      lives = `${currentLives} ❤️`
    }

    // Deck
    let deck = `${this.props.state?.gamestate?.config?.deckSize - remainingCards}/${this.props.state?.gamestate?.config?.deckSize}`
    return <div className='Status'>
      <div>
        Level
        <br></br>
        {round} of {this.calculateMaxRounds(round, numPlayers, remainingCards) || "N/A"}
      </div>
      <div>{lives}</div>
      <div>
        Dealt
        <br></br>
        {deck}
      </div>
    </div>
  }
}

class Latest extends React.Component {
  constructor(props) {
    super(props);
    this.lastCard = 0;
  }

  render() {
    let audio = this.context;
    if (this.props.event[0]) {
      let event = this.props.event[0];
      let card;
      if (event.round === this.props.round) {
        card = <Card value={event?.card} missed={event?.missed}></Card>
      } else {
        card = <Card value='0' stale={true}></Card>
      }
      if (event?.card !== this.lastCard) {
        if (!audio.mute) {
          if (event?.missed && (event.round === this.props.round)) {
            this.props.audio.buzz.play(); // MISS SOUND
          } else {
            this.props.audio.ring.play(); // HIT SOUND
          }
        }
      }
      this.lastCard = event?.card || 0;
      return <div className='Latest centered'>
        {card}
      </div>
    } else {
      return <div className='Latest centered'>
        <Card value='0' stale={true}></Card>
      </div>
    }
  }
}
Latest.contextType = AudioContext;

class Pile extends React.Component {
  render() {
    if (this.props.pile && this.props.round) {
      let pile = this.props.pile.map((event, i) => {
        if (event.round === this.props.round) {
          return <Card key={`c${i + 1}`} value={event.card} missed={event.missed}></Card>
        } else {
          return <Card key={`c${i + 1}`} value={event.card} missed={event.missed} stale={true}></Card>
        }
      });
      return <div className='Pile'>
        {this.props?.pile?.slice(-1)[0]?.round === this.props.round ? pile.slice(-7, -1) : pile.slice(-6)}
      </div>
    } else {
      return null
    }
  }
}

class Hand extends React.Component {
  constructor(props) {
    super(props);
    this.sendMsg = (type) => {
      this.props.sendMsg({
        action: 'play',
        gameId: this.props.state.gameId,
        playerId: this.props.state.playerId,
        actionType: type,
        stateHash: this.stateHash,
      });
    }
    this.state = {
      cardBuffer: 0,
      nextBuffer: 0,
      replayBuffer: 0,
      endBuffer: 0,
    }
    this.stateHash = this.props.state.stateHash;
  }

  startBuffer = (buffer) => {
    this.cancelBuffer();
    this.interval = setInterval(() => {
      if (buffer === 'cardBuffer' && this.stateHash !== this.props.state.stateHash) {
        this.cancelBuffer();
      } else {
        let state = {};
        state[buffer] = this.state[buffer] + 1;
        this.setState(state)
      }
    }, 20)
  }

  triggerBuffer = (buffer, msg) => {
    if (this.state[buffer] <= 200 && this.state[buffer] > 25) {
      this.sendMsg(msg);
    }
    this.cancelBuffer();
  }

  cancelBuffer = () => {
    this.stateHash = this.props.state.stateHash;
    clearInterval(this.interval);
    this.setState({
      cardBuffer: 0,
      nextBuffer: 0,
      replayBuffer: 0,
      endBuffer: 0,
    })
  }

  bufferColor = (buffer, initial) => {
    // greenyellow HSL(84, 100%, 59%)
    let [hue, saturation, lightness] = [84, 100, 59]
    if (initial === 'yellow') {
      // yellow HSL(60, 100%, 50%)
      [hue, saturation, lightness] = [60, 100, 50]
    }

    if (buffer > 200) {
      // white HSL(0, 0%, 100%)
      [hue, saturation, lightness] = [0, 0, 100]
    } else if (buffer > 175) {
      // orange HSL(38.8, 100%, 50%)
      [hue, saturation, lightness] = [38.8, 100, 50]
    } else if (buffer > 75) {
      if (initial === 'yellow') {
        // yellow HSL(60, 100%, 50%)
        hue = 60 - (60 - 38.8) * (buffer - 75) / 100;
      } else {
        // greenyellow HSL(84, 100%, 59%)
        hue = 84 - (84 - 38.8) * (buffer - 75) / 100;
        lightness = 59 - (59 - 50) * (buffer - 75) / 100;
      }
    }
    return `HSL(${hue}, ${saturation}%, ${lightness}%)`
  }

  render() {
    if (this.props.state.gamestate) {
      if (this.props.state.gamestate.meta.phase === 'won' || this.props.state.gamestate.meta.phase === 'lost') {
        return <div className='Hand centered unselectable'>
          <div className='Button centered replay'
            style={{ background: `radial-gradient(circle, ${this.bufferColor(this.state.replayBuffer)}, ${this.bufferColor(this.state.replayBuffer)} ${4 * this.state.replayBuffer}%, white ${4 * this.state.replayBuffer}%, white)` }}
            onMouseDown={() => { this.startBuffer('replayBuffer') }}
            onMouseUp={() => { this.triggerBuffer('replayBuffer', 'restart') }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer('replayBuffer') }}
            onTouchEnd={() => { this.triggerBuffer('replayBuffer', 'restart') }}
          >
            Replay
          </div>
          <div className='Button centered endgame'
            style={{ background: `radial-gradient(circle, ${this.bufferColor(this.state.endBuffer, 'yellow')}, ${this.bufferColor(this.state.endBuffer, 'yellow')} ${4 * this.state.endBuffer}%, white ${4 * this.state.endBuffer}%, white)` }}
            onMouseDown={() => { this.startBuffer('endBuffer') }}
            onMouseUp={() => { this.triggerBuffer('endBuffer', 'end') }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer('endBuffer') }}
            onTouchEnd={() => { this.triggerBuffer('endBuffer', 'end') }}
          >
            Finish
          </div>
        </div>
      } else {
        let unplayedCards = this.props.state.gamestate.players.reduce((playerCards, player) => { return playerCards += player.handSize }, 0);
        let numPlayers = Number(this.props.state?.gamestate?.players.length - this.props.state?.gamestate?.players.reduce((spectators, p) => { return p.strikes === -1 ? spectators + 1 : spectators }, 0));
        if (unplayedCards === 0) {
          return <div className='Hand centered unselectable'
            style={{ background: `radial-gradient(circle, ${this.bufferColor(this.state.nextBuffer)}, ${this.bufferColor(this.state.nextBuffer)} ${4 * this.state.nextBuffer}%, white ${4 * this.state.nextBuffer}%, white)` }}
            onMouseDown={() => { this.startBuffer('nextBuffer') }}
            onMouseUp={() => { this.triggerBuffer('nextBuffer', 'next') }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer('nextBuffer') }}
            onTouchEnd={() => { this.triggerBuffer('nextBuffer', 'next') }}
          >
            <div className='Button'>{numPlayers ? 'Next Level' : 'No Active Players'}</div>
          </div>
        } else {
          let activePlayer = this.props.state.gamestate.players.find((player) => { return player.playerId === this.props.state.playerId });
          let hand = activePlayer.hand.map((card, i, a) => {
            // Check for consecutive next cards to be played together
            let wrapperClass = '';
            let bufferStyle = {};
            if (a.length === unplayedCards) {
              wrapperClass = 'autoCard';
              bufferStyle = { background: `radial-gradient(circle, ${this.bufferColor(this.state.cardBuffer, 'yellow')}, ${this.bufferColor(this.state.cardBuffer, 'yellow')} ${4 * this.state.cardBuffer}%, white ${4 * this.state.cardBuffer}%, white)` }
            } else if (card === a[0] + i) {
              wrapperClass = 'nextCard';
              bufferStyle = { background: `radial-gradient(circle, ${this.bufferColor(this.state.cardBuffer)}, ${this.bufferColor(this.state.cardBuffer)} ${4 * this.state.cardBuffer}%, white ${4 * this.state.cardBuffer}%, white)` }
            }
            return <div key={`h${i + 1}`} className={`cardWrapper ${wrapperClass}`} style={{ 'zIndex': a.length - i }}>
              <Card value={card} style={bufferStyle}></Card>
            </div>
          });
          if (hand.length > 0) {
            return <div className='Hand unselectable'
              onMouseDown={() => { this.startBuffer('cardBuffer') }}
              onMouseUp={() => { this.triggerBuffer('cardBuffer', 'twinge') }}
              onMouseLeave={() => { this.cancelBuffer() }}
              onTouchStart={() => { this.startBuffer('cardBuffer') }}
              onTouchEnd={() => { this.triggerBuffer('cardBuffer', 'twinge') }}
            >
              {this.props.state.gamestate.meta.round <= 4 &&
                <div className='handTooltip'>
                  {(this.state.cardBuffer <= 25 || this.state.cardBuffer > 200) && <div>👇 Hold to Prepare</div>}
                  {(this.state.cardBuffer > 25 && this.state.cardBuffer <= 200) &&
                    <>
                      <div>👋 Release to Play</div>
                      <br></br>
                      <div>👎 Hold to Cancel</div>
                    </>
                  }
                </div>
              }
              <div className='handWrapper'>
                {hand.reverse()}
              </div>
            </div>
          } else {
            return <div className='Hand centered unselectable'>
              <div className='Button'>{unplayedCards} Card{unplayedCards !== 1 ? 's' : ''} Remaining</div>
            </div>
          }
        }
      }
    } else {
      return null
    }
  }
}

class Card extends React.Component {
  render() {
    return <div key={this.props.value} className={`Card centered ${this.props.missed && 'missed'} ${this.props.stale && 'stale'}`} style={this.props?.style}>
      {this.props.value}
    </div>
  }
}

export {
  Players,
  Status,
  Latest,
  Pile,
  Hand,
  Card,
}