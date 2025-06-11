const hash = require('object-hash');
const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
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
    const alphabet = "BCDFGHJKLMNPQRSTVWXZ"; // No vowels to avoid spelling words
    let codeChars = [
      alphabet[Math.floor((Math.random() * 20))],
      alphabet[Math.floor((Math.random() * 20))],
      alphabet[Math.floor((Math.random() * 20))]
    ]

    let serverCode;
    // From East to West
    switch (process.env.AWS_REGION) {
      case 'ap-southeast-2':
        serverCode = 'BC'; // Sydney AU 🇦🇺
        break;
      case 'ap-northeast-1':
        serverCode = 'DF'; // Tokyo JP 🇯🇵
        break;
      case 'ap-southeast-1':
        serverCode = 'GH'; // Singapore SG 🇸🇬
        break;
      case 'ap-south-1':
        serverCode = 'JK'; // Mumbai IN 🇮🇳
        break;
      case 'eu-central-1':
        serverCode = 'LM'; // Frankfurt EU 🇪🇺
        break;
      case 'eu-west-1':
        serverCode = 'NP'; // London UK 🇬🇧
        break;
      case 'sa-east-1':
        serverCode = 'QR'; // Sao Paolo BR 🇧🇷
        break;
      case 'us-east-1':
        serverCode = 'ST'; // Washington D.C. US 🇺🇸
        break;
      case 'us-west-2':
        serverCode = 'VW'; // San Francisco US 🇺🇸
        break;
      default:
        serverCode = 'XZ'; // Local or Fallback
    }
    codeChars.push(serverCode.slice(Math.floor((Math.random() * serverCode.length)))[0]) // Allocate a random character from the corresponding server code

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