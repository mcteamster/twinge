import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AppState, GamePhase, GameState } from '../types';

// Banners transitively imports constants/discord, which loads the Discord
// embedded-app SDK at module scope. Mock it so no browser-only SDK setup runs.
vi.mock('../constants/discord', () => ({ discordSdk: undefined, initaliseDiscord: () => false }));
// Notices fires a network fetch on mount; stub it out.
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ messages: {} }) }));

import { Header, Footer, Overlay, Modal } from './Banners';

function gamestate(phase: GamePhase): GameState {
  return {
    gameId: 'G1',
    players: [],
    public: { pile: [], remaining: 0, lives: 5 },
    meta: { phase, round: 0 },
    config: { deckSize: 67, maxLives: 5 },
  };
}

function stateFor(phase: GamePhase, overrides: Partial<AppState> = {}): AppState {
  return {
    region: null,
    gameId: 'G1',
    playerId: 'P1',
    createTime: null,
    audio: { mute: false },
    loading: false,
    isConnected: true,
    overlay: { message: '' },
    modal: { type: '' },
    roomCode: 'TWNG',
    gamestate: gamestate(phase),
    ...overrides,
  };
}

const noop = () => {};

afterEach(cleanup);

describe('Banners', () => {
  it.each<GamePhase>(['open', 'playing', 'won', 'lost'])(
    'Header renders the room code for the %s phase without throwing',
    (phase) => {
      render(
        <Header
          state={stateFor(phase)}
          sendMsg={noop}
          toggleMute={noop}
          toggleQR={noop}
          region={null}
          setRegion={noop}
          clearSession={noop}
        />,
      );
      expect(screen.getByText('TWNG')).toBeInTheDocument();
    },
  );

  it('Header shows the mute control only during the playing phase', () => {
    const { rerender } = render(
      <Header state={stateFor('playing')} sendMsg={noop} toggleMute={noop} toggleQR={noop}
        region={null} setRegion={noop} clearSession={noop} />,
    );
    expect(screen.getByText('🔊')).toBeInTheDocument();

    rerender(
      <Header state={stateFor('open')} sendMsg={noop} toggleMute={noop} toggleQR={noop}
        region={null} setRegion={noop} clearSession={noop} />,
    );
    expect(screen.queryByText('🔊')).not.toBeInTheDocument();
  });

  it('Footer renders the game and player ids', () => {
    render(<Footer state={stateFor('playing')} />);
    expect(screen.getByText(/GAMEID: G1/)).toBeInTheDocument();
    expect(screen.getByText(/PLAYERID: P1/)).toBeInTheDocument();
  });

  it('Overlay is hidden when there is no message', () => {
    const { container } = render(<Overlay overlay={{ message: '' }} />);
    expect(container.querySelector('.Overlay')).toHaveStyle({ display: 'none' });
  });

  it('Overlay shows its message when one is set', () => {
    render(<Overlay overlay={{ message: 'Please Wait' }} />);
    expect(screen.getByText('Please Wait')).toBeInTheDocument();
  });

  it('Modal renders the QR share content when its type is "qr"', () => {
    render(<Modal state={stateFor('open', { modal: { type: 'qr' } })} toggleQR={noop} />);
    expect(screen.getByText(/twinge\.mcteamster\.com\/TWNG/)).toBeInTheDocument();
  });
});
