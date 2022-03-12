import './App.css';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://rdhwtybprk.execute-api.ap-southeast-2.amazonaws.com/dev')
  }

  render(){
    return <div>henlo world</div>
  }
}

export default App;
