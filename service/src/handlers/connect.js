const connections = require('../helpers/connections');

module.exports.handler = async (event, _) => {
  const connectionId = event.requestContext.connectionId;
  const eventType = event.requestContext.eventType;
  let statusCode = 200;

  if(eventType == 'CONNECT') {
    statusCode = await connections.createConnection(connectionId);
  } else if(eventType == 'DISCONNECT') {
    statusCode = await connections.deleteConnection(connectionId);
  }

  return {
    statusCode: statusCode,
  }
}

// Exposed for unit testing only — allows tests to spy on injected dependencies
// without mocking node_modules. Not used in production Lambda execution.
module.exports._testDeps = { connections };