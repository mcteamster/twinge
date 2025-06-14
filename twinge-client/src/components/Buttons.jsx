import React from 'react';

class Create extends React.Component {
  render() {
    return <div className='Create centered' onClick={() => {
      let create = document.querySelector('.Create');
      create.classList.remove('clickedButton');
      create.classList.add('clickedButton');
      setTimeout(() => {
        create.classList.remove('clickedButton');
      }, 250);
      let deckSize = document.getElementById('deckSize').value;
      let maxLives = document.getElementById('maxLives').value;
      this.props.sendMsg({ action: 'play', actionType: 'new', config: { deckSize: deckSize, maxLives: maxLives }}) 
    }}>
      <div>Create</div>
    </div>
  }
}

class Join extends React.Component {
  render() {
    return <input id='inputBox' type='text' pattern='[A-Z]' maxLength="4" placeholder='or Join Game' className='Join centered' 
    onKeyUp={(event) => { 
      if (document.getElementById('inputBox').value.length === 4 && event.key !== 'Enter') {
        this.props.sendMsg({ action: 'play', actionType: 'join', roomCode: document.getElementById('inputBox').value })
        window.scrollTo(0, 0);
      }
    }}
    onSelect={()=> {
      document.getElementById('inputBox').placeholder = 'e.g. "TWNG"'
    }}>
    </input>
  }
}

class Rename extends React.Component {
  render() {
    return <input id='inputBox' type='text' pattern='[A-Z]' maxLength="10" placeholder='Set Name' className='Rename centered' onKeyUp={(event) => { 
      if (event.key !== 'Enter') {
        this.props.sendMsg({ 
          action: 'play', 
          actionType: 'rename', 
          name: (document.getElementById('inputBox').value.length > 0 ? document.getElementById('inputBox').value : 'ANON' ), 
          gameId: this.props.state.gameId, 
          playerId: this.props.state.playerId 
        }) 
      } else {
        //document.getElementById('inputBox').blur();
        window.scrollTo(0, 0);
      }
    }}>
    </input>
  }
}

class Start extends React.Component {
  render() {
    return <div className='Start centered' onClick={() => { 
      let start = document.querySelector('.Start');
      start.classList.remove('clickedButton');
      start.classList.add('clickedButton');
      setTimeout(() => {
        start.classList.remove('clickedButton');
      }, 250);
      this.props.sendMsg({ action: 'play', actionType: 'start', gameId: this.props.state.gameId, playerId: this.props.state.playerId }) 
    }}>
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