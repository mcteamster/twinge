const Guid = require('guid');

class Player {
  constructor(player) {
    // Default Player
    if (!player || !player.playerId) {
      player = {
        playerId: String(Guid.create()),
        hand: [],
        handSize: 0,
      };
    }
    
    // Rehydrate Player
    Object.keys(player).forEach((key) => {
      this[key] = player[key];
    });
  }
}

module.exports = Player;