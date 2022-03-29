import React from 'react';

class Players extends React.Component {
  render() {
    let players = this.props.players.map((player, i) => {
      if(this.props.context === 'lobby') {
        return <Player key={`p${i + 1}`} context='lobby' number={i+1} name={player.name} style={player.playerId && { border: '0.25em solid greenyellow' }}></Player>
      } else if (!player.playerId) {
        return <Player key={`p${i + 1}`} number={i+1} name={player.name} handSize={player.handSize}></Player>
      }
      return null;
    });
    return <div className='Players'>
      {players}
    </div>
  }
}

class Player extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      id: `p${this.props.number}`,
    }
  }

  componentDidUpdate() {
    this.hightlight();
  }

  hightlight = () => {
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

  render() {
    if(this.props.context === 'lobby') {
      return <div key={`p${this.state.id}`} id={this.state.id} className='Player' style={this.props.style}>
        <div className='playerValue'>{`${this.props.name}`}</div>
      </div>
    } else {
      return <div key={`p${this.state.id}`} id={this.state.id} className='Player'>
        <div className='playerValue'>
          <div className='playerName'>{this.props.name}</div>
          {`🖐 ${this.props.handSize}`}
        </div>
      </div>
    }
  }
}

class Status extends React.Component {
  render() {
    let round = `Level ${this.props.state?.gamestate?.meta?.round}`;
    let lives = '';
    let currentLives = this.props.state?.gamestate?.public?.lives;
    let maxLives = this.props.state?.gamestate?.config?.maxLives;
    if(maxLives <= 10) {
      lives += '❤️'.repeat(currentLives);
      lives += '🤍'.repeat((maxLives - currentLives) > 0 ? (maxLives - currentLives) : 0);
    } else {
      lives = `${currentLives} ❤️`
    }
    let deck = `${this.props.state?.gamestate?.config?.deckSize - this.props.state?.gamestate?.public?.remaining}/${this.props.state?.gamestate?.config?.deckSize}`
    return <div className='Status'>
      <div>{round}</div>
      <div>{lives}</div>
      <div>{deck}</div>
    </div>
  }
}

class Latest extends React.Component {
  render() {
    if(this.props.event[0]) {
      let event = this.props.event[0];
      let card;
      if (event.round === this.props.round) {
        card = <Card value={event?.card} missed={event?.missed}></Card>
      } else {
        card = <Card value='0' stale={true}></Card>
      }
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
        {this.props?.pile?.slice(-1)[0]?.round === this.props.round ? pile.slice(-7,-1) : pile.slice(-6)}
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
    if (this.state[buffer] > 25) {
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

  render() {
    if (this.props.state.gamestate) {
      if (this.props.state.gamestate.meta.phase === 'won' || this.props.state.gamestate.meta.phase === 'lost') {
        return <div className='Hand centered unselectable'>
          <div className='Button centered replay'           
            style={{ background: `radial-gradient(circle, greenyellow, greenyellow ${4*this.state.replayBuffer}%, white ${4*this.state.replayBuffer}%, white)`}} 
            onMouseDown={() => { this.startBuffer('replayBuffer') }}
            onMouseUp={() => { this.triggerBuffer('replayBuffer', 'restart') }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer('replayBuffer') }}
            onTouchEnd={() => { this.triggerBuffer('replayBuffer', 'restart') }}
          >
            Replay
          </div>
          <div className='Button centered endgame' 
            style={{ background: `radial-gradient(circle, red, red ${4*this.state.endBuffer}%, white ${4*this.state.endBuffer}%, white)`}} 
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
        if (unplayedCards === 0) {
          return <div className='Hand centered unselectable' 
            style={{ background: `radial-gradient(circle, greenyellow, greenyellow ${4*this.state.nextBuffer}%, white ${4*this.state.nextBuffer}%, white)`}} 
            onMouseDown={() => { this.startBuffer('nextBuffer') }}
            onMouseUp={() => { this.triggerBuffer('nextBuffer', 'next') }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer('nextBuffer') }}
            onTouchEnd={() => { this.triggerBuffer('nextBuffer', 'next') }}
          >
            <div className='Button'>Next Level</div>
          </div>
        } else {
          let hand = this.props.state.gamestate.players.find((player) => { return player.playerId === this.props.state.playerId }).hand.map((card, i, a) => {
            // Check for consecutive next cards to be played together
            let wrapperClass = '';
            let bufferStyle = {};
            if (a.length === unplayedCards) {
              wrapperClass = 'autoCard';
              bufferStyle = { background: `radial-gradient(circle, yellow, yellow ${4*this.state.cardBuffer}%, white ${4*this.state.cardBuffer}%, white)`} 
            } else if (card === a[0]+i) {
              wrapperClass = 'nextCard';
              bufferStyle = { background: `radial-gradient(circle, greenyellow, greenyellow ${4*this.state.cardBuffer}%, white ${4*this.state.cardBuffer}%, white)`} 
            }
            return <div key={`h${i + 1}`} className={`cardWrapper ${wrapperClass}`} style={{ 'zIndex': a.length - i }}>
              <Card value={card} style={bufferStyle}></Card> 
            </div>
          });
          if (hand.length > 0) {
            return <div className='Hand unselectable' 
              onMouseDown={() => { this.startBuffer('cardBuffer') }}
              onMouseUp={() => { this.triggerBuffer('cardBuffer', 'twinge')}}
              onMouseLeave={() => { this.cancelBuffer() }}
              onTouchStart={() => { this.startBuffer('cardBuffer') }}
              onTouchEnd={() => { this.triggerBuffer('cardBuffer', 'twinge')}}
            >
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