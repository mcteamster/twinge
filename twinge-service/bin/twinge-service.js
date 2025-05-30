#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const lambdaNodeJS = require('aws-cdk-lib/aws-lambda-nodejs');
const apigatewayv2 = require('aws-cdk-lib/aws-apigatewayv2');
const wsintegrations = require('aws-cdk-lib/aws-apigatewayv2-integrations');

const stage = 'prod';
const app = new cdk.App();

class TwingeServiceStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // DynamoDB Tables
    const connectionTable = new dynamodb.Table(this, 'ConnectionTable', {
      tableName: `connection-table-${stage}`,
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    connectionTable.addGlobalSecondaryIndex({
      indexName: 'gameId',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const gameTable = new dynamodb.Table(this, 'GameTable', {
      tableName: `game-table-${stage}`,
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiryTimeEpoch',
    });

    gameTable.addGlobalSecondaryIndex({
      indexName: 'roomCode',
      partitionKey: { name: 'roomCode', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, `twinge-service-websockets-${stage}`);
    new apigatewayv2.WebSocketStage(this, stage, {
      webSocketApi,
      stageName: stage,
      autoDeploy: true,
    });

    // Lambda Functions
    const connectHandler = new lambdaNodeJS.NodejsFunction(this, 'ConnectHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: './src/handlers/connect.js',
      handler: 'handler',
      environment: {
        CONNECTION_TABLE: connectionTable.tableName,
        GAME_TABLE: gameTable.tableName,
      },
    });

    const playHandler = new lambdaNodeJS.NodejsFunction(this, 'PlayHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: './src/handlers/play.js',
      handler: 'handler',
      environment: {
        CONNECTION_TABLE: connectionTable.tableName,
        GAME_TABLE: gameTable.tableName,
        GATEWAY_ENDPOINT: `${webSocketApi.apiEndpoint}/${stage}`,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          actions: ['execute-api:ManageConnections'],
          resources: [`${webSocketApi.arnForExecuteApiV2()}/*`],
        }),
      ],
    });

    // Add routes to WebSocket API
    webSocketApi.addRoute('$connect', {
      integration: new wsintegrations.WebSocketLambdaIntegration('ConnectIntegration', connectHandler),
    });

    webSocketApi.addRoute('$disconnect', {
      integration: new wsintegrations.WebSocketLambdaIntegration('DisconnectIntegration', connectHandler),
    });

    webSocketApi.addRoute('play', {
      integration: new wsintegrations.WebSocketLambdaIntegration('PlayIntegration', playHandler),
    });

    // Grant permissions
    connectionTable.grantReadWriteData(connectHandler);
    connectionTable.grantReadWriteData(playHandler);
    gameTable.grantReadWriteData(connectHandler);
    gameTable.grantReadWriteData(playHandler);
  }
}

new TwingeServiceStack(app, `twinge-service-${stage}`);