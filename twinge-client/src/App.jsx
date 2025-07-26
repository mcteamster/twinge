import './App.css';
import { Header, Footer, Overlay, Modal, Notices } from './components/Banners';
import { About, Lobby, Play, Legal } from './components/Screens'
import { AWS_REGIONS, ENDPOINTS, getRegionFromCode } from './constants/constants';
import { AudioContext, audioSettings } from './context/AudioContext';
import React from 'react';
import { Virgo2AWS } from '@mcteamster/virgo';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      region: localStorage.getItem('region'),
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
    this.setRegion = (region, autoJoin) => {
      console.debug('Region:', region)
      this.setState((state) => {
        state.region = region
        return state
      });
      localStorage.setItem('region', region);
      let ws = new WebSocket(ENDPOINTS[region])
      ws.onopen = autoJoin != false ? this.autoJoin : () => {};
      ws.onmessage = this.messageHandler;
      this.ws = ws;
    }
  }
  
  componentDidMount() {
    this.setState({ overlay: { message: '' } });
    let path = window.location.pathname.slice(1);
    if (path.match(/^[A-Z]{4}$/i)) {
      this.setRegion(getRegionFromCode(path));
    } else if (localStorage.getItem('region')) {
      this.setRegion(localStorage.getItem('region'));
    } else {
      // Try to approximate the closest region using https://github.com/mcteamster/virgo
      const { closestRegion } = Virgo2AWS.getClosestRegion({ regions: Object.keys(AWS_REGIONS) });
      console.info(`Approximate Closest AWS Region: ${closestRegion}`)
      if (AWS_REGIONS[closestRegion]) {
        this.setRegion(AWS_REGIONS[closestRegion])
      } else {
        this.setRegion('DEFAULT')
      }
    }
    
    setInterval(() => {
      if (this.state.gameId && this.state.playerId) {
        console.debug('Syncing State')
        this.sendMsg({ action: 'play', actionType: 'refresh', gameId: this.state.gameId, playerId: this.state.playerId })
      }
    }, 30000);
  }

  autoJoin = async () => {
    // Join from Path, Memory, or Discord Channel's latest session
    let createTime = new Date(localStorage.getItem('createTime'));
    console.debug(createTime)
    let currentTime = new Date();
    let path = window.location.pathname.slice(1);

    if (path.match(/^[A-Z]{4}$/i)) {
      this.setState({ overlay: { message: 'Connecting...' } });
      this.sendMsg({ action: 'play', actionType: 'join', roomCode: path });
      window.history.replaceState({}, document.title, "/");
    } else if (createTime > currentTime.setHours(currentTime.getHours() - 1)) {
      this.setState({ overlay: { message: 'Connecting...' } });
      this.sendMsg({ action: 'play', actionType: 'join', gameId: this.state.gameId, playerId: this.state.playerId });
    } else if (localStorage.getItem('instance_id')) {
      console.debug(`Checking room info for: ${localStorage.getItem('instance_id')}`)
      const roomData = await (await fetch(`https://api.mcteamster.com/common/rooms/${localStorage.getItem('instance_id')}`)).json()
      if (roomData.room) {
        if (getRegionFromCode(roomData.room) != this.state.region) {
          // Handle Region Mismatch
          this.setState({ overlay: { message: 'Connecting...' } });
          this.setRegion(getRegionFromCode(roomData.room));
        } else {
          this.setState({ overlay: { message: 'Connecting...' } });
          this.sendMsg({ action: 'play', actionType: 'join', roomCode: roomData.room });
        }
      }
    }
  };

  messageHandler = (msg) => {
    let data = JSON.parse(msg.data);
    // Websocket Acknowlegements
    if (data.code === 0 && data.message === 'ack') {
      console.debug(new Date().toISOString());
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
    // Publish room code upon creation in Discord
    if (localStorage.getItem('instance_id') && data.roomCode && data?.gamestate?.meta?.phase == 'open' && data?.gamestate?.players?.length == 1) {
      fetch(`https://api.mcteamster.com/common/rooms/${localStorage.getItem('instance_id')}/${data.roomCode}?game=twinge`, {
        method: "PUT",
      })
    }

    // Update Cursor 
    if ((data?.gamestate?.public?.pile && !this.cursor) || (data?.gamestate?.public?.pile[this?.cursor - 1]?.round !== data?.gamestate?.meta?.round)) {
      this.cursor = 1 + data.gamestate.public.pile.map((card) => { return card.round }).lastIndexOf(data.gamestate.meta.round - 1);
      if (this.cursor < 0) {
        this.cursor = 0;
      }
    }

    // Animations if gamestate has progressed
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
    if (msg.roomCode && getRegionFromCode(msg.roomCode) != this.state.region) {
      // Handle Region Mismatch
      this.setRegion(getRegionFromCode(msg.roomCode));
      setTimeout(()=> {
        this.sendMsg(msg)
      }, 0)
    } else if (this?.ws?.readyState == 0) {
      // Retry every second until connected
      this.setState({ ...this.state, overlay: { message: 'Connecting...' } });
      setTimeout(()=> {
        this.sendMsg(msg)
      }, 1000)
    } else if (!this.ws || this.ws.readyState !== 1) {
      this.setState({ overlay: { message: 'Disconnected. Please Try Refreshing.' } });
      this.setRegion(this.state.region)
    } else {
      this.ws.send(JSON.stringify(msg));
    }
  }

  render() {
    // Check for In-App Browsers
    if (navigator.userAgent.match(/FBAN|FBAV|Instagram/i)) {
      console.warn('In-app browser detected');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', height: '60vh', width: 'calc(100vw - 2em)', padding: '1em', fontSize: '1.5em' }}>
          <h1>😣 twinge</h1>
          please open this page in your primary browser for the best gameplay experience
        </div>
      )
    } else if (window.location.pathname.match('/about')) {
      return <div className='App'>
        <About></About>
      </div>
    } else if (window.location.pathname.match('/legal')) {
      return <div className='App'>
        <Legal></Legal>
      </div>
    } else if ((!this.state?.gamestate?.meta?.phase || this.state?.gamestate?.meta?.phase === 'open' || this.state?.gamestate?.meta?.phase === 'closed')) {
      return <div className='App unselectable'>
        <AudioContext.Provider value={this.state.audio}>
          <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} toggleMute={this.toggleMute} toggleQR={this.toggleQR} region={this.state.region} setRegion={this.setRegion}></Header>
          <Lobby state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} ></Lobby>
          <Footer state={this.state}></Footer>
          <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
          <Overlay overlay={this.state.overlay}></Overlay>
          <Notices region={this.state.region} />
        </AudioContext.Provider>
      </div>
    } else {
      return <div className='App unselectable'>
        <AudioContext.Provider value={this.state.audio}>
          <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} toggleMute={this.toggleMute} toggleQR={this.toggleQR} region={this.state.region} setRegion={this.setRegion}></Header>
          <Play state={this.state} sendMsg={this.debounce(this.sendMsg, 200)} audio={this.audio}></Play>
          <Footer state={this.state}></Footer>
          <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
          <Overlay state={this.state} overlay={this.state.overlay}></Overlay>
          <Notices region={this.state.region} />
        </AudioContext.Provider>
      </div>
    }
  }
}

export default App;
