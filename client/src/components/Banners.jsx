import React from 'react';
import QRCode from "react-qr-code";
import { FLAGS } from '../constants/constants';
import { discordSdk } from '../constants/discord';

class Notices extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      noticeRegions: [],
      noticeMessage: '',
    };
  }

  componentDidMount() {
    this.checkNotices()
  }

  checkNotices = async () => {
    const data = await (await fetch('https://api.mcteamster.com/common/notices/twinge')).json()
    this.setState((state) => { 
      state.noticeMessage = data.message
      if (data.regions?.length > 0) {
        state.noticeRegions = data.regions
      } else {
        state.noticeRegions = []
      }
      return state
    })
  }
  
  render() {
    return <div className='Notice centered'>
      {(this.state.noticeRegions.length == 0 || this.state.noticeRegions.includes(this.props.region)) ? this.state.noticeMessage : ''}
    </div>
  }
}

class RegionSelect extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      regionSelect: false,
    };
  }

  render() {
    return <>
      { this.state.regionSelect ?
        <div className='Overlay centered' style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="region-list" style={{
            width: '15em',
            display: this.state.regionSelect ? 'flex' : 'none',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontSize: '0.4em',
          }}>
            {Object.entries(FLAGS).reverse().map(([region, flag]) => (
              <div
                key={region}
                onClick={() => {
                  this.setState({ regionSelect: false });
                  this.props.setRegion(region, false);
                }}
                style={{
                  width: '4em',
                  height: '4em',
                  margin: '0.25em',
                  padding: '0.25em',
                  backgroundColor: this.props.region == region ? 'skyblue' : '#ddd',
                  borderRadius: '0.5em',
                  display: 'flex',
                  textAlign: 'center',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {flag}<br></br>
                {region}
              </div>
            ))}
          </div>
        </div> :
        <div onClick={() => { this.setState({ regionSelect: true })}}>
          {FLAGS[this.props.region] || '🌏'}
        </div>
      }
    </>
  }
}

class Header extends React.Component {
  render() {
    return <div className='Header' style={ (discordSdk && ((window.innerWidth/window.innerHeight) < 1)) ? { height: '4.75em', alignItems: 'flex-end', paddingBottom: '0.5em'} : {} }>
      <div id='title' style={{ width: '4em', fontSize: '1.25em' }} onClick={() => { window.location.pathname = 'about' }}>
        twinge
      </div>
      <div id='roomCode' style={{ width: '5em' }} onClick={() => {
        this.props.toggleQR()
        let code = document.getElementById('roomCode');
        try {
          window.navigator.clipboard.writeText(`https://twinge.mcteamster.com/${this.props.state.roomCode}`);
        } catch (err) {
          console.err("Fallback Copy Method")
          code.select();
          code.value = `https://twinge.mcteamster.com/${this.props.state.roomCode}`;
          code.setSelectionRange(0, 99999);
          document.execCommand("copy");
          code.value = this.props.state.roomCode;
        }
      }}>
        {this.props.state.roomCode ? `${this.props.state.roomCode}` : ''}
      </div>
      <div id='functions' style={{ width: '5em' }}>
        <div id='mute' onClick={() => { this.props.toggleMute() }}>
          {this.props.state?.gamestate?.meta?.phase === 'playing' && (this.props.state?.audio.mute ? '🔇' : '🔊')}
        </div>
        {
          this.props.state.roomCode && this.props.state?.gameId ?
            <div id='exit' onClick={() => { this.props.sendMsg({ action: 'play', actionType: 'leave', gameId: this.props.state.gameId, playerId: this.props.state.playerId, stateHash: this.props.state.stateHash }) }}>
              ❌
            </div>
            :
            <RegionSelect region={this.props.region} setRegion={this.props.setRegion} />
        }
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
    let message = <div>Please Adjust Screen</div>;
    if (this.props.overlay.message) {
      message = <>{this.props.overlay.message}</>
    } else if ((this.props.state?.gamestate?.public?.pile.length > 0) || this.props.state?.gamestate?.meta?.round == 1) {
      let pile = this.props.state?.gamestate?.public?.pile;
      let latestCard = 0;
      if ((pile[pile.length - 1]?.round == this.props.state?.gamestate?.meta?.round)) {
        latestCard = pile[pile.length - 1]?.card
      }
      let activePlayer = this.props.state.gamestate.players.find((player) => { return player.playerId === this.props.state.playerId });
      let lowestHand = <></>;
      if (activePlayer?.hand?.[0]) {
        lowestHand = <div style={{ fontSize: '0.75em' }}>
          ✋&nbsp;{activePlayer.hand[0]}
        </div>
      }
      message = <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        <div style={{ fontSize: '1.5em' }}>
          {latestCard}
        </div>
        {lowestHand}
      </div>
    }

    return <div className='Overlay centered' style={this.props.overlay.message !== '' ? { display: 'flex' } : { display: 'none' }}>
      {message}
    </div>
  }
}

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.copyToClipboard = () => {
      let code = document.getElementById('roomUrl');
      code.classList.remove('clickedLink');
      code.classList.add('clickedLink');
      setTimeout(() => {
        code.classList.remove('clickedLink');
      }, 250);
      try {
        window.navigator.clipboard.writeText(`https://twinge.mcteamster.com/${this.props.state.roomCode}`);
      } catch (err) {
        console.err("Fallback Copy Method")
        code.select();
        code.value = `https://twinge.mcteamster.com/${this.props.state.roomCode}`;
        code.setSelectionRange(0, 99999);
        document.execCommand("copy");
        code.value = this.props.state.roomCode;
      }
    }
  }

  render() {
    return <div className='Modal centered' style={this.props.state.modal.type !== '' ? { display: 'flex' } : { display: 'none' }}>
      {this.props.state.modal.type === 'qr' &&
        <div className='centered' style={{ flexDirection: 'column' }}>
          <div id='roomUrl' onClick={this.copyToClipboard} style={{ fontSize: "0.75em", padding: '1em' }}>
            Tap to Copy<br></br>
            <u>{`twinge.mcteamster.com/${this.props.state.roomCode}`}</u>
          </div>
          <QRCode value={`https://twinge.mcteamster.com/${this.props.state.roomCode}`} style={{ padding: '1em' }}></QRCode>
          <div style={{ fontSize: '3em' }} onClick={this.props.toggleQR}>🔙</div>
        </div>
      }
    </div>
  }
}

export { Header, Footer, Overlay, Modal, Notices }