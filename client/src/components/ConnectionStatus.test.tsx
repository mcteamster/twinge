import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('renders a "Connected" indicator when connected', () => {
    const { container } = render(<ConnectionStatus isConnected={true} />);
    const dot = container.querySelector('.connection-status')!;
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('title', 'Connected');
    expect(dot).toHaveStyle({ backgroundColor: '#22c55e' });
  });

  it('renders a "Disconnected" indicator when not connected', () => {
    const { container } = render(<ConnectionStatus isConnected={false} />);
    const dot = container.querySelector('.connection-status')!;
    expect(dot).toHaveAttribute('title', 'Disconnected');
    expect(dot).toHaveStyle({ backgroundColor: '#ef4444' });
  });
});
