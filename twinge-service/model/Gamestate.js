const Player = require('../model/Player');

class Gamestate {
  constructor(gamestate) {
    // Default Gamestate
    if (!gamestate) {
      gamestate = {
        config: {
          deckSize: 100,
        },
        meta: {
          phase: 'open',
          round: 0
        },
        players: [],
        private: {
          deck: [],
        },
        public: {
          pile: [],
          lives: 3,
          remaining: 100,
        }
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
    while (lowestCards[lowestCards.length - 1] == player.hand[0] - 1) {
      lowestCards.push(player.hand.shift());
    }
    lowestCards.map((card) => {
      return {card: card, playerId: playerId }
    });
    this.public.pile.push(...lowestcards)

    // CHECK FOR MISFIRES HERE
  }
}

module.exports = Gamestate;