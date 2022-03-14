import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge.mcteamster.com');
    this.ws.onopen = () => {
      // try to rejoin game
      let gamestateId = localStorage.getItem("gamestateId");
      gamestateId = 'a5d3d0fe-beee-3a8a-ce94-c994822475c1';
      if (gamestateId) {
        this.sendMsg({ action: 'lobby', actionType: 'join', gameId: gamestateId })
      }
    };
    this.ws.onmessage = (msg) => {
      console.dir(JSON.parse(msg.data));
      // Handlers go here
    }
  }

  sendMsg(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  render() {
    return <div>
      <button onClick={() => { this.sendMsg({ action: 'lobby', actionType: 'new', gameId: 'tonz' }) }}>Click Here</button>
    </div>
  }
}

export default App;
