const Player = require('./Player');

class Gamestate {
  constructor(gamestate) {
    // Default Gamestate
    if (!gamestate.config) {
      gamestate = {
        // User customisable
        config: {
          deckSize: 100,
          maxLives: 5,
        },
        // Abstract stuff about the game 
        meta: {
          phase: 'open',
          round: 0
        },
        // What's on the table
        public: {
          pile: [],
          lives: 3,
          remaining: 100,
        },
        // Partially Secret
        players: [],
        // Secret Information
        private: {
          deck: [],
        },
      };
    } else if (gamestate.config && !gamestate.meta) {
      gamestate = {
        config: {
          deckSize: (gamestate.config.deckSize <= 1000 && gamestate.config.deckSize >= 10) ? Math.ceil(gamestate.config.deckSize) : 100,
          maxLives: (gamestate.config.maxLives <= 100 && gamestate.config.maxLives > 0) ? Math.ceil(gamestate.config.maxLives) : 5,
        },
        // Abstract stuff about the game 
        meta: {
          phase: 'open',
          round: 0
        },
        // What's on the table
        public: {
          pile: [],
          lives: (gamestate.config.maxLives <= 100 && gamestate.config.maxLives > 0) ? Math.ceil(gamestate.config.maxLives) : 5,
          remaining: (gamestate.config.deckSize <= 1000 && gamestate.config.deckSize >= 10) ? Math.ceil(gamestate.config.deckSize) : 100,
        },
        // Partially Secret
        players: [],
        // Secret Information
        private: {
          deck: [],
        },
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

  // Player Management
  async addPlayer(player) {
    this.players.push(player);
    return player.playerId;
  }

  async findPlayer(playerId) {
    return this.players.find((player) => {
      return player.playerId == playerId;
    });
  }

  async kickPlayer(playerId) {
    let playerIndex = this.players.findIndex((player) => {
      return player.playerId == playerId;
    });
    return this.players.splice(playerIndex, 1);
  }

  // Game Management
  async setupGame() {
    // Initialise Deck
    this.private.deck = Array.from({
      length: this.config.deckSize,
    }, (_, index) => {
      return ++index;
    });

    // Shuffle
    this.private.deck.forEach((_, i, a) => {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    });
    this.public.remaining = this.private.deck.length;
    this.meta.phase = 'playing';
  }

  async setupRound() {
    // Deal cards to players - subtract from the deck
    let numberPlaying = (this.players.length - this.players.reduce((spectators, p) => { return p.strikes === -1 ? spectators + 1 : spectators }, 0));
    if (this.private.deck.length == 0) {
      // Not Enough Cards - End The Game Here! You WIN!
      this.public.pile.push({ time: new Date().toISOString(), card: 'You Win! 🥳', round: this.meta.round, playerIndex: -1 });
      this.meta.phase = 'won';
    } else if (numberPlaying > 0) {
      if (this.private.deck.length >= (this.meta.round + 1) * numberPlaying) {
        this.meta.round++;
        this.players.forEach((player) => {
          // Exclude Spectators
          if (player.strikes === -1) {
            player.hand = []
            player.handSize = 0
          } else {
            player.hand = this.private.deck.splice(0, this.meta.round);
            player.hand.sort((a, b) => { return a - b });
            player.handSize = player.hand.length;
            player.strikes = 0;
          }
        });
        this.public.remaining = this.private.deck.length;
      } else {
        // Partial distrbution for final round
        this.meta.round++;
        let quotient = this.private.deck.length / numberPlaying;
        let remainder = this.private.deck.length % numberPlaying;
        this.players.forEach((player) => {
          // Exclude Spectators
          if (player.strikes === -1) {
            player.hand = []
            player.handSize = 0
          } else {
            let bonus = 0
            if (remainder) {
              bonus = 1
              remainder -= 1
            }
            player.hand = this.private.deck.splice(0, quotient + bonus);
            player.hand.sort((a, b) => { return a - b });
            player.handSize = player.hand.length;
            player.strikes = 0;
          }
        });
        this.public.remaining = this.private.deck.length;
      }
    }
  }

  async playCard(playerId) {
    // Find active player
    let activePlayerIndex = this.players.findIndex((player) => {
      return player.playerId == playerId;
    });
    let activePlayer = this.players[activePlayerIndex];
    let lowestCards = [{ time: new Date().toISOString(), card: activePlayer.hand.shift(), round: this.meta.round, playerIndex: activePlayerIndex, playerName: activePlayer.name }];
    while (activePlayer.hand[0] == lowestCards[lowestCards.length - 1].card + 1) {
      lowestCards.push({ time: new Date().toISOString(), card: activePlayer.hand.shift(), round: this.meta.round, playerIndex: activePlayerIndex, playerName: activePlayer.name });
    }
    activePlayer.handSize = activePlayer.hand.length;
    this.public.pile.push(...lowestCards);

    // Check for missed cards
    let missedCards = [];
    this.players.forEach((player, playerIndex) => {
      if (player.playerId != activePlayer.playerId) {
        while (player.hand[0] < lowestCards[0].card) {
          missedCards.push({ time: new Date().toISOString(), card: player.hand.shift(), round: this.meta.round, playerIndex: playerIndex, playerName: player.name, missed: true })
        }
        player.handSize = player.hand.length;
      }
    })
    if (missedCards.length > 0) {
      missedCards.sort((a, b) => { return a.card - b.card });
      this.public.pile.push(...missedCards);
      this.public.lives -= missedCards.length;
      if (this.public.lives <= 0) {
        this.public.lives = 0;
        this.meta.phase = 'lost';
        return;
      }
    }

    // Autocomplete round if 1 remaining player
    if (this.players.filter((player) => { return player.handSize > 0 }).length == 1) {
      this.players.forEach((player, playerIndex) => {
        if (player.handSize > 0) {
          this.public.pile.push(...player.hand.splice(0).map((card) => {
            return { time: new Date().toISOString(), card: card, round: this.meta.round, playerIndex: playerIndex, playerName: player.name }
          }));
          player.handSize = 0;
        }
      });
    }
  }

  async checkConnections(connections) {
    this.players.forEach((player) => {
      if (connections.findIndex((connection) => { return connection.playerId == player.playerId }) > -1) {
        player.connected = true;
      } else {
        player.connected = false;
      }
    })
  }

  async restartGame() {
    this.meta = {
      phase: 'open',
      round: 0,
    };
    this.public = {
      pile: [],
      lives: this.config.maxLives,
      remaining: this.config.deckSize,
    };
    this.players.forEach((player) => {
      player.hand = [];
    });
    this.setupGame();
    this.setupRound();
  }
}

module.exports = Gamestate;