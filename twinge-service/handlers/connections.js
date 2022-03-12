// create and delete websocket connections
const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const CONNECTION_TABLE = process.env.CONNECTION_TABLE;

async function createConnection(connectionId) {
  const params = {
    TableName: CONNECTION_TABLE,
    Item: {
      connectionId: connectionId,
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

exports.handler = async (event, context, callback) => {
  const connectionId = event.requestContext.connectionId;
  const eventType = event.requestContext.eventType;
  let statusCode = 200;

  if(eventType == 'CONNECT') {
    statusCode = await createConnection(connectionId);
  } else if(eventType == 'DISCONNECT') {
    statusCode = await deleteConnection(connectionId);
  }

  callback(null, {
      statusCode: statusCode,
    }
  );
}