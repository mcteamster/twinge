import connections from '../helpers/connections';
import games from '../helpers/games';
import messages from '../helpers/messages';
import Gamestate from '../model/Gamestate';
import Player from '../model/Player';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionRecord, GameConfig, GameRecord, LambdaEvent, LambdaResult } from '../types';

/** Fields extracted from the WebSocket message body plus connection metadata. */
interface Payload {
  connectionId: string;
  gameId?: string | null;
  playerId?: string | null;
  roomCode?: string;
  stateHash?: string;
  name?: string;
  config?: GameConfig;
  target?: number;
  game?: GameRecord | number;
}

// Mutable deps object — allows unit tests to replace constructors and helpers
// without patching node_modules. Production code always uses the real modules.
// Access deps through this object in every action function so vi.spyOn works.
const _deps = { connections, games, messages, Gamestate, Player, uuidv4 };

/** Narrows a readGame/findGames result to a usable GameRecord with a gamestate. */
function isGameRecord(game: GameRecord | number | undefined): game is GameRecord & { gamestate: NonNullable<GameRecord['gamestate']> } {
  return typeof game === 'object' && game !== null && 'gamestate' in game && !!game.gamestate;
}

/** Casts updateGame/createGame result to GameRecord — only call when the game is known to exist. */
function toRecord(game: GameRecord | number | undefined): GameRecord {
  if (typeof game !== 'object' || game === null) {
    throw new Error('Expected GameRecord but got error code');
  }
  return game;
}

// Lobby Handlers
async function newGame(payload: Payload): Promise<void> {
  // Create new game
  const gameId = _deps.uuidv4();
  const gamestate = new _deps.Gamestate({ config: payload.config });
  payload.playerId = await gamestate.addPlayer(new _deps.Player());
  payload.game = await _deps.games.createGame(gameId, gamestate);

  // Link game and player to connection
  await _deps.connections.updateConnection(payload.connectionId, 'gameId', gameId);
  await _deps.connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);

  // Respond to creator
  await _deps.messages.send(payload.connectionId, payload.game);
}

async function rejoinGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  // Resolve playerId from the connection record rather than trusting the
  // client-supplied body value. A client who observed another player's UUID
  // could otherwise impersonate them on rejoin (IDOR). If the connection has
  // no stored playerId, fall back to the body value so a brand-new connection
  // can still provide one on first rejoin; subsequent reconnects will always
  // use the server-stored value.
  const connectionRecord = await _deps.connections.readConnection(payload.connectionId);
  if (typeof connectionRecord === 'object' && connectionRecord?.playerId && connectionRecord.playerId !== '-1') {
    payload.playerId = connectionRecord.playerId;
  }
  if (payload.gameId && payload.playerId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game)) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      const player = await gamestate.findPlayer(payload.playerId);
      if (player) {
        // Update connection mapping for rejoining player
        await _deps.connections.updateConnection(payload.connectionId, 'gameId', payload.gameId);
        await _deps.connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);

        // Update connection status and send current state
        const conns = await _deps.connections.findConnections('gameId', payload.gameId); gamestate.checkConnections(Array.isArray(conns) ? conns : []);
        const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'Missing gameId or playerId' });
  }
}

async function joinGame(payload: Payload): Promise<void> {
  // Find game
  let game: GameRecord | number | undefined;
  if (payload.roomCode) {
    const foundGames = await _deps.games.findGames('roomCode', payload.roomCode.toUpperCase()); game = Array.isArray(foundGames) ? foundGames[0] : undefined;
  } else if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
  }

  if (isGameRecord(game)) {
    // Rehydrate gamestate
    const gamestate = new _deps.Gamestate(game.gamestate);
    // Join — always create a server-assigned player; any client-supplied
    // playerId is discarded unconditionally to prevent identity impersonation
    // (IDOR). Discard here, before any use, so it cannot be used even when
    // the game is not in an open/playing phase.
    payload.playerId = null;
    if (gamestate.meta.phase == 'open' || gamestate.meta.phase == 'playing') {
      // Enforce the active-player cap before adding a new player.
      if (gamestate.activePlayerCount >= (gamestate.config.maxPlayers as number)) {
        await _deps.messages.send(payload.connectionId, { code: 8, message: 'Game is full' });
        return;
      }
      payload.playerId = await gamestate.addPlayer(new _deps.Player());
    }
    if (await gamestate.findPlayer(payload.playerId as string)) {
      // Link game and player to connection
      await _deps.connections.updateConnection(payload.connectionId, 'gameId', game.gameId);
      await _deps.connections.updateConnection(payload.connectionId, 'playerId', payload.playerId);
      // Update gamestate
      const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
      await _deps.messages.broadcastGame(toRecord(game));
    } else {
      await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
  }
}

async function renamePlayer(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game)) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      // Rename
      if (gamestate.meta.phase == 'open' && payload.playerId) {
        const player = await gamestate.findPlayer(payload.playerId);
        await player!.rename(String(payload.name).toUpperCase());
        const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  }
}

async function kickPlayer(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game)) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      // Kick
      if (payload.playerId) {
        const targetPlayer = gamestate.players[payload.target as number];
        if (targetPlayer.playerId) {
          if (targetPlayer.playerId !== payload.playerId) {
            // Two Strike Kick
            if (targetPlayer.strikes == 0) {
              targetPlayer.strikes++;
              if (game.stateHash === payload.stateHash) {
                const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
                await _deps.messages.broadcastGame(toRecord(game));
              } else {
                await _deps.messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
              }
            } else {
              const newPayload = { ...payload };
              newPayload.playerId = targetPlayer.playerId;
              const connResult = await _deps.connections.findConnections('gameId', payload.gameId); const connectedPlayers = Array.isArray(connResult) ? connResult : [] as ConnectionRecord[];
              newPayload.connectionId = connectedPlayers.find((connectedPlayer) => {
                if (connectedPlayer.playerId === targetPlayer.playerId) {
                  return true;
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
              const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
              await _deps.messages.broadcastGame(toRecord(game));
            } else {
              await _deps.messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
            }
          }
        } else {
          await _deps.messages.send(payload.connectionId, { code: 7, message: 'Target not found' });
        }
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  }
}

async function leaveGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game)) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId as string)) {
        await gamestate.kickPlayer(payload.playerId as string);
        if (payload.connectionId) {
          await _deps.connections.updateConnection(payload.connectionId, 'gameId', '-1');
          await _deps.connections.updateConnection(payload.connectionId, 'playerId', '-1');
        }
        if (gamestate.players.length > 0) {
          if (game.stateHash === payload.stateHash) {
            const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
          } else {
            await _deps.messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
          }
          await _deps.messages.broadcastGame(toRecord(game));
        } else {
          await _deps.games.deleteGame(game.gameId);
        }
        await _deps.messages.send(payload.connectionId, {
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
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function startGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game) && game.gamestate.meta.phase == 'open') {
      const gamestate = new _deps.Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId as string)) {
        gamestate.setupGame();
        gamestate.setupRound();
        const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function refreshGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game)) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId as string)) {
        // No-Op
        const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

// In-Game Handlers
async function twinge(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game) && ((game.gamestate.meta.phase == 'playing') || (game.gamestate.meta.phase == 'lost') || (game.gamestate.meta.phase == 'won'))) {
      const gamestate = new _deps.Gamestate(game.gamestate);
      const activePlayer = await gamestate.findPlayer(payload.playerId as string);
      if (activePlayer) {
        if (activePlayer.handSize > 0) {
          gamestate.playCard(payload.playerId as string);
          const conns = await _deps.connections.findConnections('gameId', payload.gameId); gamestate.checkConnections(Array.isArray(conns) ? conns : []);
          // Read game to check stateHash matches before writing
          game = await _deps.games.readGame(payload.gameId);
          if (isGameRecord(game) && game.stateHash === payload.stateHash) {
            const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
            await _deps.messages.broadcastGame(toRecord(game));
          } else {
            // Do not broadcast stale state — the client will receive the
            // current game state on its next refresh or from another player's move.
            await _deps.messages.send(payload.connectionId, { code: 5, message: 'State is stale' });
          }
        } else {
          await _deps.messages.send(payload.connectionId, { code: 4, message: 'Hand is empty' });
        }
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function nextRound(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game) && game.gamestate.meta.phase == 'playing') {
      const gamestate = new _deps.Gamestate(game.gamestate);
      const activePlayer = await gamestate.findPlayer(payload.playerId as string);
      if (activePlayer) {
        // Check for remaining cards
        if (gamestate.players.reduce((playerCards, player) => { return playerCards + player.hand.length }, 0) == 0) {
          gamestate.setupRound();
          const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
          await _deps.messages.broadcastGame(toRecord(game));
        } else {
          await _deps.messages.send(payload.connectionId, { code: 6, message: 'Round in progress' });
        }
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function restartGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game) && game.gamestate.meta.phase != 'open') {
      const gamestate = new _deps.Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId as string)) {
        await gamestate.restartGame();
        const updatedGame = await _deps.games.updateGame(game.gameId, gamestate); game = updatedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

async function endGame(payload: Payload): Promise<void> {
  let game: GameRecord | number | undefined;
  if (payload.gameId) {
    game = await _deps.games.readGame(payload.gameId);
    if (isGameRecord(game) && game.gamestate.meta.phase != 'open') {
      const gamestate = new _deps.Gamestate(game.gamestate);
      if (await gamestate.findPlayer(payload.playerId as string)) {
        await _deps.games.deleteGame(game.gameId);
        // Cleanse Game
        const closedGame: GameRecord = {
          gameId: payload.gameId ?? '',
          roomCode: null,
          gamestate: {
            config: { deckSize: 0, maxLives: 0 },
            meta: { phase: 'closed', round: 0 },
            public: { pile: [], lives: 0, remaining: 0 },
            players: [],
            private: { deck: [] },
          },
        };
        game = closedGame;
        await _deps.messages.broadcastGame(toRecord(game));
      } else {
        await _deps.messages.send(payload.connectionId, { code: 3, message: 'Player not found' });
      }
    } else {
      await _deps.messages.send(payload.connectionId, { code: 2, message: 'Open game not found' });
    }
  } else {
    await _deps.messages.send(payload.connectionId, { code: 1, message: 'No gameId provided' });
  }
}

type ActionFn = (payload: Payload) => Promise<void>;

// Codes 8 and 9 are RESERVED for handler-level errors and MUST NOT be reused by
// action functions: 8 = unexpected internal error (top-level catch),
// 9 = unknown or missing action type (dispatch guard). Codes 1–7 remain the
// per-action error semantics owned by the action functions above.
const actionHandler: Record<string, ActionFn> = {
  new: newGame,
  join: joinGame,
  rejoin: rejoinGame,
  rename: renamePlayer,
  kick: kickPlayer,
  leave: leaveGame,
  start: startGame,
  refresh: refreshGame,
  twinge: twinge,
  next: nextRound,
  restart: restartGame,
  end: endGame,
};

const handler = async (event: LambdaEvent): Promise<LambdaResult> => {
  let payload: Payload | undefined;
  try {
    const body = JSON.parse(event.body as string) as {
      actionType: string;
      gameId?: string;
      playerId?: string;
      roomCode?: string;
      stateHash?: string;
      name?: string;
      config?: GameConfig;
      target?: number;
    };
    const actionType = body.actionType;
    payload = {
      connectionId: event.requestContext.connectionId,
      gameId: body.gameId,
      playerId: body.playerId,
      roomCode: body.roomCode,
      stateHash: body.stateHash,
      name: body.name,
      config: body.config,
      target: body.target,
    };
    // Guard against unknown or missing action types: calling
    // actionHandler[actionType] when it is undefined throws a TypeError that
    // would crash the Lambda invocation (see design.md).
    // Object.hasOwn is used instead of `in` to avoid matching prototype-chain
    // keys (e.g. 'constructor', '__proto__', 'valueOf') which pass an `in`
    // check but are not ActionFn entries — those would silently misfire or
    // throw a wrong-code error rather than returning code 9 as required.
    if (!Object.hasOwn(actionHandler, actionType)) {
      await _deps.messages.send(payload.connectionId, { code: 9, message: 'Unknown action type' });
      return {
        statusCode: 200,
        body: JSON.stringify({ code: 9, message: 'Unknown action type' }),
      };
    }
    await actionHandler[actionType](payload);
    return {
      statusCode: 200,
      body: JSON.stringify({ code: 0, message: 'ack' }),
    };
  } catch (error) {
    // Preserve the stack trace in CloudWatch, then return a structured error
    // instead of letting the exception propagate to the Lambda runtime.
    console.error(error);
    await _deps.messages.send(payload?.connectionId ?? event.requestContext.connectionId, { code: 8, message: 'Internal server error' });
    return {
      statusCode: 200,
      body: JSON.stringify({ code: 8, message: 'Internal server error' }),
    };
  }
};

export = {
  handler,
  // Exposed for unit testing only — allows tests to spy on or replace injected
  // dependencies (helpers and model constructors) without mocking node_modules.
  // Not used in production Lambda execution.
  _testDeps: _deps,
};
