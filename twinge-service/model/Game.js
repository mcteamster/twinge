class Game {
  constructor(gamestate) {
    if (gamestate) {
      // Rehydrate Gamestate
      Object.keys(gamestate).forEach((key) => {
        this[key] = gamestate[key];
      });
    } else {
      // Initialise Default
      this.players = [];
      this.config = {
        deckSize: 100,
      };
    }
  }

  async addPlayer(player) {
    this.players.push(player);
  }
}

module.exports = Game;