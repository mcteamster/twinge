const Player = require('../model/Player');

class Gamestate {
  constructor(gamestate) {
    // Default Gamestate
    if (!gamestate) {
      gamestate = {
        // User customisable
        config: {
          deckSize: 100,
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
    return player.playerId;
  }

  async setupGame() {
    // Initialise Deck
    this.private.deck = Array.from({
      length: this.config.deckSize,
    }, (_, index) => {
      return ++index;
    });

    // Shuffle Deck
    this.private.deck.forEach((_, i, a) => {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    });

    this.public.remaining = this.private.deck.length;
  }

  async nextRound() {
    ++round;
    // Deal cards to players - subtract from the deck
    if (this.private.deck.length > this.meta.round * this.players.length) {
      this.players.forEach((player) => {
        player.hand = this.private.deck.splice(0, this.meta.round);
        player.hand.sort();
        player.handSize = player.hand.length;
      });
      this.public.remaining = this.private.deck.length;
    } else {
      // Not Enough Cards - End The Game Here! You WIN!
    }
  }

  async playCard(playerId) {
    // Find Player
    let player = this.players.find((player) => {
      return player.playerId == playerId;
    })
    let lowestCards = [player.hand.shift()];
    while (player.hand[0] == lowestCards[lowestCards.length - 1] + 1) {
      lowestCards.push(player.hand.shift());
    }
    lowestCards.map((card) => {
      return {card: card, playerId: playerId }
    });
    this.public.pile.push(...lowestCards)
    player.handSize = player.hand.length;

    // CHECK FOR MISFIRES HERE
  }
}

module.exports = Gamestate;