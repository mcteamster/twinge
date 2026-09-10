import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AppState, AudioRefs, GamePhase, GameState } from '../types';

// Screens -> Table/Buttons -> constants/discord loads the Discord SDK at module
// scope. Mock it so tests do not trigger browser-only SDK setup.
vi.mock('../constants/discord', () => ({ discordSdk: undefined, initaliseDiscord: () => false }));

import { About, Lobby, Play, Legal } from './Screens';

function gamestate(phase: GamePhase): GameState {
  return {
    gameId: 'G1',
    players: [{ playerId: 'P1', name: 'Alice', hand: [1], handSize: 1, strikes: 0, connected: true }],
    public: { pile: [], remaining: 10, lives: 5 },
    meta: { phase, round: 1 },
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

const audio: AudioRefs = {
  ring: new Audio(),
  buzz: new Audio(),
};

const noop = () => {};

afterEach(cleanup);

describe('Screens', () => {
  it('Lobby renders the game instructions when a room exists', () => {
    render(<Lobby state={stateFor('open')} sendMsg={noop} />);
    expect(screen.getByText('😣 twinge')).toBeInTheDocument();
  });

  it('Lobby renders Create/Join when no game is joined yet', () => {
    render(<Lobby state={stateFor('open', { gameId: null, roomCode: undefined })} sendMsg={noop} />);
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('or Join Game')).toBeInTheDocument();
  });

  it.each<GamePhase>(['open', 'closed', 'playing', 'won', 'lost'])(
    'Play renders the play screen for the %s phase without throwing',
    (phase) => {
      const { container } = render(
        <Play state={stateFor(phase)} sendMsg={noop} audio={audio} />,
      );
      expect(container.querySelector('.Play')).toBeInTheDocument();
    },
  );

  it('About renders without throwing', () => {
    const { container } = render(<About />);
    expect(container.querySelector('.About')).toBeInTheDocument();
  });

  it('Legal renders the Terms of Service without throwing', () => {
    render(<Legal />);
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});
