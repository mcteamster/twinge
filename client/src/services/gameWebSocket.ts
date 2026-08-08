import { ENDPOINTS } from '../constants/constants';
import type { WebSocketCallbacks, ServerMessage, StoredSession } from '../types';

export class GameWebSocket {
  ws: WebSocket | null = null;
  gameId: string | null = null;
  playerId: string | null = null;
  private callbacks: WebSocketCallbacks;
  private messageQueue: Record<string, unknown>[] = [];
  reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastRefreshTime: number | undefined = undefined;

  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const region = localStorage.getItem('region') || 'DEFAULT';
      const wsUrl = ENDPOINTS[region as keyof typeof ENDPOINTS];
      
      this.ws = new WebSocket(wsUrl);
      console.debug(`🟢 Connecting to Twinge WebSocket: ${wsUrl} (${region})`);

      this.ws.onopen = () => {
        console.debug('🟢 WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        if (this.callbacks?.onConnectionStatus) {
          this.callbacks.onConnectionStatus(true);
        }
        
        // Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message) {
            console.debug('🔼 Sending queued message:', message['action']);
            this.send(message);
          }
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          console.debug('🔽 WebSocket received:', message.code, message);
          
          if (message.code === 0 && message.message === 'ack') {
            console.debug('ACK received');
            return;
          }
          
          if (message.code) {
            if (this.callbacks?.onError) {
              this.callbacks.onError(message);
            }
          } else {
            // Check if this is a response to a background refresh
            const isBackgroundRefresh = this.lastRefreshTime !== undefined && (Date.now() - this.lastRefreshTime) < 2000;
            if (this.callbacks?.onGameState) {
              this.callbacks.onGameState(message, isBackgroundRefresh);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.debug('🔴 WebSocket connection closed:', event.code, event.reason);
        
        if (this.callbacks?.onConnectionStatus) {
          this.callbacks.onConnectionStatus(false);
        }
        
        // Only attempt reconnect if not manually disconnected
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
    });
  }

  attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      // Clear session when reconnection fails completely
      this.clearSession();
      if (this.callbacks?.onMaxReconnectReached) {
        this.callbacks.onMaxReconnectReached();
      }
      return;
    }

    this.reconnectAttempts++;
    console.debug(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeoutId = setTimeout(() => {
      // Set a 10-second timeout for the connection attempt
      const connectTimeout = setTimeout(() => {
        console.error('🚫 Connection attempt timed out after 10 seconds');
        // Clear session on timeout
        this.clearSession();
        // Exponential backoff and retry
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.attemptReconnect();
      }, 10000);

      this.connect()
        .then(() => {
          clearTimeout(connectTimeout);
          console.debug('✅ Reconnected successfully');
          // Auto-rejoin game if we have session info
          if (this.gameId && this.playerId) {
            console.debug('🔄 Rejoining game after reconnect');
            this.send({
              action: 'play',
              actionType: 'rejoin',
              gameId: this.gameId,
              playerId: this.playerId
            });
            this.startSyncPolling();
          }
        })
        .catch(() => {
          clearTimeout(connectTimeout);
          // Clear session on connection failure
          this.clearSession();
          // Exponential backoff with max cap
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
          this.attemptReconnect();
        });
    }, this.reconnectDelay);
  }

  send(message: Record<string, unknown>): void {
    console.debug('🔼 WebSocket sending:', message['action'] ?? message['actionType'], message);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.debug('WebSocket connecting, queueing message');
      this.messageQueue.push(message);
    } else {
      console.debug('WebSocket not connected, queueing message');
      this.messageQueue.push(message);
      
      // Try to reconnect if not already attempting
      if (!this.reconnectTimeoutId) {
        this.attemptReconnect();
      }
    }
  }

  startSyncPolling(): void {
    this.stopSyncPolling();
    console.debug('🔄 Starting sync polling every 10 seconds', { gameId: this.gameId, playerId: this.playerId });
    
    if (this.gameId && this.playerId) {
      console.debug('✅ Game session exists, setting up interval');
    } else {
      console.debug('❌ No game session, interval will not send requests');
    }
    
    this.syncIntervalId = setInterval(() => {
      console.debug('⏰ Interval fired!');
      if (this.gameId && this.playerId) {
        console.debug('⏰ Sync polling - sending refresh request', { gameId: this.gameId, playerId: this.playerId });
        // Track when we send a refresh for background detection
        this.lastRefreshTime = Date.now();
        // Send refresh directly without going through App's sendMsg to avoid loading state
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            action: 'play',
            actionType: 'refresh',
            gameId: this.gameId,
            playerId: this.playerId
          }));
        }
      } else {
        console.debug('⏰ Sync polling skipped - no game session', { gameId: this.gameId, playerId: this.playerId });
      }
    }, 10000);
    
    console.debug('🔄 Interval ID set:', this.syncIntervalId);
  }

  stopSyncPolling(): void {
    if (this.syncIntervalId !== null) {
      console.debug('🛑 Stopping sync polling');
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    this.stopSyncPolling();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    
    this.gameId = null;
    this.playerId = null;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
  }

  setGameSession(gameId: string, playerId: string): void {
    console.debug('🎮 Setting game session:', { gameId, playerId });
    this.gameId = gameId;
    this.playerId = playerId;
    
    // Save session to localStorage
    const session: StoredSession = {
      gameId,
      playerId,
      timestamp: Date.now()
    };
    localStorage.setItem('twinge-session', JSON.stringify(session));
    
    // Start sync polling when session is set
    console.debug('🎮 About to start sync polling...');
    this.startSyncPolling();
  }

  loadSession(): StoredSession | null {
    try {
      const stored = localStorage.getItem('twinge-session');
      if (!stored) return null;
      
      const session = JSON.parse(stored) as StoredSession;
      
      // Check if session is older than 12 hours
      const sessionAge = Date.now() - (session.timestamp || 0);
      if (sessionAge > 43200000) {
        this.clearSession();
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  }

  clearSession(): void {
    console.debug('🧹 Clearing game session');
    this.gameId = null;
    this.playerId = null;
    this.stopSyncPolling();
    localStorage.removeItem('twinge-session');
    if (this.callbacks?.onSessionCleared) {
      this.callbacks.onSessionCleared();
    }
  }
}
