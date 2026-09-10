import { describe, it, expect } from 'vitest';
import Player from '../src/model/Player';

describe('Player', () => {
  describe('default construction (no args)', () => {
    it('creates a player with a string playerId', () => {
      const p = new Player();
      expect(typeof p.playerId).toBe('string');
      expect(p.playerId.length).toBeGreaterThan(0);
    });

    it('sets connected to true', () => {
      const p = new Player();
      expect(p.connected).toBe(true);
    });

    it('sets strikes to 0', () => {
      const p = new Player();
      expect(p.strikes).toBe(0);
    });

    it('creates a name of 10 chars or fewer', () => {
      const p = new Player();
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeLessThanOrEqual(10);
    });

    it('initialises hand as an empty array', () => {
      const p = new Player();
      expect(Array.isArray(p.hand)).toBe(true);
      expect(p.hand.length).toBe(0);
    });

    it('initialises handSize to 0', () => {
      const p = new Player();
      expect(p.handSize).toBe(0);
    });
  });

  describe('rehydration from existing player object', () => {
    const existing = {
      playerId: 'test-id-123',
      connected: false,
      strikes: 2,
      name: 'PLATYPUS',
      hand: [5, 10, 15],
      handSize: 3,
    };

    it('rehydrates playerId', () => {
      const p = new Player(existing);
      expect(p.playerId).toBe('test-id-123');
    });

    it('rehydrates connected flag', () => {
      const p = new Player(existing);
      expect(p.connected).toBe(false);
    });

    it('rehydrates strikes', () => {
      const p = new Player(existing);
      expect(p.strikes).toBe(2);
    });

    it('rehydrates name', () => {
      const p = new Player(existing);
      expect(p.name).toBe('PLATYPUS');
    });

    it('rehydrates hand array', () => {
      const p = new Player(existing);
      expect(p.hand).toEqual([5, 10, 15]);
    });

    it('rehydrates handSize', () => {
      const p = new Player(existing);
      expect(p.handSize).toBe(3);
    });
  });

  describe('rename()', () => {
    it('renames to the given string', async () => {
      const p = new Player();
      await p.rename('FROG');
      expect(p.name).toBe('FROG');
    });

    it('truncates name longer than 10 chars to 10 chars', async () => {
      const p = new Player();
      await p.rename('ABCDEFGHIJK'); // 11 chars
      expect(p.name).toBe('ABCDEFGHIJ');
    });

    it('does not truncate name exactly 10 chars', async () => {
      const p = new Player();
      await p.rename('ABCDEFGHIJ');
      expect(p.name).toBe('ABCDEFGHIJ');
    });
  });
});
