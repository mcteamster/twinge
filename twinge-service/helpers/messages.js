const AWS = require("aws-sdk");
const connections = require('../helpers/connections');
const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: `https://${process.env.HOSTNAME}`,
});

async function send(connectionId, payload) {
  await apigatewaymanagementapi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(payload) }).promise();
};

async function broadcastGame(game) {
  let connectedPlayers = await connections.findConnections('gameId', game.gameId);
  // Only reveal relevant information to each player
  delete game.gamestate.private;
  const messagePromises = connectedPlayers.map(connectedPlayer => {
    let filteredGame = JSON.parse(JSON.stringify(game));
    filteredGame.gamestate.players = filteredGame.gamestate.players.map((player) => {
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

module.exports = {
  send: send,
  broadcastGame: broadcastGame,
};
