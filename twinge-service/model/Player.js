const Guid = require('guid');
const { uniqueNamesGenerator, animals } = require('unique-names-generator');

class Player {
  constructor(player) {
    // Default Player
    if (!player || !player.playerId) {
      player = {
        playerId: String(Guid.create()),
        connected: true,
        strikes: 0,
        name: uniqueNamesGenerator({ 
          dictionaries: [animals],
          style: 'upperCase',
          separator: ' ',
        }),
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
    if (name.length > 10) {
      name = name.substring(0, 10);
    }
    this.name = name;
  }
}

module.exports = Player;