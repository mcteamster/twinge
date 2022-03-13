const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const GAMESTATE_TABLE = process.env.GAMESTATE_TABLE;

async function createGamestate(gamestateId, gamestate) {
  const params = {
    TableName: GAMESTATE_TABLE,
    Item: {
      gamestateId: gamestateId,
      createTime: new Date().toISOString(),
      roomCode: 'ABCD', // Generate This Randomly
      gamestate: gamestate,
    },
  };

  try {
    await dynamoDbClient.put(params).promise();
    return params.Item;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function readGamestate(gamestateId) {
  const params = {
    TableName: GAMESTATE_TABLE,
    Key: {
      gamestateId: gamestateId,
    },
  };

  try {
    return (await dynamoDbClient.get(params).promise()).Item;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function updateGamestate(gamestateId, gamestate) {
  const params = {
    TableName: GAMESTATE_TABLE,
    Key: {
      gamestateId: gamestateId,
    },
    UpdateExpression: "set gamestate = :gamestate",
    ExpressionAttributeValues: {
      ":gamestate": gamestate,
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    return await dynamoDbClient.update(params).promise();
  } catch (error) {
    console.log(error);
    return 500
  }
}

module.exports = {
  createGamestate,
  readGamestate,
  updateGamestate,
}