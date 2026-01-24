import './App.css';
import { Header, Footer, Overlay, Modal, Notices } from './components/Banners';
import { About, Lobby, Play, Legal } from './components/Screens'
import { ConnectionStatus } from './components/ConnectionStatus';
import { AWS_REGIONS, ENDPOINTS, getRegionFromCode } from './constants/constants';
import { AudioContext, audioSettings } from './context/AudioContext';
import { LoadingContext } from './context/LoadingContext';
import { GameWebSocket } from './services/gameWebSocket';
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
      loading: false,
      isConnected: false,
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
    this.ws = null;
    
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
    this.setLoading = (loading) => {
      this.setState(state => ({
        ...state,
        loading
      }));
    }
    this.setRegion = (region, autoJoin) => {
      console.debug('Region:', region)
      this.setState(state => ({
        ...state,
        region
      }));
      localStorage.setItem('region', region);
      this.initializeWebSocket(autoJoin);
    }
    
    this.initializeWebSocket = (autoJoin = true) => {
      if (this.ws) {
        this.ws.disconnect();
      }
      
      this.ws = new GameWebSocket({
        onConnectionStatus: (isConnected) => {
          this.setState(state => ({
            ...state,
            isConnected
          }));
        },
        onGameState: (data) => {
          this.setLoading(false);
          this.gamestateHandler(data);
        },
        onError: (data) => {
          this.setLoading(false);
          console.error(data.message);
          this.errorHandler(data.code);
        },
        onMaxReconnectReached: () => {
          this.setState(state => ({
            ...state,
            overlay: { message: 'Connection lost. Please refresh the page.' }
          }));
        }
      });
      
      this.ws.connect().then(() => {
        if (autoJoin) {
          this.autoJoin();
        }
      }).catch(console.error);
    }
  }
  
  componentDidMount() {
    this.setState(state => ({ ...state, overlay: { message: '' } }));
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
  }

  autoJoin = async () => {
    // Try to restore session first
    const session = this.ws?.loadSession();
    if (session) {
      console.debug('Restoring session:', session);
      this.setState(state => ({ 
        ...state, 
        gameId: session.gameId, 
        playerId: session.playerId,
        overlay: { message: 'Reconnecting...' } 
      }));
      this.ws.setGameSession(session.gameId, session.playerId);
      this.sendMsg({ 
        action: 'play', 
        actionType: 'rejoin', 
        gameId: session.gameId, 
        playerId: session.playerId 
      });
      return;
    }

    // Join from Path, Memory, or Discord Channel's latest session
    let createTime = new Date(localStorage.getItem('createTime'));
    let currentTime = new Date();
    let path = window.location.pathname.slice(1);

    if (path.match(/^[A-Z]{4}$/i)) {
      this.setState(state => ({ ...state, overlay: { message: 'Connecting...' } }));
      this.sendMsg({ action: 'play', actionType: 'join', roomCode: path });
      window.history.replaceState({}, document.title, "/");
    } else if (createTime > currentTime.setHours(currentTime.getHours() - 1)) {
      this.setState(state => ({ ...state, overlay: { message: 'Connecting...' } }));
      this.sendMsg({ action: 'play', actionType: 'join', gameId: this.state.gameId, playerId: this.state.playerId });
    } else if (localStorage.getItem('instance_id')) {
      console.debug(`Checking room info for: ${localStorage.getItem('instance_id')}`)
      const roomData = await (await fetch(`https://api.mcteamster.com/common/rooms/${localStorage.getItem('instance_id')}`)).json()
      if (roomData.room) {
        if (getRegionFromCode(roomData.room) != this.state.region) {
          // Handle Region Mismatch
          this.setState(state => ({ ...state, overlay: { message: 'Connecting...' } }));
          this.setRegion(getRegionFromCode(roomData.room));
        } else {
          this.setState(state => ({ ...state, overlay: { message: 'Connecting...' } }));
          this.sendMsg({ action: 'play', actionType: 'join', roomCode: roomData.room });
        }
      }
    }
  };

  messageHandler = (msg) => {
    // This method is now handled by the WebSocket service callbacks
    // Keeping for compatibility but functionality moved to callbacks
  }

  gamestateHandler = (data) => {
    // Publish room code upon creation
    if (data.roomCode && data?.gamestate?.meta?.phase == 'open' && data?.gamestate?.players?.length == 1) {
      // Save session when game is created/joined
      if (data.gamestate.gameId && data.playerId) {
        this.ws?.setGameSession(data.gamestate.gameId, data.playerId);
        this.ws?.startSyncPolling();
      }
      
      // In Discord
      if (localStorage.getItem('instance_id')) {
        fetch(`https://api.mcteamster.com/common/rooms/${localStorage.getItem('instance_id')}/${data.roomCode}?game=twinge`, {
          method: "PUT",
        })
      } else {
        fetch(`https://api.mcteamster.com/common/rooms/${data.roomCode}/${data.roomCode}?game=twinge`, {
          method: "PUT",
        })
      }
    }

    // Store game session data
    if (data.gamestate?.gameId) {
      localStorage.setItem('gameId', data.gamestate.gameId);
    }
    if (data.playerId) {
      localStorage.setItem('playerId', data.playerId);
    }
    localStorage.setItem('createTime', new Date().toISOString());

    // Update state
    this.setState(state => ({
      ...state,
      ...data,
      overlay: { message: '' }
    }));

    // Handle audio cues
    if (data?.gamestate?.public?.pile?.length > 0) {
      let latestCard = data.gamestate.public.pile[data.gamestate.public.pile.length - 1];
      if (latestCard.missed) {
        this.audio.buzz.play();
      } else {
        this.audio.ring.play();
      }
    }
  }
        })
      }
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
    // Handle Region Mismatch
    if (msg.roomCode && getRegionFromCode(msg.roomCode) != this.state.region) {
      this.setRegion(getRegionFromCode(msg.roomCode));
      setTimeout(() => {
        this.sendMsg(msg)
      }, 0)
      return;
    }
    
    if (!this.ws) {
      console.error('WebSocket not initialized');
      return;
    }
    
    this.setLoading(true);
    this.ws.send(msg);
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
          <LoadingContext.Provider value={this.state.loading}>
            <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 50)} toggleMute={this.toggleMute} toggleQR={this.toggleQR} region={this.state.region} setRegion={this.setRegion}></Header>
            <Lobby state={this.state} sendMsg={this.debounce(this.sendMsg, 50)} ></Lobby>
            <Footer state={this.state}></Footer>
            <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
            <Overlay overlay={this.state.overlay}></Overlay>
            <Notices region={this.state.region} />
            <ConnectionStatus isConnected={this.state.isConnected} />
          </LoadingContext.Provider>
        </AudioContext.Provider>
      </div>
    } else {
      return <div className='App unselectable'>
        <AudioContext.Provider value={this.state.audio}>
          <LoadingContext.Provider value={this.state.loading}>
            <Header state={this.state} sendMsg={this.debounce(this.sendMsg, 50)} toggleMute={this.toggleMute} toggleQR={this.toggleQR} region={this.state.region} setRegion={this.setRegion}></Header>
            <Play state={this.state} sendMsg={this.debounce(this.sendMsg, 50)} audio={this.audio}></Play>
            <Footer state={this.state}></Footer>
            <Modal state={this.state} toggleQR={this.toggleQR}></Modal>
            <Overlay state={this.state} overlay={this.state.overlay}></Overlay>
            <Notices region={this.state.region} />
            <ConnectionStatus isConnected={this.state.isConnected} />
          </LoadingContext.Provider>
        </AudioContext.Provider>
      </div>
    }
  }
}

export default App;
