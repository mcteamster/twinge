import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadingContext } from '../context/LoadingContext';
import { Create, Join, Rename, Start } from './Buttons';
import type { AppState } from '../types';

function baseState(overrides: Partial<AppState> = {}): AppState {
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
    ...overrides,
  };
}

describe('Buttons', () => {
  it('Create renders its label and fires a "new" play action on click', () => {
    const sendMsg = vi.fn();
    // Create reads the deckSize / maxLives range inputs from the document.
    render(
      <>
        <input id="deckSize" defaultValue="67" />
        <input id="maxLives" defaultValue="5" />
        <Create sendMsg={sendMsg} />
      </>,
    );
    expect(screen.getByText('Create')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.Create')!);
    expect(sendMsg).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'play', actionType: 'new' }),
    );
  });

  it('Start renders its label and fires a "start" play action on click', () => {
    const sendMsg = vi.fn();
    render(<Start state={baseState()} sendMsg={sendMsg} />);
    expect(screen.getByText('Start')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.Start')!);
    expect(sendMsg).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'play', actionType: 'start', gameId: 'G1', playerId: 'P1' }),
    );
  });

  it('Rename fires a "rename" play action on change', () => {
    const sendMsg = vi.fn();
    render(<Rename state={baseState()} sendMsg={sendMsg} />);
    const input = document.getElementById('inputBox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(sendMsg).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'play', actionType: 'rename', name: 'Alice' }),
    );
  });

  it('Join fires a "join" action when a 4-char code is entered', () => {
    const sendMsg = vi.fn();
    render(
      <LoadingContext.Provider value={false}>
        <Join sendMsg={sendMsg} />
      </LoadingContext.Provider>,
    );
    const input = screen.getByPlaceholderText('or Join Game') as HTMLInputElement;
    input.value = 'TWNG';
    fireEvent.keyUp(input, { key: 'G' });
    expect(sendMsg).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'play', actionType: 'join', roomCode: 'TWNG' }),
    );
  });

  it('Join does not fire while loading', () => {
    const sendMsg = vi.fn();
    render(
      <LoadingContext.Provider value={true}>
        <Join sendMsg={sendMsg} />
      </LoadingContext.Provider>,
    );
    const input = screen.getByPlaceholderText('or Join Game') as HTMLInputElement;
    input.value = 'TWNG';
    fireEvent.keyUp(input, { key: 'G' });
    expect(sendMsg).not.toHaveBeenCalled();
  });
});
