import React from 'react';

class Header extends React.Component {
  render() {
    return <div className='Header'>
      <div id='title' onClick={() => { window.location.pathname = 'about' }}>
        twinge
      </div>
      <div id='roomCode' onClick={() => {
        let code = document.getElementById('roomCode');
        code.classList.remove('clickedLink');
        code.classList.add('clickedLink');
        setTimeout(() => {
          code.classList.remove('clickedLink');
        }, 250);
        try {
          window.navigator.clipboard.writeText(`https://twinge.mcteamster.com/${this.props.state.roomCode}`);
        } catch (err) {
          console.err("Fallback Copy Method")
          code.select();
          code.value = `https://twinge.mcteamster.com/${this.props.state.roomCode}`;
          code.setSelectionRange(0, 99999);
          document.execCommand("copy");
          code.value = this.props.state.roomCode;
        }
      }}>
        {this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}
      </div>
      <div id='exit' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'leave', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
        {this.props.state?.gameId && '❌'}
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

export { Header, Footer, Overlay }