#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const apigatewayv2 = require('aws-cdk-lib/aws-apigatewayv2');
const certificatemanager = require('aws-cdk-lib/aws-certificatemanager');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const lambdaNodeJS = require('aws-cdk-lib/aws-lambda-nodejs');
const route53 = require('aws-cdk-lib/aws-route53');
const wsintegrations = require('aws-cdk-lib/aws-apigatewayv2-integrations');
const ENDPOINTS = require('./endpoints.json');

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
    const webSocketStage = new apigatewayv2.WebSocketStage(this, stage, {
      webSocketApi,
      stageName: stage,
      autoDeploy: true,
    });

    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: '*.twinge.mcteamster.com', // Do this so only one DNS record needs to be made in the Hosted Zone
      validation: certificatemanager.CertificateValidation.fromDns(),
    });

    const domainName = ENDPOINTS[props.env.region];
    const apiDomainName = new apigatewayv2.DomainName(this, 'ApiDomainName', {
      domainName: domainName,
      certificate: certificate,
    });

    new apigatewayv2.ApiMapping(this, 'ApiMapping', {
      api: webSocketApi,
      stage: webSocketStage,
      domainName: apiDomainName,
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { 
      domainName: 'mcteamster.com',
    });

    new route53.ARecord(this, 'ApiRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: apiDomainName.regionalDomainName,
          hostedZoneId: apiDomainName.regionalHostedZoneId
        })
      })
    });

    // Lambda Functions
    const connectHandler = new lambdaNodeJS.NodejsFunction(this, 'ConnectHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: './src/handlers/connect.js',
      handler: 'handler',
      environment: {
        CONNECTION_TABLE: connectionTable.tableName,
        GAME_TABLE: gameTable.tableName,
      },
    });

    const playHandler = new lambdaNodeJS.NodejsFunction(this, 'PlayHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
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

// Multi-Region Deployment
const regions = [
  'ap-southeast-2', // Australia
  'ap-northeast-1', // Japan
  'ap-southeast-1', // Singapore
  'ap-south-1', // India
  'eu-central-1', // Europe
  'eu-west-2', // UK
  'sa-east-1', // Brazil
  'us-east-1', // US East
  'us-west-2', // US West
]
regions.forEach((region) => {
  new TwingeServiceStack(app, `twinge-service-${stage}-${region}`, { env: {
    account: '922236493844',
    region: region 
  }});
})