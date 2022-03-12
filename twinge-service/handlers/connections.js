// create and delete websocket connections
exports.handler = (event, context, callback) => {
  const connectionId = event.requestContext.connectionId;
  const eventType = event.requestContext.eventType;
  console.log(connectionId, eventType);
  callback(null, {
      statusCode: 200,
    });
}