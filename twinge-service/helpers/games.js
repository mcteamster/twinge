const hash = require('object-hash');
const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const GAME_TABLE = process.env.GAME_TABLE;

async function createGame(gameId, gamestate) {
  function makeCode() {
    let codeChars = [
      Math.floor((Math.random()*26))+65,
      Math.floor((Math.random()*26))+65,
      Math.floor((Math.random()*26))+65,
      Math.floor((Math.random()*26))+65
    ]
    return String.fromCharCode(...codeChars);
  }
  let roomCode = makeCode();
  let regenCount = 0;
  while(regenCount < 100 && (await findGames("roomCode", roomCode)).length > 0 ) {
    roomCode = makeCode();
    retries++;
  }
  if (regenCount >= 100 ) {
    return 400
  }

  let currentTime = new Date();
  let expiryTimeEpoch = new Date().setHours(currentTime.getHours() + 12)/1000;
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
    await dynamoDbClient.put(params).promise();
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
    return (await dynamoDbClient.get(params).promise()).Item;
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
    ExpressionAttributeNames:{
      "#queryKey": queryKey,
    },
    ExpressionAttributeValues: {
      ":queryValue": queryValue,
    }
  };

  try {
    return (await dynamoDbClient.query(params).promise()).Items;
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
    return (await dynamoDbClient.update(params).promise()).Attributes;
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
    await dynamoDbClient.delete(params).promise();
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