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
      localStorage.setItem('gameId', 'c2c858b4-311d-d3b5-19fd-203b4b41aa7d'); // Testing
      localStorage.setItem('playerId', '3288fc25-2ebb-5bb4-791b-18fc79c4b002'); // Testing
      let gameId = localStorage.getItem('gameId');
      let playerId = localStorage.getItem('playerId');
      this.sendMsg({ action: 'lobby', actionType: 'join', gameId: gameId, playerId: playerId });
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
      <button onClick={() => { this.sendMsg({ action: 'lobby', actionType: 'new' }) }}>Create Game</button>
      <button onClick={() => { this.sendMsg({ action: 'lobby', actionType: 'join', roomCode: "ABCD" }) }}>Rejoin Game</button>
    </div>
  }
}

export default App;
