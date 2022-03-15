const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const CONNECTION_TABLE = process.env.CONNECTION_TABLE;

async function createConnection(connectionId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Item: {
      connectionId: connectionId,
      createTime: new Date().toISOString(),
    },
  };

  try {
    await dynamoDbClient.put(params).promise();
    return 200
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function readConnection(connectionId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    return (await dynamoDbClient.get(params).promise()).Item;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function findConnections(queryKey, queryValue) {
  const params = {
    TableName: CONNECTION_TABLE,
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

async function updateConnection(connectionId, updateKey, updateValue) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
    UpdateExpression: "set #updateKey = :updateValue",
    ExpressionAttributeNames:{
      "#updateKey": updateKey,
    },
    ExpressionAttributeValues: {
      ":updateValue": updateValue,
    },
    ReturnValues: "ALL_NEW"
  };

  try {
    return (await dynamoDbClient.update(params).promise()).Attributes;
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function deleteConnection(connectionId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
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
  createConnection,
  readConnection,
  findConnections,
  updateConnection,
  deleteConnection,
}