import React from 'react';
import { Players, Status, Latest, Pile, Hand } from './Table';
import { Create, Join, Rename, Start } from './Buttons';

class Lobby extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      deckSize: 100,
      maxLives: 5,
    }
  }

  render() {
    let inputs;
    let info;
    if (this.props.state?.gameId && this.props.state?.roomCode) {
      inputs = <div className='lobbyButtons centered'>
        <Start state={this.props.state} sendMsg={this.props.sendMsg}></Start>
        <Rename state={this.props.state} sendMsg={this.props.sendMsg}></Rename>
      </div>
      info = <Players className='Players centered' context='lobby' players={this.props.state?.gamestate?.players || []}></Players>
    } else {
      inputs = <div className='lobbyButtons centered'>
        <Create sendMsg={this.props.sendMsg}></Create>
        <Join sendMsg={this.props.sendMsg}></Join>
      </div>
      info = <div>
        <div>
          <div>{this.state.deckSize} {this.state.deckSize != 1 ? 'Cards' : 'Card'}</div>
          <input className='slider' id='deckSize' type="range" min="10" max="1000" defaultValue="100" onChange={(e) => {
            this.setState({
              deckSize: e.target.value,
            })
          }}></input>
        </div>
        <div>
          <div>{this.state.maxLives} {this.state.maxLives != 1 ? 'Lives' : 'Life'}</div>
          <input className='slider' id='maxLives' type="range" min="1" max="100" defaultValue="5" onChange={(e) => {
            this.setState({
              maxLives: e.target.value,
            })
          }}></input>
        </div>
      </div>
    }

    return <div className='Lobby'>
      <h1>😣 twinge</h1>
      <p>
        🙌 This is a team game...<br></br>
        ⬆️ Try to play your cards in ascending order<br></br>
        💔 Skipping cards will each cost a life each<br></br>
        📈 Every level, all players will be dealt one additional card<br></br>
        😬 Can you feel the 'twinge' and make it to the end?
      </p>
      {info}
      {inputs}
    </div>
  }
}

class Play extends React.Component {
  render() {
    return <div className='Play'>
      <Status state={this.props.state}></Status>
      <Players className='Players centered' context='play' players={this.props.state?.gamestate?.players || []}></Players>
      <Latest className='Latest centered' event={this.props.state?.gamestate?.public?.pile?.slice(-1) || []} round={this.props.state?.gamestate?.meta?.round || 0}></Latest>
      <Pile pile={this.props.state?.gamestate?.public?.pile} round={this.props.state?.gamestate?.meta?.round || 0}></Pile>
      <Hand state={this.props?.state} sendMsg={this.props.sendMsg}></Hand>
      </div>
  }
}

export { Lobby, Play }