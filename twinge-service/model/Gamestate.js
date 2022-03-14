const Player = require('../model/Player');

class Gamestate {
  constructor(gamestate) {
    // Default Gamestate
    if (!gamestate) {
      gamestate = {
        config: {
          deckSize: 100,
        },
        meta: {
          phase: 'open',
          round: 0
        },
        players: [],
      };
    }

    // Rehydrate Gamestate
    Object.keys(gamestate).forEach((key) => {
      this[key] = gamestate[key];
    });

    // Rehydrate Players
    this.players = this.players.map((player) => {
      return new Player(player);
    });
  }

  async addPlayer(player) {
    this.players.push(player);
  }
}

module.exports = Gamestate;