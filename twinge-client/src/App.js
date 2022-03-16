import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge.mcteamster.com');
    this.ws.onopen = async () => {
      localStorage.setItem('gameId', '7bad0dcc-80c8-3a14-cf5d-37e948f9e9f2'); // Testing
      localStorage.setItem('playerId', 'beda7610-4a64-fe0b-2db4-0f07910162c4'); // Testing
      this.gameId = localStorage.getItem('gameId');
      this.playerId = localStorage.getItem('playerId');
      this.sendMsg({ action: 'play', actionType: 'join', gameId: this.gameId, playerId: this.playerId });
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
        console.dir(data);
      }
    }
  }

  async sendMsg(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  render() {
    return <div>
      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'new' }) }}>Create Game</button>
      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'join', roomCode: "ABCD" }) }}>Join Game</button>
      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'start', gameId: this.gameId, playerId: this.playerId }) }}>Start Game</button>
      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'twinge', gameId: this.gameId, playerId: this.playerId }) }}>Play Card</button>
      <button onClick={() => { this.sendMsg({ action: 'play', actionType: 'restart', gameId: this.gameId, playerId: this.playerId }) }}>Restart Game</button>
    </div>
  }
}

export default App;
