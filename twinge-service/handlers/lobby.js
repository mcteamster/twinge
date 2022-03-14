const connections = require('../helpers/connections');
const games = require('../helpers/games');
const Gamestate = require('../model/Gamestate');
const Player = require('../model/Player');
const Guid = require('guid');

async function newGame(lobby) {
  // Link gamestate to connection
  lobby.gameId = String(Guid.create());
  await connections.updateConnection(lobby.connectionId, lobby.gameId);

  // Create new gamestate
  let gamestate = new Gamestate();
  await gamestate.addPlayer(new Player(lobby.connectionId));
  lobby.game = await games.createGame(lobby.gameId, gamestate);
  return;
}

async function joinGame(lobby) {
  // Find game
  let game = null;
  if (lobby.roomCode) {
    game = (await games.findGame("roomCode", lobby.roomCode))[0];
  } else if (lobby.gameId) {
    game = await games.readGame(lobby.gameId);
  }

  if (game.gamestate) {
    let gamestate = new Gamestate(game.gamestate);
    if (lobby.playerId) {
      // Rejoin
      // Check if already in game, update connectionId
    } else {
      // Join
      await gamestate.addPlayer(new Player({connectionId: lobby.connectionId}));
    }

    // Link gamestate to connection
    await connections.updateConnection(lobby.connectionId, game.gameId);
    // Update gamestate
    lobby.game = await games.updateGame(lobby.gameId, gamestate);
  } else {
    lobby.game = null;
    lobby.errors.push('Game not found')
  }

  // Blast out to every player
  return;
}

async function leaveGame(lobby) {
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
  let lobby = {
    connectionId: event.requestContext.connectionId,
    gameId: body.gameId,
    playerId: body.playerId,
    roomCode: body.roomCode,
    errors: [],
  }
  await actionHandler[actionType](lobby);
  return {
    statusCode: 200,
    body: JSON.stringify(lobby),
  };
};
