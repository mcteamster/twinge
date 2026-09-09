// Manual mock for @aws-sdk/lib-dynamodb
// Returns a stub document client — methods are plain no-ops by default.
// Tests override individual methods via the MOCK_DYNAMO_CLIENT exported object.
const MOCK_DYNAMO_CLIENT = {
  put: jest.fn ? jest.fn() : (() => { const f = () => {}; f.mockResolvedValueOnce = () => {}; return f; })(),
};
class DynamoDBDocument {
  static from() { return MOCK_DYNAMO_CLIENT; }
}
module.exports = { DynamoDBDocument, MOCK_DYNAMO_CLIENT };
