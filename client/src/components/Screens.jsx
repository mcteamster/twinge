import React from 'react';
import { Players, Status, Latest, Pile, Hand } from './Table';
import { Create, Join, Rename, Start } from './Buttons';
import { discordSdk } from '../constants/discord';

class Lobby extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      deckSize: 67,
      maxLives: 5,
    }
  }

  render() {
    let inputs;
    let info;
    if (this.props.state?.gameId && this.props.state?.roomCode) {
      inputs = <div className='lobbyButtons centered'>
        <Rename state={this.props.state} sendMsg={this.props.sendMsg}></Rename>
        {this.props.state?.gamestate?.players[0]?.playerId ? <Start state={this.props.state} sendMsg={this.props.sendMsg}></Start> : ""}
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
          <input className='slider' id='deckSize' type="range" min="10" max="1000" defaultValue="67" onChange={(e) => {
            if (e.target.value > 66 && e.target.value < 68) {
              e.target.value = 67
            } else {
              e.target.value = e.target.value - (e.target.value % 5);
            }
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
        👥 A <b>Teamwork</b> Game<br></br>
        ⬆️ <b>Count Upwards</b> Together<br></br>
        😉 Give <b>Subjective Clues</b> Only<br></br>
        💔 <b>Skip</b> A Card = <b>Lose</b> A Life<br></br>
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
      <Pile state={this.props.state} pile={this.props.state?.gamestate?.public?.pile} round={this.props.state?.gamestate?.meta?.round || 0}></Pile>
      <Hand state={this.props?.state} sendMsg={this.props.sendMsg} audio={this.props.audio}></Hand>
    </div>
  }
}

class About extends React.Component {
  render() {
    return <div className='About'>
      <div className='aboutParagraph'>
        <p><b>twinge</b> by <a href='https://mcteamster.com' target='_blank' rel="noreferrer">mcteamster</a></p>
        <p>A co-operative card game inspired by Wolfgang Warsch's <a href='https://boardgamegeek.com/boardgame/244992/mind' target='_blank' rel="noreferrer">The Mind</a>.</p>
        {
          !discordSdk &&         
          <p className='centered'>
            <a className='discordButton' href='https://discord.com/discovery/applications/1385639813268373587' target='_blank'>
              <img height='25' width='25' src='discord.svg' /><br></br>
              Open in Discord
            </a>
          </p>
        }
        <p>
          🏁 <b>Goal</b><br></br>
          Work together to get through a series of 10-1000 cards by playing in ascending order. There are no turns, anyone can play at any time!
        </p>
        <p>
          🕹️ <b>Controls</b><br></br>
          This is a one button game. Tap and hold in the bottom area to prepare a card, release to play into the pile, or keep holding for 4 seconds to cancel.
        </p>
        <p>
          📈 <b>Levels</b><br></br>
          Players start at Level 1 with one card each. Subsequent levels deal out one more card per player (i.e. 3 cards for Level 3). This continues until the deck is exhausted.
        </p>
        <p>
          ❤️ <b>Lives</b><br></br>
          If a card is played out of order, the team loses a life for every lower numbered card still in other players' hands. Set the number of lives between 1-100 to adjust difficulty.
        </p>
        <p>
          🤫 <b>Clues</b><br></br>
          The team should decide on what kind of talk is acceptable. Saying numbers is too easy. Playing in silence is very hard. Subjective clues are the most fun!
        </p>
        <p>
          ⏩ <b>Combos</b><br></br>
          Consecutive cards (e.g. 32,33) will be played together. The blue border shows which cards are up next.
        </p>
        <p>
          🎟️ <b>Joining</b><br></br>
          Enter the room code. Tap the room code to show a join link and QR code. Set a name in the game lobby. A random name is assigned if joining a game in progress.
        </p>
        <p>
          👻 <b>Spectating</b><br></br>
          Players can toggle spectator mode by holding down on their own name until the border turns purple. Spectators will not be dealt cards, but the current hand must still be played.
        </p>
        <p>
          ⛔️ <b>Kicking</b><br></br>
          Warn a player by holding their name until they turn purple, repeat to eject them (their cards are removed without penalty). Anyone can do this. Warnings last for one level.
        </p>
        <p>
          🛜 <b>Reconnecting</b><br></br>
          The game will automatically attempt to reconnect to the last active game. If this fails, try refreshing the page. In the worst case, rejoin and kick the idle player.
        </p>
        <p onClick={() => { window.location.pathname = 'legal' }} style={{ cursor: 'pointer' }}>
          <a>Terms of Service</a> and <a>Privacy Policy</a>
        </p>
      </div>
      <div className='back' style={ (discordSdk && ((window.innerWidth/window.innerHeight) < 1)) ? { top: '1em' } : {} } onClick={() => {
        window.location.pathname = '';
      }}>🔙</div>
    </div>
  }
}

class Legal extends React.Component {
  render() {
    return <div className='About'>
      <div className='aboutParagraph'>
        <p><b>Terms of Service</b></p>
        <p>
          By accessing this website, we assume you accept these terms and conditions.
          Do not continue to use twinge if you do not agree to take all of the terms and conditions stated on this page.
        </p>
        <p>
          Twinge is provided "as is" and "as available." We make no representations or warranties of any kind,
          express or implied, as to the operation of the Game, including but not limited to any implied warranties of merchantability,
          fitness for a particular purpose, or non-infringement.
        </p>
        <p>
          You agree not to violate any laws or regulations while playing, or interfere with other users' enjoyment of the game.
        </p>
        <p>
          In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of Twinge,
          even if we have been advised of the possibility of such damages.
        </p>
        <p>
          We reserve the right, at our sole discretion, to modify or replace these Terms of Service at any time.
        </p>
        <p><b>Privacy Policy</b></p>
        <p>
          When you visit the website, we automatically collect anonymised user stats through Microsoft Clarity.
          This includes information about your device, such as web browser, time zone, and how you interact with the website.
          We use this information to improve the game development experience.</p>
        <p>
          We may update this Privacy Policy from time to time in response to changing legal, technical, or business developments.
          When we update our Privacy Policy, we will take steps to make sure that these changes are brought to your attention and posted on this page.
        </p>
      </div>
      <div className='back' style={ (discordSdk && ((window.innerWidth/window.innerHeight) < 1)) ? { top: '1em' } : {} } onClick={() => {
        window.location.pathname = '';
      }}>🔙</div>
    </div>
  }
}

export { About, Lobby, Play, Legal }