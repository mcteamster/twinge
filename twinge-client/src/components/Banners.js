import React from 'react';

class Header extends React.Component {
  render() {
    return <div className='Header'>
      <div id='title'>TWINGE</div>
      <div id='roomCode'>{this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}</div>
      <div id='exit' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'leave', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
        ❌
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

export { Header, Footer }