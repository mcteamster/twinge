import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gameId: localStorage.getItem('gameId'),
      playerId: localStorage.getItem('playerId'),
    };
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge.mcteamster.com');
    this.ws.onopen = async () => {
      this.sendMsg({ action: 'play', actionType: 'join', gameId: this.state.gameId, playerId: this.state.playerId });
    };
    this.ws.onmessage = (msg) => {
      let data = JSON.parse(msg.data);
      // Hide Websocket Acknowlegements
      if (data.message === 'ack') {
        console.log(new Date().toISOString());
      }
      // Handle Errors
      else if (data.message) {
        console.error(data.message);
      } 
      // Handle Gamestate Changes
      else {
        // Update State
        this.setState({
          ...data,
          playerId: data.gamestate.players.reduce((playerId, player) => { 
            return `${playerId}${ player.playerId || '' }` 
          }, ''),
        });
        // Store gameId and playerId
        localStorage.setItem('gameId', this.state.gameId);
        localStorage.setItem('playerId', this.state.playerId);
      }
    }
  }

  async sendMsg(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  render() {
    return <div>
      <div>GAMEID: {this.state.gameId}, PLAYERID: {this.state.playerId}</div>

      <div>ROOMCODE: {this.state.roomCode}</div>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'new' }) }}>Create Game</button>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'join', roomCode: document.getElementById('roomCodeBox').value }) }}>Join Game</button>
      <input id='roomCodeBox' type='text' pattern='[A-Z]'></input>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'start', gameId: this.state.gameId, playerId: this.state.playerId }) }}>Start Game</button>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'twinge', gameId: this.state.gameId, playerId: this.state.playerId }) }}>Play Card</button>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'next', gameId: this.state.gameId, playerId: this.state.playerId }) }}>Next Round</button>

      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'restart', gameId: this.state.gameId, playerId: this.state.playerId }) }}>Restart Game</button>

      <div>GAME: {JSON.stringify(this.state.gamestate)}</div>
    </div>
  }
}

export default App;
