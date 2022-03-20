const Guid = require('guid');

class Player {
  constructor(player) {
    // Default Player
    if (!player || !player.playerId) {
      player = {
        playerId: String(Guid.create()),
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
    if (name.length > 20) {
      name = name.substring(0, 20);
    }
    this.name = name;
  }
}

module.exports = Player;