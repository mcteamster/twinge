const AWS = require("aws-sdk");
const Guid = require('guid');
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const CONNECTION_TABLE = process.env.CONNECTION_TABLE;
const GAMESTATE_TABLE = process.env.GAMESTATE_TABLE;

async function updateConnection(connectionId, gamestateId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
    UpdateExpression: "set gamestateId = :gamestateId",
    ExpressionAttributeValues:{
        ":gamestateId": gamestateId,
    },
    ReturnValues:"UPDATED_NEW"
  };

  try {
    await dynamoDbClient.update(params).promise();
    return 200
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function updateGamestate(gamestateId, connectionId) {
  const params = {
    TableName: GAMESTATE_TABLE,
    Key: {
      gamestateId: gamestateId,
    },
    UpdateExpression: "set gamestateId = :gamestateId",
    ExpressionAttributeValues:{
        ":gamestateId": gamestateId,
    },
    ReturnValues:"UPDATED_NEW"
  };

  try {
    await dynamoDbClient.update(params).promise();
    return 200
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function createGame({connectionId, gamestateId}) {
  // Link gamestate to connection
  // Create new gamestate
  gamestateId = String(Guid.create());
  await updateConnection(connectionId, gamestateId);
  return;
}

async function joinGame({connectionId, gamestateId}) {
  // Link gamestate to connection
  // Update gamestate

}

async function leaveGame({connectionId, gamestateId}) {
  // Unlink gamestate from connection
  // Update gamestate

}

const actionHandler = {
  create: createGame,
  join: joinGame,
  leave: leaveGame,
}

module.exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);
  const actionType = body.actionType;
  let lobbyInfo = {
    connectionId: event.requestContext.connectionId,
    gamestateId: body.gamestateId,
  }
  await actionHandler[actionType](lobbyInfo);
  return {
    statusCode: 200,
    body: JSON.stringify(lobbyInfo),
  };
};
