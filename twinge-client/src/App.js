import './App.css';
import { Header, Footer } from './components/Banners';
import { Lobby, Play } from './components/Screens'
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gameId: localStorage.getItem('gameId'),
      playerId: localStorage.getItem('playerId'),
    };
    this.sendMsg = this.sendMsg.bind(this);
  }

  componentDidMount() {
    this.ws = new WebSocket('wss://twinge-service.mcteamster.com');
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
          playerId: data?.gamestate?.players?.reduce((playerId, player) => { 
            return `${playerId}${ player.playerId || '' }` 
          }, ''),
        });
        // Store gameId and playerId
        localStorage.setItem('gameId', this.state.gameId);
        localStorage.setItem('playerId', this.state.playerId);
      }
    }
  }

  debounce(fn, delay) {
    let timer
      return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(()=>fn(...args), delay)
    }
  }

  async sendMsg(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  render() {
    if (this.state?.gamestate?.meta?.phase === 'closed') {
      localStorage.setItem('gameId', null);
      localStorage.setItem('playerId', null);
      this.setState({
        gameId: null,
        playerId: null,
        roomCode: null,
        gamestate: null,
      })
    } 
    
    if (!this.state?.gamestate?.meta?.phase || this.state?.gamestate?.meta?.phase === 'open') {
      return <div className='App'>
        <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)}></Header>
        <Lobby state={this.state} sendMsg={this.debounce(this.sendMsg, 200)}></Lobby>
        <Footer state={this.state}></Footer>
      </div>
    } else {
      return <div className='App'>
        <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)}></Header>
        <Play state={this.state} sendMsg={this.debounce(this.sendMsg, 200)}></Play>
        <Footer state={this.state}></Footer>
      </div>
    }
  }
}

export default App;
