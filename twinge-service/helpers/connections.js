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
    return await dynamoDbClient.get(params).promise();
  } catch (error) {
    console.log(error);
    return 500
  }
}

async function updateConnection(connectionId, gamestateId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
    UpdateExpression: "set gamestateId = :gamestateId",
    ExpressionAttributeValues: {
      ":gamestateId": gamestateId,
    },
    ReturnValues: "ALL_NEW"
  };

  try {
    return await dynamoDbClient.update(params).promise();
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
  updateConnection,
  deleteConnection,
}