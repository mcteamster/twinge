// vitest.setup.js
// Set environment variables required by AWS SDK modules before they load.
// These prevent "Region is missing" errors during DynamoDB client construction.
process.env.AWS_REGION = 'us-east-1';
process.env.GATEWAY_ENDPOINT = 'wss://test.execute-api.us-east-1.amazonaws.com/prod';
