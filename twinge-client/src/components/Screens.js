import React from 'react';
import { Players, Status, Latest, Pile, Hand } from './Table';
import { Create, Join, Rename, Start } from './Buttons';

class Lobby extends React.Component {
  render() {
    let inputs;
    if (this.props.state?.gameId && this.props.state?.roomCode) {
      inputs = <div className='lobbyButtons centered'>
        <Start state={this.props.state} sendMsg={this.props.sendMsg}></Start>
        <Rename state={this.props.state} sendMsg={this.props.sendMsg}></Rename>
      </div>
    } else {
      inputs = <div className='lobbyButtons centered'>
        <Create sendMsg={this.props.sendMsg}></Create>
        <Join sendMsg={this.props.sendMsg}></Join>
      </div>
    }

    return <div className='Lobby'>
      <h1>😣 twinge</h1>
      <p>
        🙌 This is a team game...<br></br>
        ⬆️ Try to play your cards in ascending order<br></br>
        💔 Skipping cards will each cost a life each<br></br>
        ➕ Every level, all players will be dealt one additional card<br></br>
        😬 Prepare to feel the twinge!
      </p>
      <Players className='Players centered' context='lobby' players={this.props.state?.gamestate?.players || []}></Players>
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