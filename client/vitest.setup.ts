// vitest.setup.ts
// Global test setup: jest-dom matchers, an audio stub, and a controllable
// WebSocket mock. Loaded via `setupFiles` in vitest.config.ts.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom does not implement media playback; stub the methods gameWebSocket's
// consumers (and any audio-driven component) may call so they no-op.
HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLAudioElement.prototype.pause = vi.fn();

// jsdom does not implement scrollTo; several components call it in handlers.
window.scrollTo = vi.fn();

// --- WebSocket mock ---------------------------------------------------------
// gameWebSocket.ts constructs `new WebSocket(url)` directly and reads the
// static readyState constants (WebSocket.OPEN etc). This mock records every
// constructed instance and exposes triggerable lifecycle callbacks so tests
// can drive onopen / onmessage / onerror / onclose deterministically.

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  // Instances created during a test, newest last.
  static instances: MockWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;

  onopen: ((this: MockWebSocket, ev?: Event) => void) | null = null;
  onmessage: ((this: MockWebSocket, ev: { data: string }) => void) | null = null;
  onerror: ((this: MockWebSocket, ev?: Event) => void) | null = null;
  onclose: ((this: MockWebSocket, ev: { code: number; reason?: string }) => void) | null = null;

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    this.triggerClose(code ?? 1000, reason);
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  /** The most recently constructed socket, or undefined if none. */
  static last(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }

  // --- Test-facing triggers ---
  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.call(this);
  }

  triggerMessage(data: unknown): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.onmessage?.call(this, { data: payload });
  }

  triggerError(): void {
    this.onerror?.call(this);
  }

  triggerClose(code = 1006, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.call(this, { code, reason });
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

beforeEach(() => {
  // A clean slate for each test: no leaked sockets, timers, or storage.
  MockWebSocket.reset();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});
