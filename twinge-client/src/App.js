import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge.mcteamster.com');
    this.ws.onopen = () => {};
    this.ws.onmessage = (msg) => {
      console.dir(msg.data);
    }
  }

  sendMsg(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  render(){
    return <div>
      <button onClick={() => {this.sendMsg({action: 'lobby', actionType: 'create', gamestateId: 'tonz'})}}>Click Here</button>
    </div>
  }
}

export default App;
