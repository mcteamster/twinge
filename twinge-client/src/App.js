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
      gamestateId = '7b482656-9b62-d538-5ff9-75726b8ad0f4';
      if (gamestateId) {
        this.sendMsg({ action: 'lobby', actionType: 'join', gamestateId: gamestateId })
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
      <button onClick={() => { this.sendMsg({ action: 'lobby', actionType: 'create', gamestateId: 'tonz' }) }}>Click Here</button>
    </div>
  }
}

export default App;
