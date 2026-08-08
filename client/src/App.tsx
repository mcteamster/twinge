import './App.css';
import { Header, Footer, Overlay, Modal, Notices } from './components/Banners';
import { About, Lobby, Play, Legal } from './components/Screens'
import { ConnectionStatus } from './components/ConnectionStatus';
import { AWS_REGIONS, ENDPOINTS, getRegionFromCode } from './constants/constants';
import { AudioContext, audioSettings } from './context/AudioContext';
import { LoadingContext } from './context/LoadingContext';
import { GameWebSocket } from './services/gameWebSocket';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Virgo2AWS } from '@mcteamster/virgo';
import type {
  Region,
  AudioSettings,
  OverlayState,
  ModalState,
  AppState,
  ServerMessage,
  AudioRefs,
} from './types';
function App(): React.ReactElement {
  const [region, setRegionState] = useState<Region | null>(localStorage.getItem('region') as Region | null);
  const [gameId, setGameId] = useState<string | null>(localStorage.getItem('gameId'));
  const [playerId, setPlayerId] = useState<string | null>(localStorage.getItem('playerId'));
  const [createTime, setCreateTime] = useState<string | null>(localStorage.getItem('createTime'));
  const [audio, setAudio] = useState<AudioSettings>(audioSettings.loud);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [overlay, setOverlay] = useState<OverlayState>({ message: '' });
  const [modal, setModal] = useState<ModalState>({ type: '' });
  const [gameData, setGameData] = useState<ServerMessage | null>(null);

  const wsRef = useRef<GameWebSocket | null>(null);
  const cursorRef = useRef<number>(0);
  const animationsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioRef = useRef<AudioRefs | null>(null);
  if (!audioRef.current) {
    audioRef.current = {
      ring: new Audio("/audio/ring.mp3"),
      buzz: new Audio("/audio/buzz.mp3"),
    };
  }
  // Ref mirrors for use inside closures
  const regionRef = useRef<Region | null>(region);
  const playerIdRef = useRef<string | null>(playerId);
  const gameIdRef = useRef<string | null>(gameId);

  useEffect(() => { regionRef.current = region; }, [region]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);

  const toggleMute = useCallback(() => {
    setAudio(a => a === audioSettings.loud ? audioSettings.silent : audioSettings.loud);
  }, []);

  const toggleQR = useCallback(() => {
    setModal(m => ({ type: m.type === 'qr' ? '' : 'qr' }));
  }, []);

  const clearSession = useCallback(() => {
    wsRef.current?.clearSession();
  }, []);

  const sendMsgRef = useRef<((msg: Record<string, unknown>) => void) | null>(null);
  const debouncedSendMsgRef = useRef<((msg: Record<string, unknown>) => void) | null>(null);

  function initializeWebSocket(autoJoin = true): void {
    if (wsRef.current) wsRef.current.disconnect();
    wsRef.current = new GameWebSocket({
      onConnectionStatus: (connected: boolean) => setIsConnected(connected),
      onGameState: (data: ServerMessage, isBackgroundSync = false) => {
        setLoading(false);
        gamestateHandler(data, isBackgroundSync);
      },
      onError: (data: ServerMessage) => {
        setLoading(false);
        console.error(data.message);
        if (data.code === 2) {
          wsRef.current?.clearSession();
          setOverlay({ message: '' });
        }
        errorHandler(data.code ?? 0);
      },
      onMaxReconnectReached: () => setOverlay({ message: '' }),
      onSessionCleared: () => setOverlay({ message: '' }),
    });
    wsRef.current.connect().then(() => {
      if (autoJoin) autoJoin_();
    }).catch(console.error);
  }

  function setRegion(newRegion: string, autoJoin?: boolean): void {
    console.debug('Region:', newRegion);
    const typedRegion = newRegion as Region;
    setRegionState(typedRegion);
    regionRef.current = typedRegion;
    localStorage.setItem('region', newRegion);
    initializeWebSocket(autoJoin ?? true);
  }

  async function autoJoin_(): Promise<void> {
    const session = wsRef.current?.loadSession();
    if (session) {
      console.debug('Restoring session:', session);
      setGameId(session.gameId);
      setPlayerId(session.playerId);
      gameIdRef.current = session.gameId;
      playerIdRef.current = session.playerId;
      setOverlay({ message: 'Reconnecting...' });
      wsRef.current?.setGameSession(session.gameId, session.playerId);
      sendMsg({ action: 'play', actionType: 'rejoin', gameId: session.gameId, playerId: session.playerId });
      return;
    }

    const createTimeStored = new Date(localStorage.getItem('createTime') ?? '');
    const currentTime = new Date();
    const path = window.location.pathname.slice(1);

    if (path.match(/^[A-Z]{4}$/i)) {
      setOverlay({ message: 'Connecting...' });
      sendMsg({ action: 'play', actionType: 'join', roomCode: path });
      window.history.replaceState({}, document.title, "/");
    } else if (createTimeStored > new Date(currentTime.setHours(currentTime.getHours() - 1))) {
      setOverlay({ message: 'Connecting...' });
      sendMsg({ action: 'play', actionType: 'join', gameId: gameIdRef.current, playerId: playerIdRef.current });
    } else if (localStorage.getItem('instance_id')) {
      console.debug(`Checking room info for: ${localStorage.getItem('instance_id')}`);
      const roomData = await (await fetch(`https://api.ohnomer.com/common/rooms/${localStorage.getItem('instance_id')}`)).json() as { room?: string };
      if (roomData.room) {
        if (getRegionFromCode(roomData.room) != regionRef.current) {
          setOverlay({ message: 'Connecting...' });
          setRegion(getRegionFromCode(roomData.room));
        } else {
          setOverlay({ message: 'Connecting...' });
          sendMsg({ action: 'play', actionType: 'join', roomCode: roomData.room });
        }
      }
    }
  }

  useEffect(() => {
    setOverlay({ message: '' });
    const path = window.location.pathname.slice(1);
    if (path.match(/^[A-Z]{4}$/i)) {
      setRegion(getRegionFromCode(path));
    } else if (localStorage.getItem('region')) {
      setRegion(localStorage.getItem('region')!);
    } else {
      const { closestRegion } = Virgo2AWS.getClosestRegion({ regions: Object.keys(AWS_REGIONS) });
      console.info(`Approximate Closest AWS Region: ${closestRegion}`);
      setRegion(AWS_REGIONS[closestRegion] || 'DEFAULT');
    }
    return () => { wsRef.current?.disconnect(); };
  }, []);


  function gamestateHandler(data: ServerMessage, isBackgroundSync = false): void {
    const gId = data.gameId;
    const pId = playerIdRef.current;

    if (gId && pId && (!wsRef.current?.gameId || !wsRef.current?.playerId)) {
      console.debug('📥 Setting up new game session', { gId, pId });
      wsRef.current?.setGameSession(gId, pId);
    }

    if (data?.gamestate?.meta?.phase === 'won' || data?.gamestate?.meta?.phase === 'lost') {
      console.debug('🎮 Game ended, clearing session');
      wsRef.current?.clearSession();
    }

    const currentPlayer = data?.gamestate?.players?.find(p => p.playerId === playerIdRef.current);
    if (playerIdRef.current && data?.gamestate?.players && !currentPlayer) {
      console.debug('🎮 Player no longer in game, clearing session');
      wsRef.current?.clearSession();
    }

    if (data.roomCode && data?.gamestate?.meta?.phase == 'open' && data?.gamestate?.players?.length == 1) {
      if (localStorage.getItem('instance_id')) {
        fetch(`https://api.ohnomer.com/common/rooms/${localStorage.getItem('instance_id')}/${data.roomCode}?game=twinge`, { method: "PUT" });
      } else {
        fetch(`https://api.ohnomer.com/common/rooms/${data.roomCode}/${data.roomCode}?game=twinge`, { method: "PUT" });
      }
    }

    if (data.gamestate?.gameId) localStorage.setItem('gameId', data.gamestate.gameId);
    if (data.playerId) localStorage.setItem('playerId', data.playerId);
    localStorage.setItem('createTime', new Date().toISOString());

    if (!isBackgroundSync && (data?.gamestate?.public?.pile?.length ?? 0) > 0) {
      const pile = data.gamestate!.public.pile;
      const latestCard = pile[pile.length - 1];
      if (latestCard.missed) {
        audioRef.current!.buzz.play();
      } else {
        audioRef.current!.ring.play();
      }
    }

    const pile = data?.gamestate?.public?.pile ?? [];
    if ((pile.length > 0 && !cursorRef.current) || (pile[cursorRef.current - 1]?.round !== data?.gamestate?.meta?.round)) {
      cursorRef.current = 1 + pile.map((card) => card.round).lastIndexOf((data?.gamestate?.meta?.round ?? 1) - 1);
      if (cursorRef.current < 0) cursorRef.current = 0;
    }

    if (pile.length > cursorRef.current) {
      for (let i = cursorRef.current; i < pile.length; i++) {
        const game: ServerMessage = JSON.parse(JSON.stringify(data)) as ServerMessage;
        game.gamestate!.public.pile = pile.slice(0, i + 1);
        const tempHand: number[] = [];
        pile.slice(i + 1).forEach((card) => {
          const player = game.gamestate!.players[card.playerIndex ?? 0];
          if (player) player.handSize++;
          if (player?.playerId === playerIdRef.current) tempHand.push(card.card);
        });
        const activePlayer = game.gamestate!.players.find((player) => player.playerId === playerIdRef.current);
        if (activePlayer) activePlayer.hand.unshift(...tempHand);
        if (i !== (pile.length - 1) && (data.gamestate?.meta.phase === 'won' || data.gamestate?.meta.phase === 'lost')) {
          game.gamestate!.meta.phase = 'playing';
        }
        animationsRef.current.push(setTimeout(() => {
          const newPlayerId = game?.gamestate?.players?.reduce((acc, player) => `${acc}${player.playerId || ''}`, '');
          setOverlay({ message: '' });
          setGameData({ ...game, playerId: newPlayerId });
          setGameId(game.gamestate?.gameId ?? gameIdRef.current);
          setPlayerId(newPlayerId ?? null);
          playerIdRef.current = newPlayerId ?? null;
        }, 100 * (i - cursorRef.current)));
      }
      cursorRef.current = pile.length;
    } else {
      animationsRef.current.forEach(clearTimeout);
      animationsRef.current = [];
      const newPlayerId = data?.gamestate?.players?.reduce((acc, player) => `${acc}${player.playerId || ''}`, '');
      setOverlay({ message: '' });
      setGameData({ ...data, playerId: newPlayerId });
      setGameId(data.gamestate?.gameId ?? gameIdRef.current);
      setPlayerId(newPlayerId ?? null);
      playerIdRef.current = newPlayerId ?? null;
    }

    localStorage.setItem('gameId', gameIdRef.current ?? '');
    localStorage.setItem('playerId', playerIdRef.current ?? '');
  }


  function errorHandler(error: number): void {
    const handlers: Record<number, () => void> = {
      2: () => {
        try {
          const input = document.getElementById('inputBox') as HTMLInputElement | null;
          if (input) {
            input.style.borderColor = 'red';
            setTimeout(() => {
              const input = document.getElementById('inputBox') as HTMLInputElement | null;
              if (input) {
                input.value = '';
                input.style.borderColor = 'lightgrey';
              }
            }, 250);
          }
        } catch (err) {
          console.error(err);
        }
        localStorage.removeItem('playerId');
        localStorage.removeItem('createTime');
        setGameId(null);
        setPlayerId(null);
        setCreateTime(null);
        setGameData(null);
      },
    };
    handlers[error] && handlers[error]();
  }

  function sendMsg(msg: Record<string, unknown>): void {
    if (msg['roomCode'] && getRegionFromCode(msg['roomCode'] as string) != regionRef.current) {
      setRegion(getRegionFromCode(msg['roomCode'] as string));
      setTimeout(() => sendMsg(msg), 0);
      return;
    }
    if (!wsRef.current) {
      console.error('WebSocket not initialized');
      return;
    }
    setLoading(true);
    wsRef.current.send(msg);
  }

  // Keep sendMsg and debounced version in refs so they're stable across renders
  sendMsgRef.current = sendMsg;
  if (!debouncedSendMsgRef.current) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    debouncedSendMsgRef.current = (...args: [Record<string, unknown>]) => {
      clearTimeout(timer);
      timer = setTimeout(() => sendMsgRef.current!(...args), 50);
    };
  }

  // Build a state-compatible object for child components that expect the old `state` prop shape
  const state: AppState = {
    region,
    gameId: gameData?.gamestate?.gameId ?? gameId,
    playerId,
    createTime,
    audio,
    loading,
    isConnected,
    overlay,
    modal,
    ...(gameData ?? {}),
  };

  const debouncedSendMsg = debouncedSendMsgRef.current!;

  if (navigator.userAgent.match(/FBAN|FBAV|Instagram/i)) {
    console.warn('In-app browser detected');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', height: '60vh', width: 'calc(100vw - 2em)', padding: '1em', fontSize: '1.5em' }}>
        <h1>😣 twinge</h1>
        please open this page in your primary browser for the best gameplay experience
      </div>
    );
  } else if (window.location.pathname.match('/about')) {
    return <div className='App'><About></About></div>;
  } else if (window.location.pathname.match('/legal')) {
    return <div className='App'><Legal></Legal></div>;
  } else if (!state?.gamestate?.meta?.phase || state?.gamestate?.meta?.phase === 'open' || state?.gamestate?.meta?.phase === 'closed') {
    return <div className='App unselectable'>
      <AudioContext.Provider value={audio}>
        <LoadingContext.Provider value={loading}>
          <Header state={state} sendMsg={debouncedSendMsg} toggleMute={toggleMute} toggleQR={toggleQR} region={region} setRegion={setRegion} clearSession={clearSession}></Header>
          <Lobby state={state} sendMsg={debouncedSendMsg}></Lobby>
          <Footer state={state}></Footer>
          <Modal state={state} toggleQR={toggleQR}></Modal>
          <Overlay overlay={overlay}></Overlay>
          <Notices region={region} />
          <ConnectionStatus isConnected={isConnected} />
        </LoadingContext.Provider>
      </AudioContext.Provider>
    </div>;
  } else {
    return <div className='App unselectable'>
      <AudioContext.Provider value={audio}>
        <LoadingContext.Provider value={loading}>
          <Header state={state} sendMsg={debouncedSendMsg} toggleMute={toggleMute} toggleQR={toggleQR} region={region} setRegion={setRegion} clearSession={clearSession}></Header>
          <Play state={state} sendMsg={debouncedSendMsg} audio={audioRef.current!}></Play>
          <Footer state={state}></Footer>
          <Modal state={state} toggleQR={toggleQR}></Modal>
          <Overlay state={state} overlay={overlay}></Overlay>
          <Notices region={region} />
          <ConnectionStatus isConnected={isConnected} />
        </LoadingContext.Provider>
      </AudioContext.Provider>
    </div>;
  }
}

export default App;
