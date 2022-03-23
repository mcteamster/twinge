const Guid = require('guid');

class Player {
  constructor(player) {
    // Default Player
    if (!player || !player.playerId) {
      player = {
        playerId: String(Guid.create()),
        connected: true,
        name: 'ANON',
        hand: [],
        handSize: 0,
      };
    }
    
    // Rehydrate Player
    Object.keys(player).forEach((key) => {
      this[key] = player[key];
    });
  }

  async rename(name) {
    if (name.length > 8) {
      name = name.substring(0, 8);
    }
    this.name = name;
  }
}

module.exports = Player;