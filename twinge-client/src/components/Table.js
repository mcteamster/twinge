import React from 'react';

class Players extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let players = this.props.players.map((player, i) => {
      return <div key={`p${i + 1}`} className='player'>
        <div className='playerValue'>{this.props.context=='lobby' ? `P${i+1}` : `🖐 ${player.handSize}`}</div>
        <div className='playerName'>{player.name}</div>
      </div>
    });

    return <div className='Players'>
      {players}
    </div>
  }
}

class Status extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let round = `Level ${this.props.state?.gamestate?.meta?.round}`;
    let lives = '';
    lives += '❤️'.repeat(this.props.state?.gamestate?.public?.lives || 0);
    lives += '🤍'.repeat(this.props.state?.gamestate?.config?.maxLives - this.props.state?.gamestate?.public?.lives || 0);
    let deck = `${this.props.state?.gamestate?.config?.deckSize - this.props.state?.gamestate?.public?.remaining} of ${this.props.state?.gamestate?.config?.deckSize} Dealt`
    return <div className='Status'>
      <div>{round}</div>
      <div>{lives}</div>
      <div>{deck}</div>
    </div>
  }
}

class Latest extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if(this.props.event[0]) {
      let event = this.props.event[0];
      let card;
      if (event.round == this.props.round) {
        card = <Card value={event?.card} missed={event?.missed}></Card>
      } else {
        card = <Card value='lowest plays first' stale={true}></Card>
      }
      return <div className='Latest centered'>
        {card}
      </div>
    } else {
      return <div className='Latest centered'>
        <Card value='lowest plays first' stale={true}></Card>
      </div>
    }
  }
}

class Pile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      cursor: 0,
    }
  }

  render() {
    if (this.props.pile && this.props.round) {
      let pile = this.props.pile.map((event, i) => {
        if (event.round == this.props.round) {
          return <Card key={`c${i + 1}`} value={event.card} missed={event.missed}></Card>
        } else {
          return <Card key={`c${i + 1}`} value={event.card} missed={event.missed} stale={true}></Card>
        }
      });
      return <div className='Pile'>
        {this.props?.pile?.slice(-1)[0]?.round == this.props.round ? pile.slice(-8,-1) : pile.slice(-7)}
      </div>
    } else {
      return null
    }
  }
}

class Hand extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.state.gamestate) {
      if (this.props.state.gamestate.meta.phase == 'won' || this.props.state.gamestate.meta.phase == 'lost') {
        return <div className='Hand unselectable'>
          <div className='Button endgame' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'restart', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
            Replay?
          </div>
          <div className='Button endgame' onClick={() => {
            
            this.props.sendMsg({ action: 'play', actionType: 'end', gameId: this.props.state.gameId, playerId: this.props.state.playerId });
          }}>
            End Game
          </div>
        </div>
      } else {
        let unplayedCards = this.props.state.gamestate.players.reduce((playerCards, player) => { return playerCards += player.handSize }, 0);
        if (unplayedCards == 0) {
          return <div className='Hand centered unselectable' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'next', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
            <div className='Button'>Next Round</div>
          </div>
        } else {
          let hand = this.props.state.gamestate.players.find((player) => { return player.playerId == this.props.state.playerId }).hand.map((card, i) => {
            return <Card key={`h${i + 1}`} value={card}></Card>
          });
          if (hand.length > 0) {
            return <div className='Hand centered unselectable' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'twinge', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
              {hand}
            </div>
          } else {
            return <div className='Hand centered unselectable'>
              <div className='Button'>{unplayedCards} Card{unplayedCards != 1 ? 's' : ''} Remaining</div>
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
  constructor(props) {
    super(props);
  }

  render() {
    return <div className={`Card centered ${this.props.missed && 'missed'} ${this.props.stale && 'stale'}`}>
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