import React from 'react';
import { Players, Status, Latest, Pile, Hand } from './Table';
import { Create, Join, Rename, Start } from './Buttons';

class Lobby extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let inputs;
    if (this.props.state?.roomCode) {
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
      <div>
        <h1>😣 twinge</h1>
        <p>
          as a team, try to play your cards in ascending order<br></br>
          each level, every player will be dealt an additional card<br></br>
          any skipped cards will cost you a life<br></br>
          prepare to feel the twinge!
        </p>
      </div>
      <Players className='Players centered' context='lobby' players={this.props.state?.gamestate?.players || []}></Players>
      {inputs}
    </div>
  }
}

class Play extends React.Component {
  constructor(props) {
    super(props);
  }

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