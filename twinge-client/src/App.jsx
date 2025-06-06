import './App.css';
import { Header, Footer, Overlay, Modal } from './components/Banners';
import { About, Lobby, Play } from './components/Screens'
import { AudioContext, audioSettings } from './context/AudioContext';
import React from 'react';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gameId: localStorage.getItem('gameId'),
      playerId: localStorage.getItem('playerId'),
      createTime: localStorage.getItem('createTime'),
      audio: audioSettings.loud,
      overlay: {
        message: '',
      },
      modal: {
        type: '',
      }
    };
    this.cursor = 0;
    this.animations = [];
    this.audio = {
      ring: new Audio("/audio/ring.mp3"),
      buzz: new Audio("/audio/buzz.mp3"),
    }
    this.toggleMute = () => {
      this.setState(state => ({
        audio: state.audio === audioSettings.loud ? audioSettings.silent : audioSettings.loud,
      }));
    }
    this.toggleQR = () => {
      this.setState(state => ({
        modal: {
          type: state.modal.type === 'qr' ? '' : 'qr',
        }
      }));
    }
  }

  componentDidMount() {
    this.setState({ overlay: { message: '' } });
    this.ws = new WebSocket(import.meta.env.VITE_SERVICE_URL);
    this.ws.onopen = this.autoJoin;
    this.ws.onmessage = this.messageHandler;

    setInterval(() => {
      if (this.state.gameId && this.state.playerId) {
        this.sendMsg({ action: 'play', actionType: 'refresh', gameId: this.state.gameId, playerId: this.state.playerId })
      }
    }, 360000);
  }

  autoJoin = async () => {
    // Join from path if supplied, otherwise join from memory
    let createTime = new Date(localStorage.getItem('createTime'));
    let currentTime = new Date();
    let path = window.location.pathname.slice(1);

    if (path.match(/^[A-Z]{4}$/i)) {
      this.setState({ overlay: { message: 'Connecting...' } });
      this.sendMsg({ action: 'play', actionType: 'join', roomCode: path });
      window.history.replaceState({}, document.title, "/");
    } else if (createTime > currentTime.setHours(currentTime.getHours() - 1)) {
      this.setState({ overlay: { message: 'Connecting...' } });
      this.sendMsg({ action: 'play', actionType: 'join', gameId: this.state.gameId, playerId: this.state.playerId });
    }
  };

  messageHandler = (msg) => {
    let data = JSON.parse(msg.data);
    // Websocket Acknowlegements
    if (data.code === 0 && data.message === 'ack') {
      console.log(new Date().toISOString());
    }
    // Handle Errors
    else if (data.code) {
      this.setState({ overlay: { message: '' } });
      console.error(data.message);
      this.errorHandler(data.code);
    }
    // Handle Gamestate Changes
    else {
      this.gamestateHandler(data);
    }
  }

  gamestateHandler = (data) => {
    if ((data?.gamestate?.public?.pile && !this.cursor) || (data?.gamestate?.public?.pile[this?.cursor - 1]?.round !== data?.gamestate?.meta?.round)) {
      this.cursor = 1 + data.gamestate.public.pile.map((card) => { return card.round }).lastIndexOf(data.gamestate.meta.round - 1);
      if (this.cursor < 0) {
        this.cursor = 0;
      }
    }

    if ((data?.gamestate?.public?.pile.length > this.cursor)) {
      for (let i = this.cursor; i < (data?.gamestate?.public?.pile.length); i++) {
        let game = JSON.parse(JSON.stringify(data));
        game.gamestate.public.pile = data.gamestate.public.pile.slice(0, i + 1);
        let tempHand = [];
        data.gamestate.public.pile.slice(i + 1).forEach((card) => {
          let player = game.gamestate.players[card.playerIndex];
          player && player.handSize++;
          player?.playerId === this.state.playerId && tempHand.push(card.card);
        })
        let activePlayer = game.gamestate.players.find((player) => { return player.playerId === this.state.playerId });
        if (activePlayer) {
          activePlayer.hand.unshift(...tempHand);
        }
        if (i !== (data?.gamestate?.public?.pile.length - 1) && (data.gamestate.meta.phase === 'won' || data.gamestate.meta.phase === 'lost')) {
          game.gamestate.meta.phase = 'playing';
        }
        this.animations.push(setTimeout(() => {
          this.setState({
            overlay: { message: '' },
            ...game,
            playerId: game?.gamestate?.players?.reduce((playerId, player) => {
              return `${playerId}${player.playerId || ''}`
            }, ''),
          });
        }, 100 * (i - this.cursor)));
      }
      this.cursor = data?.gamestate?.public?.pile.length;
    } else {
      this.animations.forEach((animation) => {
        clearTimeout(animation);
      })
      this.setState({
        overlay: { message: '' },
        ...data,
        playerId: data?.gamestate?.players?.reduce((playerId, player) => {
          return `${playerId}${player.playerId || ''}`
        }, ''),
      });
    }

    // Store game metadata
    localStorage.setItem('gameId', this.state.gameId);
    localStorage.setItem('playerId', this.state.playerId);
    localStorage.setItem('createTime', this.state.createTime);
  }

  errorHandler = async (error) => {
    let errorHandlers = {
      2: () => {
        try {
          let input = document.getElementById('inputBox');
          input.style.borderColor = 'red';
          setTimeout(() => {
            input.value = '';
            input.style.borderColor = 'lightgrey';
          }, 250);
        } catch (err) {
          console.error(err);
        }
        localStorage.setItem('gameId', null);
        localStorage.setItem('playerId', null);
        localStorage.setItem('createTime', null);
        this.setState({
          gameId: null,
          playerId: null,
          createTime: null,
          roomCode: null,
          gamestate: null,
          stateHash: null,
        });
      },
    };
    errorHandlers[error] && errorHandlers[error]();
  }

  debounce = (fn, delay) => {
    let timer
    return function (...args) {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }
  }

  sendMsg = async (msg) => {
    if (!this.ws || this.ws.readyState !== 1) {
      this.setState({ overlay: { message: 'Disconnected...' } });
      this.ws = new WebSocket(import.meta.env.VITE_SERVICE_URL);
      this.ws.onopen = this.autoJoin;
      this.ws.onmessage = this.messageHandler;
    } else {
      this.ws.send(JSON.stringify(msg));
    }
  }

  render() {
    if (window.location.pathname.match('/about')) {
      return <div className='App'>
        <About></About>
      </div>
    } else if (!this.state?.gamestate?.meta?.phase || this.state?.gamestate?.meta?.phase === 'open' || this.state?.gamestate?.meta?.phase === 'closed') {
      return <div className='App unselectable'>
        <AudioContext.Provider value={this.state.audio}>
          <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} toggleMute={this.toggleMute} toggleQR={this.toggleQR}></Header>
          <Lobby state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} ></Lobby>
          <Footer state={this.state}></Footer>
          <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
          <Overlay overlay={this.state.overlay}></Overlay>
        </AudioContext.Provider>
      </div>
    } else {
      return <div className='App unselectable'>
        <AudioContext.Provider value={this.state.audio}>
          <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} toggleMute={this.toggleMute} toggleQR={this.toggleQR}></Header>
          <Play state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} audio={this.audio}></Play>
          <Footer state={this.state}></Footer>
          <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
          <Overlay overlay={this.state.overlay}></Overlay>
        </AudioContext.Provider>
      </div>
    }
  }
}

export default App;
