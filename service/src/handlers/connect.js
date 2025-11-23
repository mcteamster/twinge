const connections = require('../helpers/connections');

export const handler = async (event, _) => {
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