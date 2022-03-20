import React from 'react';
import { Players, Status, Latest, Pile, Hand } from './Table';

class Lobby extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <div className='Lobby'>
      <h1>Twinge</h1>
      <p>I've got a twinge</p>
      <Players className='Players centered' context='lobby' players={this.props.state?.gamestate?.players || []}></Players>
      <button className='Button' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'new' }) }}>Create Game</button>
      <input id='inputBox' type='text' pattern='[A-Z]'></input>
      <button className='Button' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'join', roomCode: document.getElementById('inputBox').value }) }}>Join Game</button>
      <button className='Button' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'rename', name: document.getElementById('inputBox').value, gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>Rename Player</button>
      <button className='Button' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'start', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>Start Game</button>
    </div>
  }
}

class Play extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <div className='Play'>
      <Status state={this.props.state}></Status>
      <Players className='Players centered' context='play' players={this.props.state?.gamestate?.players || []}></Players>
      <Latest className='Latest centered' event={this.props.state?.gamestate?.public?.pile?.slice(-1) || []} round={this.props.state?.gamestate?.meta?.round || 0}></Latest>
      <Pile pile={this.props.state?.gamestate?.public?.pile} round={this.props.state?.gamestate?.meta?.round || 0}></Pile>
      <Hand state={this.props?.state} sendMsg={this.props.sendMsg}></Hand>
      </div>
  }
}

export { Lobby, Play }