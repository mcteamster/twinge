import React from 'react';
import QRCode from "react-qr-code";

class Header extends React.Component {
  render() {
    return <div className='Header'>
      <div id='title' onClick={() => { window.location.pathname = 'about' }}>
        twinge
      </div>
      <div id='roomCode' onClick={this.props.toggleQR}>
        {this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}
      </div>
      <div id='functions'>
        <div id='mute' onClick={() => { this.props.toggleMute() }}>
          {this.props.state?.gamestate?.meta?.phase === 'playing' && (this.props.state?.audio.mute ? '🔇' : '🔊')}
        </div>
        <div id='exit' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'leave', gameId: this.props.state.gameId, playerId: this.props.state.playerId, stateHash: this.props.state.stateHash }) }}>
          {this.props.state?.gameId && '❌'}
        </div>
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