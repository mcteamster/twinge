// test/__stubs__/lib-dynamodb.js
// Stub for @aws-sdk/lib-dynamodb used in Vitest via resolve.alias.
// Exports a DynamoDBDocument with a from() factory that returns
// an object with vi.fn() stubs for all document client methods.
// Test files can import and configure these stubs.
import { vi } from 'vitest';

// Shared stub methods — test files can call sdk.put.mockResolvedValueOnce etc.
export const sdk = {
  put: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
};

export class DynamoDBDocument {
  static from() {
    return {
      put: (...args) => sdk.put(...args),
      get: (...args) => sdk.get(...args),
      update: (...args) => sdk.update(...args),
      delete: (...args) => sdk.delete(...args),
      query: (...args) => sdk.query(...args),
    };
  }
}
