const hash = require('object-hash');
const {
  DynamoDBDocument
} = require("@aws-sdk/lib-dynamodb"),
  {
    DynamoDB
  } = require("@aws-sdk/client-dynamodb");
const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: false, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: false, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: true, // false, by default.
};
const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false, // false, by default.
};
const translateConfig = { marshallOptions, unmarshallOptions };
const dynamoDbClient = DynamoDBDocument.from(new DynamoDB(), translateConfig);
const GAME_TABLE = process.env.GAME_TABLE;

async function createGame(gameId, gamestate) {
  function makeCode() {
    const validChars = "BCDFGHJKLMNPQRSTVWXZ"; // No vowels to avoid spelling words
    let codeChars = [
      validChars[Math.floor((Math.random() * 20))],
      validChars[Math.floor((Math.random() * 20))],
      validChars[Math.floor((Math.random() * 20))],
      validChars[Math.floor((Math.random() * 20))],
    ]
    return codeChars.join('');
  }
  let roomCode = makeCode();
  let regenCount = 0;
  while (regenCount < 100 && (await findGames("roomCode", roomCode)).length > 0) {
    roomCode = makeCode();
    retries++;
  }
  if (regenCount >= 100) {
    return 400
  }

  let currentTime = new Date();
  let expiryTimeEpoch = new Date().setHours(currentTime.getHours() + 12) / 1000;
  const params = {
    TableName: GAME_TABLE,
    Item: {
      gameId: gameId,
      createTime: currentTime.toISOString(),
      expiryTimeEpoch: expiryTimeEpoch,
      roomCode: roomCode,
      gamestate: gamestate,
      stateHash: hash.MD5(JSON.stringify(gamestate)),
    },
  };

  try {
    await dynamoDbClient.put(params);
    return params.Item;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function readGame(gameId) {
  const params = {
    TableName: GAME_TABLE,
    Key: {
      gameId: gameId,
    },
  };

  try {
    return (await dynamoDbClient.get(params)).Item;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function findGames(queryKey, queryValue) {
  const params = {
    TableName: GAME_TABLE,
    IndexName: queryKey,
    KeyConditionExpression: "#queryKey = :queryValue",
    ExpressionAttributeNames: {
      "#queryKey": queryKey,
    },
    ExpressionAttributeValues: {
      ":queryValue": queryValue,
    }
  };

  try {
    return (await dynamoDbClient.query(params)).Items;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function updateGame(gameId, gamestate) {
  const params = {
    TableName: GAME_TABLE,
    Key: {
      gameId: gameId,
    },
    UpdateExpression: "set gamestate = :gamestate, stateHash = :stateHash",
    ExpressionAttributeValues: {
      ":gamestate": gamestate,
      ":stateHash": hash.MD5(JSON.stringify(gamestate)),
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    return (await dynamoDbClient.update(params)).Attributes;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function deleteGame(gameId) {
  const params = {
    TableName: GAME_TABLE,
    Key: {
      gameId: gameId,
    },
  };

  try {
    await dynamoDbClient.delete(params);
    return 200
  } catch (error) {
    console.log(error);
    return 500
  }
}

module.exports = {
  createGame,
  readGame,
  findGames,
  updateGame,
  deleteGame,
}