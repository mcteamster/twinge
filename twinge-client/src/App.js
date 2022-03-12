import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge.mcteamster.com')
  }

  render(){
    return <div>henlo world</div>
  }
}

export default App;
