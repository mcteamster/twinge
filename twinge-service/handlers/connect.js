const connections = require('../helpers/connections');

exports.handler = async (event, context, callback) => {
  const connectionId = event.requestContext.connectionId;
  const eventType = event.requestContext.eventType;
  let statusCode = 200;

  if(eventType == 'CONNECT') {
    statusCode = await connections.createConnection(connectionId);
  } else if(eventType == 'DISCONNECT') {
    statusCode = await connections.deleteConnection(connectionId);
  }

  callback(null, {
      statusCode: statusCode,
    }
  );
}