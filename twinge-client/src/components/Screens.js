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
        <Rename state={this.props.state} sendMsg={this.props.sendMsg}></Rename>
        <Start state={this.props.state} sendMsg={this.props.sendMsg}></Start>
      </div>
      info = <div>
          <div className='lobbyInfo'>{this.props.state?.gamestate?.config?.deckSize} Cards / {this.props.state?.gamestate?.config?.maxLives} {this.props.state?.gamestate?.config?.maxLives !== '1' ? 'Lives' : 'Life'}</div>
          <Players context='lobby' state={this.props.state} sendMsg={this.props.sendMsg} players={this.props.state?.gamestate?.players || []}></Players>
        </div>
    } else {
      inputs = <div className='lobbyButtons centered'>
        <Create sendMsg={this.props.sendMsg}></Create>
        <Join sendMsg={this.props.sendMsg}></Join>
      </div>
      info = <div>
        <div>
          <div className='lobbyInfo'>{this.state.deckSize} Cards</div>
          <input className='slider' id='deckSize' type="range" min="10" max="1000" defaultValue="100" onChange={(e) => {
            e.target.value = e.target.value - (e.target.value % 5);
            this.setState({
              deckSize: e.target.value,
            })
          }}></input>
        </div>
        <div>
          <div className='lobbyInfo'>{this.state.maxLives} {this.state.maxLives !== '1' ? 'Lives' : 'Life'}</div>
          <input className='slider' id='maxLives' type="range" min="1" max="100" defaultValue="5" onChange={(e) => {
            this.setState({
              maxLives: e.target.value,
            })
          }}></input>
        </div>
      </div>
    }

    return <div className='Lobby'>
      <div id='instructions'>
        <h1>😣 twinge</h1>
        🙌 this is a team game...<br></br>
        ⬆️ where we play our cards in ascending order<br></br>
        👆 tap-hold-release to play your lowest card(s)<br></br>
        💔 each skipped card will cost us a life<br></br>
        📈 we get dealt one more card every level<br></br>
        😬 can you feel the <b>twinge</b> and make it to the end?
      </div>
      {info}
      {inputs}
    </div>
  }
}

class Play extends React.Component {
  render() {
    return <div className='Play'>
      <Status state={this.props.state}></Status>
      <Players className='Players centered' state={this.props.state} sendMsg={this.props.sendMsg} context='play' players={this.props.state?.gamestate?.players || []}></Players>
      <Latest className='Latest centered' state={this.props.state} event={this.props.state?.gamestate?.public?.pile?.slice(-1) || []} round={this.props.state?.gamestate?.meta?.round || 0} audio={this.props.audio}></Latest>
      <Pile pile={this.props.state?.gamestate?.public?.pile} round={this.props.state?.gamestate?.meta?.round || 0}></Pile>
      <Hand state={this.props?.state} sendMsg={this.props.sendMsg} audio={this.props.audio}></Hand>
      </div>
  }
}

class About extends React.Component {
  render() {
    return <div className='About'>
        <div className='aboutParagraph'>
          <b>twinge</b> by <a href='https://mcteamster.com' target='_blank' rel="noreferrer">mcteamster</a>
        </div>
        <div className='aboutParagraph'>
          This is a co-operative card game based off <a href='https://boardgamegeek.com/boardgame/244992/mind' target='_blank' rel="noreferrer">The Mind</a> by Wolfgang Warsch.
          Players work together to get through a deck of 10-1000 cards in ascending order. Hands are dealt with increasing size, and cards are played at any time; without replacement.
          Difficulty may be adjusted by granting up to 100 extra lives to compensate for missing cards out of order.
        </div>
        <div className='back' onClick={() => {
          window.location.pathname = '';
        }}>🔙</div>
      </div>
  }
}

export { About, Lobby, Play }