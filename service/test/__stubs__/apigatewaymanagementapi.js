// test/__stubs__/apigatewaymanagementapi.js
// Stub for @aws-sdk/client-apigatewaymanagementapi used in Vitest via resolve.alias.
import { vi } from 'vitest';

export const postToConnection = vi.fn().mockResolvedValue({});

export class ApiGatewayManagementApi {
  constructor() {}
  postToConnection(...args) { return postToConnection(...args); }
}
