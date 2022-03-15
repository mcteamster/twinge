const AWS = require("aws-sdk");
const util = require('util');
const HOSTNAME = process.env.HOSTNAME;

const sendMessageToClient = (url, connectionId, payload) =>
  new Promise((resolve, reject) => {
    const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: url,
    });
    apigatewaymanagementapi.postToConnection(
      {
        ConnectionId: connectionId, // connectionId of the receiving ws-client
        Data: JSON.stringify(payload),
      },
      (err, data) => {
        if (err) {
          console.log('err is', err);
          reject(err);
        }
        resolve(data);
      }
    );
  });

module.exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const callbackUrlForAWS = util.format(util.format(`https://${HOSTNAME}`)); //construct the needed url
  await sendMessageToClient(callbackUrlForAWS, connectionId, event);
  return {
    statusCode: 200,
  };
};
