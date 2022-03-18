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

  // Configure Gamestate
  // TODO DECK SIZE

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
    return this.players.splice(playerIndex);
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
    if (this.private.deck.length > (this.meta.round + 1) * this.players.length) {
      this.meta.round++;
      this.players.forEach((player) => {
        player.hand = this.private.deck.splice(0, this.meta.round);
        player.hand.sort((a, b) => { return a - b });
        player.handSize = player.hand.length;
      });
      this.public.remaining = this.private.deck.length;
    } else {
      // Not Enough Cards - End The Game Here! You WIN!
      this.meta.phase = 'won';
    }
  }

  async playCard(playerId) {
    // Find active player
    let activePlayerIndex = this.players.findIndex((player) => {
      return player.playerId == playerId;
    });
    let activePlayer = this.players[activePlayerIndex];
    let lowestCards = [{ time: new Date().toISOString(), card: activePlayer.hand.shift(), playerIndex: activePlayerIndex }];
    while (activePlayer.hand[0] == lowestCards[lowestCards.length - 1].card + 1) {
      lowestCards.push({ time: new Date().toISOString(), card: activePlayer.hand.shift(), playerIndex: activePlayerIndex });
    }
    activePlayer.handSize = activePlayer.hand.length;
    this.public.pile.push(...lowestCards);

    // Check for missed cards
    let missedCards = [];
    this.players.forEach((player, playerIndex) => {
      console.log(player)
      if (player.playerId != activePlayer.playerId) {
        while (player.hand[0] < lowestCards[0].card) {
          missedCards.push({ time: new Date().toISOString(), card: player.hand.shift(), playerIndex: playerIndex, missed: true })
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
      }
    }
  }

  async restartGame() {
    this.meta = {
      phase: 'open',
      round: 0,
    };
    this.public = {
      pile: [],
      lives: 3,
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