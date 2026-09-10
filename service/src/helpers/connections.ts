import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { ConnectionRecord } from '../types';

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

async function createConnection(connectionId: string): Promise<number> {
  const params = {
    TableName: CONNECTION_TABLE,
    Item: {
      connectionId: connectionId,
      createTime: new Date().toISOString(),
    },
  };

  try {
    await dynamoDbClient.put(params);
    return 200;
  } catch (error) {
    console.log(error);
    return 500;
  }
}

async function readConnection(connectionId: string): Promise<ConnectionRecord | number | undefined> {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    return (await dynamoDbClient.get(params)).Item as ConnectionRecord | undefined;
  } catch (error) {
    console.log(error);
    return 500;
  }
}

async function findConnections(queryKey: string, queryValue: string): Promise<ConnectionRecord[] | number> {
  const params = {
    TableName: CONNECTION_TABLE,
    IndexName: queryKey,
    KeyConditionExpression: '#queryKey = :queryValue',
    ExpressionAttributeNames: {
      '#queryKey': queryKey,
    },
    ExpressionAttributeValues: {
      ':queryValue': queryValue,
    },
  };

  try {
    return (await dynamoDbClient.query(params)).Items as ConnectionRecord[];
  } catch (error) {
    console.log(error);
    return 500;
  }
}

async function updateConnection(connectionId: string, updateKey: string, updateValue: unknown): Promise<ConnectionRecord | number | undefined> {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
    UpdateExpression: 'set #updateKey = :updateValue',
    ExpressionAttributeNames: {
      '#updateKey': updateKey,
    },
    ExpressionAttributeValues: {
      ':updateValue': updateValue,
    },
    ReturnValues: 'ALL_NEW' as const,
  };

  try {
    return (await dynamoDbClient.update(params)).Attributes as ConnectionRecord | undefined;
  } catch (error) {
    console.log(error);
    return 500;
  }
}

async function deleteConnection(connectionId: string): Promise<number> {
  const params = {
    TableName: CONNECTION_TABLE,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    await dynamoDbClient.delete(params);
    return 200;
  } catch (error) {
    console.log(error);
    return 500;
  }
}

export = {
  createConnection,
  readConnection,
  findConnections,
  updateConnection,
  deleteConnection,
  // Exposed for unit testing only — allows tests to spy on the DynamoDB client
  // without patching node_modules. Not used in production Lambda execution.
  _testClient: dynamoDbClient,
};
