import React from 'react';

class Header extends React.Component {
  render() {
    return <div className='Header'>
      <div id='title'>TWINGE</div>
      <div id='roomCode'>{this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}</div>
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
    return <div className='Overlay centered' style={this.props.message !== '' ? { display: 'flex' } : { display: 'none' }}>
      <div>{this.props.message || <div>&#8635;</div>}</div>  
    </div>
  }
}

export { Header, Footer, Overlay }