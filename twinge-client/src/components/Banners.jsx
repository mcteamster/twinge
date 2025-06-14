import React from 'react';
import QRCode from "react-qr-code";
import { FLAGS } from '../constants/constants';

class RegionSelect extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      regionSelect: false,
    };
  }

  render() {
    return <>
      { this.state.regionSelect ?
        <div className='Overlay centered' style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="region-list" style={{
            width: '15em',
            display: this.state.regionSelect ? 'flex' : 'none',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontSize: '0.4em',
          }}>
            {Object.entries(FLAGS).reverse().map(([region, flag]) => (
              <div
                key={region}
                onClick={() => {
                  this.setState({ regionSelect: false });
                  this.props.setRegion(region);
                }}
                style={{
                  width: '4em',
                  height: '4em',
                  margin: '0.25em',
                  padding: '0.25em',
                  backgroundColor: this.props.region == region ? 'skyblue' : '#ddd',
                  borderRadius: '0.5em',
                  display: 'flex',
                  textAlign: 'center',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {flag}<br></br>
                {region}
              </div>
            ))}
          </div>
        </div> :
        <div onClick={() => { this.setState({ regionSelect: true })}}>
          {FLAGS[this.props.region] || '🌏'}
        </div>
      }
    </>
  }
}

class Header extends React.Component {
  render() {
    return <div className='Header'>
      <div id='title' style={{ width: '4em', fontSize: '1.25em' }} onClick={() => { window.location.pathname = 'about' }}>
        twinge
      </div>
      <div id='roomCode' style={{ width: '5em' }} onClick={() => {
        this.props.toggleQR()
        let code = document.getElementById('roomCode');
        try {
          window.navigator.clipboard.writeText(`${window.location.origin}/${this.props.state.roomCode}`);
        } catch (err) {
          console.err("Fallback Copy Method")
          code.select();
          code.value = `${window.location.origin}/${this.props.state.roomCode}`;
          code.setSelectionRange(0, 99999);
          document.execCommand("copy");
          code.value = this.props.state.roomCode;
        }
      }}>
        {this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}
      </div>
      <div id='functions' style={{ width: '5em' }}>
        <div id='mute' onClick={() => { this.props.toggleMute() }}>
          {this.props.state?.gamestate?.meta?.phase === 'playing' && (this.props.state?.audio.mute ? '🔇' : '🔊')}
        </div>
        {
          this.props.state.roomCode && this.props.state?.gameId ?
            <div id='exit' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'leave', gameId: this.props.state.gameId, playerId: this.props.state.playerId, stateHash: this.props.state.stateHash }) }}>
              ❌
            </div>
            :
            <RegionSelect region={this.props.region} setRegion={this.props.setRegion} />
        }
      </div>
    </div>
  }
}

class Footer extends React.Component {
  render() {
    return <div className='Footer'>
      <div>GAMEID: {this.props.state.gameId}, PLAYERID: {this.props.state.playerId}</div>
    </div>
  }
}

class Overlay extends React.Component {
  render() {
    return <div className='Overlay centered' style={this.props.overlay.message !== '' ? { display: 'flex' } : { display: 'none' }}>
      <div>{this.props.overlay.message || <div>&#8635;</div>}</div>
    </div>
  }
}

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.copyToClipboard = () => {
      let code = document.getElementById('roomUrl');
      code.classList.remove('clickedLink');
      code.classList.add('clickedLink');
      setTimeout(() => {
        code.classList.remove('clickedLink');
      }, 250);
      try {
        window.navigator.clipboard.writeText(`${window.location.origin}/${this.props.state.roomCode}`);
      } catch (err) {
        console.err("Fallback Copy Method")
        code.select();
        code.value = `${window.location.origin}/${this.props.state.roomCode}`;
        code.setSelectionRange(0, 99999);
        document.execCommand("copy");
        code.value = this.props.state.roomCode;
      }
    }
  }

  render() {
    return <div className='Modal centered' style={this.props.state.modal.type !== '' ? { display: 'flex' } : { display: 'none' }}>
      {this.props.state.modal.type === 'qr' &&
        <div className='centered' style={{ flexDirection: 'column' }}>
          <div id='roomUrl' onClick={this.copyToClipboard} style={{ fontSize: "0.75em", padding: '1em' }}>
            Tap to Copy<br></br>
            <u>{`${window.location.host}/${this.props.state.roomCode}`}</u>
          </div>
          <QRCode value={`${window.location.origin}/${this.props.state.roomCode}`} style={{ padding: '1em' }}></QRCode>
          <div className='back' onClick={this.props.toggleQR}>🔙</div>
        </div>
      }
    </div>
  }
}

export { Header, Footer, Overlay, Modal }