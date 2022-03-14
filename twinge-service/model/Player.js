const Guid = require('guid');

class Player {
  constructor(player) {
    // Default Player
    if (!player.playerId) {
      player = {
        playerId: String(Guid.create()),
        connectionId: player.connectionId,
      };
    }
    
    // Rehydrate Player
    Object.keys(player).forEach((key) => {
      this[key] = player[key];
    });
  }
}

module.exports = Player;