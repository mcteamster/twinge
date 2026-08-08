import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import { FLAGS } from '../constants/constants';
import { discordSdk } from '../constants/discord';
import type { AppState, Region, OverlayState } from '../types';

type SendMsg = (msg: Record<string, unknown>) => void;

interface NoticesProps {
  region: Region | null;
}

interface RegionSelectProps {
  region: Region | null;
  setRegion: (region: string, autoJoin?: boolean) => void;
}

interface HeaderProps {
  state: AppState;
  sendMsg: SendMsg;
  toggleMute: () => void;
  toggleQR: () => void;
  region: Region | null;
  setRegion: (region: string, autoJoin?: boolean) => void;
  clearSession: () => void;
}

interface FooterProps {
  state: AppState;
}

interface OverlayProps {
  overlay: OverlayState;
  state?: AppState;
}

interface ModalProps {
  state: AppState;
  toggleQR: () => void;
}

function Notices({ region }: NoticesProps): React.ReactElement {
  const [noticeMessage, setNoticeMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://api.ohnomer.com/common/notices/twinge', { signal: controller.signal })
      .then(r => r.json())
      .then((data: { messages?: Record<string, string> }) => {
        setNoticeMessage(data.messages?.[region ?? ''] ?? data.messages?.['ALL'] ?? '');
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') console.error(err); });
    return () => controller.abort();
  }, [region]);

  return <div className='Notice centered'>{noticeMessage}</div>;
}

function RegionSelect({ region, setRegion }: RegionSelectProps): React.ReactElement {
  const [regionSelect, setRegionSelect] = useState(false);

  return <>
    {regionSelect ?
      <div className='Overlay centered' style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="region-list" style={{
          width: '15em', display: 'flex', flexDirection: 'row',
          alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.4em',
        }}>
          {Object.entries(FLAGS).reverse().map(([r, flag]) => (
            <div key={r} onClick={() => { setRegionSelect(false); setRegion(r, false); }}
              style={{
                width: '4em', height: '4em', margin: '0.25em', padding: '0.25em',
                backgroundColor: region == r ? 'skyblue' : '#ddd',
                borderRadius: '0.5em', display: 'flex', textAlign: 'center',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              {flag}<br></br>{r}
            </div>
          ))}
        </div>
      </div> :
      <div onClick={() => setRegionSelect(true)}>
        {FLAGS[region ?? ''] || '🌏'}
      </div>
    }
  </>
}

function Header({ state, sendMsg, toggleMute, toggleQR, region, setRegion, clearSession }: HeaderProps): React.ReactElement {
  return <div className='Header' style={(discordSdk && ((window.innerWidth / window.innerHeight) < 1)) ? { height: '4.75em', alignItems: 'flex-end', paddingBottom: '0.5em' } : {}}>
    <div id='title' style={{ width: '4em', fontSize: '1.25em' }} onClick={() => { window.location.pathname = 'about'; }}>
      twinge
    </div>
    <div id='roomCode' style={{ width: '5em' }} onClick={() => {
      toggleQR();
      const code = document.getElementById('roomCode');
      try {
        window.navigator.clipboard.writeText(`https://twinge.mcteamster.com/${state.roomCode}`);
      } catch (err) {
        console.error("Fallback Copy Method");
        if (code instanceof HTMLInputElement) {
          code.select();
          code.value = `https://twinge.mcteamster.com/${state.roomCode}`;
          code.setSelectionRange(0, 99999);
          document.execCommand("copy");
          code.value = state.roomCode ?? '';
        }
      }
    }}>
      {state.roomCode ? `${state.roomCode}` : ''}
    </div>
    <div id='functions' style={{ width: '5em' }}>
      <div id='mute' onClick={() => toggleMute()}>
        {state?.gamestate?.meta?.phase === 'playing' && (state?.audio.mute ? '🔇' : '🔊')}
      </div>
      {state.roomCode && state?.gameId ?
        <div id='exit' onClick={() => {
          sendMsg({ action: 'play', actionType: 'leave', gameId: state.gameId, playerId: state.playerId, stateHash: state.stateHash });
          if (clearSession) clearSession();
        }}>
          ❌
        </div>
        :
        <RegionSelect region={region} setRegion={setRegion} />
      }
    </div>
  </div>
}

function Footer({ state }: FooterProps): React.ReactElement {
  return <div className='Footer'>
    <div>GAMEID: {state.gameId}, PLAYERID: {state.playerId}</div>
  </div>
}

function Overlay({ overlay, state }: OverlayProps): React.ReactElement {
  let message: React.ReactNode = <div>Please Adjust Screen</div>;
  if (overlay.message) {
    message = <>{overlay.message}</>;
  } else if (state && ((state?.gamestate?.public?.pile.length ?? 0) > 0 || state?.gamestate?.meta?.round == 1)) {
    const pile = state?.gamestate?.public?.pile;
    let latestCard: number = 0;
    if (pile && (pile[pile.length - 1]?.round == state?.gamestate?.meta?.round)) {
      latestCard = pile[pile.length - 1]?.card ?? 0;
    }
    const activePlayer = state?.gamestate?.players?.find((player) => player.playerId === state.playerId);
    let lowestHand: React.ReactNode = <></>;
    if (activePlayer?.hand?.[0]) {
      lowestHand = <div style={{ fontSize: '0.75em' }}>✋&nbsp;{activePlayer.hand[0]}</div>;
    }
    message = <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
      <div style={{ fontSize: '1.5em' }}>{latestCard}</div>
      {lowestHand}
    </div>;
  }

  return <div className='Overlay centered' style={overlay.message !== '' ? { display: 'flex' } : { display: 'none' }}>
    {message}
  </div>
}

function Modal({ state, toggleQR }: ModalProps): React.ReactElement {
  function copyToClipboard(): void {
    const code = document.getElementById('roomUrl');
    if (!code) return;
    code.classList.remove('clickedLink');
    code.classList.add('clickedLink');
    setTimeout(() => {
      const code = document.getElementById('roomUrl');
      if (code) code.classList.remove('clickedLink');
    }, 250);
    try {
      window.navigator.clipboard.writeText(`https://twinge.mcteamster.com/${state.roomCode}`);
    } catch (err) {
      console.error("Fallback Copy Method");
      if (code instanceof HTMLInputElement) {
        code.select();
        code.value = `https://twinge.mcteamster.com/${state.roomCode}`;
        code.setSelectionRange(0, 99999);
        document.execCommand("copy");
        code.value = state.roomCode ?? '';
      }
    }
  }

  return <div className='Modal centered' style={state.modal.type !== '' ? { display: 'flex' } : { display: 'none' }}>
    {state.modal.type === 'qr' &&
      <div className='centered' style={{ flexDirection: 'column' }}>
        <div id='roomUrl' onClick={copyToClipboard} style={{ fontSize: "0.75em", padding: '1em' }}>
          Tap to Copy<br></br>
          <u>{`twinge.mcteamster.com/${state.roomCode}`}</u>
        </div>
        <QRCode value={`https://twinge.mcteamster.com/${state.roomCode ?? ''}`} style={{ padding: '1em' }}></QRCode>
        <div style={{ fontSize: '3em' }} onClick={toggleQR}>🔙</div>
      </div>
    }
  </div>
}

export { Header, Footer, Overlay, Modal, Notices }
