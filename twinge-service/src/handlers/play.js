const connections = require('../helpers/connections');
const games = require('../helpers/games');
const messages = require('../helpers/messages');
const Gamestate = require('../model/Gamestate');
const Player = require('../model/Player');
const { v4: uuidv4 } = require('uuid');

// Lobby Handlers
async function newGame(payload) {
  // Create new game
  let gameId = uuidv4();
  let gamestate = new Gamestate({config: payload.config});
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
    game = (await games.findGames("roomCode", payload.roomCode.toUpperCase()))[0];
  } else if (payload.gameId) {
    game = await games.readGame(payload.gameId);
  }

  if (game && game.gamestate) {
    // Rehydrate gamestate
    let gamestate = new Gamestate(game.gamestate);
    // Join
    if ((gamestate.meta.phase == 'open' || gamestate.meta.phase == 'playing') && (!payload.playerId || !(await gamestate.findPlayer(payload.playerId)))) {
      payload.playerId = await gamestate.addPlayer(new Player());
    }
    if (await gamestate.findPlayer(payload.playerId)) {
      // Link game and player to connection
      await connections.updateConnection(payload.connectionId, 'gameId', game.gameId);
      await connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);
      // Update gamestate
      game = await games.updateGame(game.gameId, gamestate);
      await messages.broadcastGame(game);
    } else {
      await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
  }
}

async function renamePlayer(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate) {
      let gamestate = new Gamestate(game.gamestate);
      // Rename
      if (gamestate.meta.phase == 'open' && payload.playerId) {
        let player = await gamestate.findPlayer(payload.playerId);
        await player.rename(String(payload.name).toUpperCase());
        game = await games.updateGame(game.gameId, gamestate);
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  }
}

async function kickPlayer(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate) {
      let gamestate = new Gamestate(game.gamestate);
      // Kick
      if (payload.playerId) {
        let targetPlayer = gamestate.players[payload.target];
        if (targetPlayer.playerId) {
          if (targetPlayer.playerId !== payload.playerId) {
            // Two Strike Kick
            if (targetPlayer.strikes == 0) {
              targetPlayer.strikes++;
              if (game.stateHash === payload.stateHash) {
                game = await games.updateGame(game.gameId, gamestate);
              } else {
                await messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
              }
              await messages.broadcastGame(game);
            } else {
              let newPayload = { ...payload };
              newPayload.playerId = targetPlayer.playerId;
              let connectedPlayers = await connections.findConnections('gameId', payload.gameId)
              newPayload.connectionId = connectedPlayers.find((connectedPlayer) => {
                if (connectedPlayer.playerId == targetPlayer.playerId) {
                  return true
                }
              })?.connectionId;
              await leaveGame(newPayload);
            }
          } else {
            // Self-Kick turns you into a spectator
            if (targetPlayer.strikes == -1) {
              // If spectating, resume playing from next round
              targetPlayer.strikes = 0;
            } else {
              // This means you will not be dealt cards, and will be kicked if anyone warns you
              targetPlayer.strikes = -1; 
            }
            if (game.stateHash === payload.stateHash) {
              game = await games.updateGame(game.gameId, gamestate);
            } else {
              await messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
            }
            await messages.broadcastGame(game);
          }
        } else {
          await messages.send(payload.connectionId, { code: 7, message: 'Target not found' });
        }
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  }
}

async function leaveGame(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate) {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        await gamestate.kickPlayer(payload.playerId);
        if (payload.connectionId) {
          await connections.updateConnection(payload.connectionId, 'gameId', '-1');
          await connections.updateConnection(payload.connectionId, 'playerId', '-1');
        }
        if (gamestate.players.length > 0) {
          if (game.stateHash === payload.stateHash) {
            game = await games.updateGame(game.gameId, gamestate);
          } else {
            await messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
          }
          await messages.broadcastGame(game);
        } else {
          await games.deleteGame(game.gameId);
        }
        await messages.send(payload.connectionId, {
          gameId: null,
          roomCode: null,
          createTime: null,
          gamestate: {
            meta: {
              phase: 'closed',
            },
            players: [],
          },
        });
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function startGame(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase == 'open') {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        gamestate.setupGame();
        gamestate.setupRound();
        game = await games.updateGame(game.gameId, gamestate);
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function refreshGame(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate) {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        // No-Op
        game = await games.updateGame(game.gameId, gamestate);
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

// In-Game Handlers
async function twinge(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && ((game.gamestate.meta.phase == 'playing') || (game.gamestate.meta.phase == 'lost') || (game.gamestate.meta.phase == 'won'))) {
      let gamestate = new Gamestate(game.gamestate);
      let activePlayer = await gamestate.findPlayer(payload.playerId);
      if (activePlayer) {
        if (activePlayer.handSize > 0) {
          gamestate.playCard(payload.playerId);
          gamestate.checkConnections(await connections.findConnections('gameId', payload.gameId));
          // Read game to check stateHash matches before writing
          game = await games.readGame(payload.gameId); 
          if (game.stateHash === payload.stateHash) {
            game = await games.updateGame(game.gameId, gamestate);
          } else {
            await messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
          }
          await messages.broadcastGame(game);
        } else {
          await messages.send(payload.connectionId, { code: 4, message: 'Hand is empty' });
        }
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }   
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function nextRound(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase == 'playing') {
      let gamestate = new Gamestate(game.gamestate);
      let activePlayer = await gamestate.findPlayer(payload.playerId);
      if (activePlayer) {
        // Check for remaining cards
        if (gamestate.players.reduce((playerCards, player) => { return playerCards += player.hand.length }, 0) == 0) {
          gamestate.setupRound();
          game = await games.updateGame(game.gameId, gamestate);
          await messages.broadcastGame(game);
        } else {
          await messages.send(payload.connectionId, { code: 6, message: 'Round in progress' });
        }
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function restartGame(payload) {
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
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function endGame(payload) {
  let game = null;
  if (payload.gameId) {
    game = await games.readGame(payload.gameId);
    if (game && game.gamestate && game.gamestate.meta.phase != 'open') {
      let gamestate = new Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId)) {
        await games.deleteGame(game.gameId);
        // Cleanse Game
        game = {
          gameId: payload.gameId,
          roomCode: null,
          gamestate: {
            meta: {
              phase: 'closed',
            },
            players: [],
          }
        }
        await messages.broadcastGame(game);
      } else {
        await messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

const actionHandler = {
  new: newGame,
  join: joinGame,
  rename: renamePlayer,
  kick: kickPlayer,
  leave: leaveGame,
  start: startGame,
  refresh: refreshGame,
  twinge: twinge,
  next: nextRound,
  restart: restartGame,
  end: endGame,
}

module.exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const actionType = body.actionType;
  let payload = {
    connectionId: event.requestContext.connectionId,
    gameId: body.gameId,
    playerId: body.playerId,
    roomCode: body.roomCode,
    stateHash: body.stateHash,
    name: body.name,
    config: body.config,
    target: body.target,
  }
  await actionHandler[actionType](payload);
  return {
    statusCode: 200,
    body: JSON.stringify({ code: 0, message: 'ack' }),
  };
};
