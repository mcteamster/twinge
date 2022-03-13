const connections = require('../helpers/connections');
const gamestates = require('../helpers/gamestates');
const Guid = require('guid');
const Game = require('../model/Game');
const Player = require('../model/Player');

async function createGame(lobbyInfo) {
  // Link gamestate to connection
  lobbyInfo.gamestateId = String(Guid.create());
  await connections.updateConnection(lobbyInfo.connectionId, lobbyInfo.gamestateId);

  // Create new gamestate
  let gamestate = new Game();
  await gamestate.addPlayer(new Player(lobbyInfo.connectionId));
  lobbyInfo.game = await gamestates.createGamestate(lobbyInfo.gamestateId, gamestate);
  return;
}

async function joinGame(lobbyInfo) {
  // Check for existing gamestate
  // Join by roomCode (new), or gamestateId (saved) - validate with playerId
  let gamestate = new Game((await gamestates.readGamestate(lobbyInfo.gamestateId)).gamestate);
  console.log(gamestate)
  await gamestate.addPlayer(new Player(lobbyInfo.connectionId));
  if (gamestate) {
    // Link gamestate to connection
    await connections.updateConnection(lobbyInfo.connectionId, lobbyInfo.gamestateId);
    // Update gamestate
    lobbyInfo.game = await gamestates.updateGamestate(lobbyInfo.gamestateId, gamestate);
  } else {
    lobbyInfo.game = null;
  }
  return;
}

async function leaveGame(lobbyInfo) {
  // Unlink gamestate from connection
  // Update gamestate

}

const actionHandler = {
  create: createGame,
  join: joinGame,
  leave: leaveGame,
}

module.exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const actionType = body.actionType;
  let lobbyInfo = {
    connectionId: event.requestContext.connectionId,
    gamestateId: body.gamestateId,
  }
  await actionHandler[actionType](lobbyInfo);
  // Handle Responses and Errors Here
  return {
    statusCode: 200,
    body: JSON.stringify(lobbyInfo),
  };
};
