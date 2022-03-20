import React from 'react';

class Header extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <div className='Header'>
      <div>TWINGE</div>
      <div>{this.props.state.roomCode ? `Room: ${this.props.state.roomCode}` : ''}</div>
    </div>
  }
}

class Footer extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <div className='Footer'>
      <div>GAMEID: {this.props.state.gameId}, PLAYERID: {this.props.state.playerId}</div>  
    </div>
  }
}

export { Header, Footer }