const connections = require('../helpers/connections');
const games = require('../helpers/games');
const messages = require('../helpers/messages');
const Gamestate = require('../model/Gamestate');
const Player = require('../model/Player');
const Guid = require('guid');

// Lobby Handlers
async function newGame(payload) {
  // Create new game
  let gameId = String(Guid.create());
  let gamestate = new Gamestate();
  payload.playerId = await gamestate.addPlayer(new Player());
  payload.game = await games.createGame(gameId, gamestate);

  // Link game and player to connection
  await connections.updateConnection(payload.connectionId, 'gameId', gameId);
  await connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);

  // Respond to creator
  await messages.send(payload.connectionId, payload.game);
}

async function joinGame(payload) {
  // Find game
  let game = null;
  if (payload.roomCode) {
    game = (await games.findGames("roomCode", payload.roomCode))[0]; // this should be unique
  } else if (payload.gameId) {
    game = await games.readGame(payload.gameId);
  }

  if (game && game.gamestate) {
    // Rehydrate gamestate
    let gamestate = new Gamestate(game.gamestate);
    // Join
    if (gamestate.meta.phase == 'open' && (!payload.playerId || !(await gamestate.findPlayer(payload.playerId)))) {
      payload.playerId = await gamestate.addPlayer(new Player());
    }
    if (await gamestate.findPlayer(payload.playerId)) {
      // Link game and player to connection
      await connections.updateConnection(payload.connectionId, 'gameId', game.gameId);
      await connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);
      // Update gamestate
      game = await games.updateGame(game.gameId, gamestate);
      // Blast out to every player
      await messages.broadcastGame(game);
    } else {
      await messages.send(payload.connectionId, { message: 'Player not found' });
    }
  } else {
    await messages.send(payload.connectionId, { message: 'Game not found' });
  }
}

async function leaveGame(payload) {
  // Unlink gamestate from connection
  // Update gamestate
}

async function startGame(payload) {
  // Update gamestate
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase == 'open') {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        gamestate.setupGame();
        gamestate.nextRound();
        game = await games.updateGame(game.gameId, gamestate);
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { message: 'No gameId provided' });
  }
}

// In-Game Handlers
async function twinge(payload) {
  // Queue Events Somewhere - Debounce? - Filter out noise?
  // Update gamestate
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase == 'playing') {
      let gamestate = new Gamestate(game.gamestate);
      let activePlayer = await gamestate.findPlayer(payload.playerId);
      if (activePlayer) {
        console.log(activePlayer)
        if (activePlayer.handSize > 0) {
          gamestate.playCard(payload.playerId);
          game = await games.updateGame(game.gameId, gamestate);
          await messages.broadcastGame(game);
        } else {
          await messages.send(payload.connectionId, { message: 'Hand is empty' });
        }
      } else {
        await messages.send(payload.connectionId, { message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { message: 'Game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { message: 'No gameId provided' });
  }
}

async function restartGame(payload) {
  // Update gamestate
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase != 'open') {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        gamestate.restartGame();
        game = await games.updateGame(game.gameId, gamestate);
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { message: 'No gameId provided' });
  }
}

const actionHandler = {
  new: newGame,
  join: joinGame,
  leave: leaveGame,
  start: startGame,
  twinge: twinge,
  restart: restartGame,
}

module.exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const actionType = body.actionType;
  let payload = {
    connectionId: event.requestContext.connectionId,
    gameId: body.gameId,
    playerId: body.playerId,
    roomCode: body.roomCode,
  }
  await actionHandler[actionType](payload);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'ack' }),
  };
};