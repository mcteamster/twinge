import connections from '../helpers/connections';
import type { LambdaEvent, LambdaResult } from '../types';

const handler = async (event: LambdaEvent, _?: unknown): Promise<LambdaResult> => {
  const connectionId = event.requestContext.connectionId;
  const eventType = event.requestContext.eventType;
  let statusCode = 200;

  if (eventType == 'CONNECT') {
    statusCode = await connections.createConnection(connectionId);
  } else if (eventType == 'DISCONNECT') {
    statusCode = await connections.deleteConnection(connectionId);
  }

  return {
    statusCode: statusCode,
  };
};

export = {
  handler,
  // Exposed for unit testing only — allows tests to spy on injected dependencies
  // without mocking node_modules. Not used in production Lambda execution.
  _testDeps: { connections },
};
