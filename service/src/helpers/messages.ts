import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';
import connections from './connections';
import type { ConnectionRecord, GameRecord } from '../types';

const apigatewaymanagementapi = new ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: (process.env.GATEWAY_ENDPOINT as string).replace('wss://', 'https://'),
});

async function send(connectionId: string | undefined, payload: unknown): Promise<void> {
  if (connectionId) {
    await apigatewaymanagementapi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(payload) });
  }
}

async function broadcastGame(game: GameRecord): Promise<void> {
  let connectedPlayers = (await connections.findConnections('gameId', game.gameId)) as ConnectionRecord[];
  // Only reveal relevant information to each player
  delete (game.gamestate as any).private;
  const messagePromises = connectedPlayers.map((connectedPlayer) => {
    let filteredGame = JSON.parse(JSON.stringify(game));
    filteredGame.gamestate.players = filteredGame.gamestate.players.map((player: any) => {
      if (player.playerId != connectedPlayer.playerId) {
        delete player.playerId;
        delete player.hand;
      }
      return player;
    });
    return send(connectedPlayer.connectionId, filteredGame);
  });
  await Promise.all(messagePromises);
}

export = {
  send: send,
  broadcastGame: broadcastGame,
};
