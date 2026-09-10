import { v4 as uuidv4 } from 'uuid';
import { uniqueNamesGenerator, animals } from 'unique-names-generator';
import type { PlayerData } from '../types';

class Player {
  playerId!: string;
  connected!: boolean;
  strikes!: number;
  name!: string;
  hand!: number[];
  handSize!: number;

  constructor(player?: Partial<PlayerData>) {
    // Default Player
    if (!player || !player.playerId) {
      let playerName = uniqueNamesGenerator({
        dictionaries: [animals],
        style: 'upperCase',
        separator: ' ',
      });
      while (playerName.length > 10) {
        playerName = uniqueNamesGenerator({
          dictionaries: [animals],
          style: 'upperCase',
          separator: ' ',
        });
      } // Just keep generating names until we get one that is 10 characters or less

      player = {
        playerId: uuidv4(),
        connected: true,
        strikes: 0,
        name: playerName,
        hand: [],
        handSize: 0,
      };
    }

    // Rehydrate Player
    (Object.keys(player) as (keyof PlayerData)[]).forEach((key) => {
      (this as any)[key] = (player as any)[key];
    });
  }

  async rename(name: string): Promise<void> {
    if (name.length > 10) {
      name = name.substring(0, 10);
    }
    this.name = name;
  }
}

export = Player;
