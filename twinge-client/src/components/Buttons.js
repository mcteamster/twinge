import React from 'react';

class Create extends React.Component {
  render() {
    return <div className='Create' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'new' }) }}>
      <div>Create</div>
    </div>
  }
}

class Join extends React.Component {
  render() {
    return <input id='inputBox' type='text' pattern='[A-Z]' placeholder='or Join e.g. "ABCD"'className='Join centered' onKeyUp={(event) => { 
      if (event.key === 'Enter' || document.getElementById('inputBox').value.length === 4) {
        this.props.sendMsg({ action: 'play', actionType: 'join', roomCode: document.getElementById('inputBox').value }) 
      }
    }}>
    </input>
  }
}

class Rename extends React.Component {
  render() {
    return <input id='inputBox' type='text' pattern='[A-Z]' placeholder='or Rename' className='Rename centered' onKeyUp={(event) => { 
      if (event.key === 'Enter') {
        this.props.sendMsg({ action: 'play', actionType: 'rename', name: document.getElementById('inputBox').value, gameId: this.props.state.gameId, playerId: this.props.state.playerId }) 
      }
    }}>
    </input>
  }
}

class Start extends React.Component {
  render() {
    return <div className='Start' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'start', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) }}>
      <div>Start</div>
    </div>
  }
}

export { 
  Create,
  Join,
  Rename,
  Start,
}