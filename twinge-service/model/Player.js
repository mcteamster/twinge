const Guid = require('guid');

class Player {
  constructor(connectionId) {
    this.playerId = String(Guid.create());
    this.connectionId = connectionId;
  }
}

module.exports = Player;