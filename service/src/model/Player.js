const { v4: uuidv4 } = require('uuid');
const { uniqueNamesGenerator, animals } = require('unique-names-generator');

class Player {
  constructor(player) {
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