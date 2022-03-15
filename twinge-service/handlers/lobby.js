const connections = require('../helpers/connections');
const games = require('../helpers/games');
const messages = require('../helpers/messages');
const Gamestate = require('../model/Gamestate');
const Player = require('../model/Player');
const Guid = require('guid');

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
    // Join or rejoin if already in the game
    if (!payload.playerId || !gamestate.players.find((player) => { return player.playerId == payload.playerId })) {
      payload.playerId = await gamestate.addPlayer(new Player());
    }
    // Link game and player to connection
    await connections.updateConnection(payload.connectionId, 'gameId', game.gameId);
    await connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);
    // Update gamestate
    game = await games.updateGame(game.gameId, gamestate);
    // Blast out to every player
    await messages.broadcastGame(game);
  } else {
    // Send Error
    await messages.send(payload.connectionId, { message: 'Game not found' });
  }
}

async function leaveGame(payload) {
  // Unlink gamestate from connection
  // Update gamestate

}

const actionHandler = {
  new: newGame,
  join: joinGame,
  leave: leaveGame,
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
