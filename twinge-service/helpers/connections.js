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
    await dynamoDbClient.put(params);
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
    return (await dynamoDbClient.get(params)).Item;
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

async function updateConnection(connectionId, updateKey, updateValue) {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
    UpdateExpression: "set #updateKey = :updateValue",
    ExpressionAttributeNames: {
      "#updateKey": updateKey,
    },
    ExpressionAttributeValues: {
      ":updateValue": updateValue,
    },
    ReturnValues: "ALL_NEW"
  };

  try {
    return (await dynamoDbClient.update(params)).Attributes;
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
    await dynamoDbClient.delete(params);
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