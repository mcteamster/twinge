import React from 'react';

class Players extends React.Component {
  render() {
    let players = this.props.players.map((player, i) => {
      if(this.props.context === 'lobby') {
        return <div key={`p${i + 1}`} className='player' style={player.playerId && { border: '0.25em solid greenyellow' }}>
          <div className='playerValue'>{`${player.name}`}</div>
        </div>
      } else if (!player.playerId) {
        return <div key={`p${i + 1}`} className='player'>
          <div className='playerValue'>
            <div className='playerName'>{player.name}</div>
            {`🖐 ${player.handSize}`}
          </div>
        </div>
      }
    });

    return <div className='Players'>
      {players}
    </div>
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
    this.sendMsg = (msg) => {
      this.props.sendMsg(msg)
    }
    this.state = {
      buffer: 0
    }
  }
  
  startBuffer = (period) => {
    this.cancelBuffer();
    this.interval = setInterval(() => {
      this.setState({
        buffer: this.state.buffer + 1,
      })
    }, period)
  }

  triggerBuffer = (msg) => {
    if (this.state.buffer > 25) {
      this.sendMsg(msg);
    }
    this.cancelBuffer();
  }

  cancelBuffer = () => {
    clearInterval(this.interval);
    this.setState({
      buffer: 0,
    })
  }

  render() {
    if (this.props.state.gamestate) {
      if (this.props.state.gamestate.meta.phase === 'won' || this.props.state.gamestate.meta.phase === 'lost') {
        return <div className='Hand centered unselectable'>
          <div className='Button centered replay' onClick={() => { 
            this.sendMsg({ action: 'play', actionType: 'restart', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) 
          }}>
            Replay
          </div>
          <div className='Button centered endgame' onClick={() => {
            this.sendMsg({ action: 'play', actionType: 'end', gameId: this.props.state.gameId, playerId: this.props.state.playerId });
          }}>
            End Game
          </div>
        </div>
      } else {
        let unplayedCards = this.props.state.gamestate.players.reduce((playerCards, player) => { return playerCards += player.handSize }, 0);
        if (unplayedCards === 0) {
          return <div className='Hand centered unselectable' 
            style={{ background: `radial-gradient(circle, greenyellow , greenyellow ${4*this.state.buffer}%, white ${4*this.state.buffer}%, white)`}} 
            onMouseDown={() => { this.startBuffer(20) }}
            onMouseUp={() => { this.triggerBuffer({ action: 'play', actionType: 'next', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}
            onMouseLeave={() => { this.cancelBuffer() }}
            onTouchStart={() => { this.startBuffer(20) }}
            onTouchEnd={() => { this.triggerBuffer({ action: 'play', actionType: 'next', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}
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
              bufferStyle = { background: `radial-gradient(circle, yellow , yellow ${4*this.state.buffer}%, white ${4*this.state.buffer}%, white)`} 
            } else if (card === a[0]+i) {
              wrapperClass = 'nextCard';
              bufferStyle = { background: `radial-gradient(circle, greenyellow , greenyellow ${4*this.state.buffer}%, white ${4*this.state.buffer}%, white)`} 
            }
            return <div key={`h${i + 1}`} className={`cardWrapper ${wrapperClass}`} style={{ 'zIndex': a.length - i }}>
              <Card value={card} style={bufferStyle}></Card> 
            </div>
          });
          if (hand.length > 0) {
            return <div className='Hand unselectable' 
              onMouseDown={() => { this.startBuffer(20) }}
              onMouseUp={() => { this.triggerBuffer({ action: 'play', actionType: 'twinge', gameId: this.props.state.gameId, playerId: this.props.state.playerId })}}
              onMouseLeave={() => { this.cancelBuffer() }}
              onTouchStart={() => { this.startBuffer(20) }}
              onTouchEnd={() => { this.triggerBuffer({ action: 'play', actionType: 'twinge', gameId: this.props.state.gameId, playerId: this.props.state.playerId })}}
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