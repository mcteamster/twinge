import { ENDPOINTS } from '../constants/constants';

export class GameWebSocket {
  constructor(callbacks) {
    this.ws = null;
    this.gameId = null;
    this.playerId = null;
    this.callbacks = callbacks;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.reconnectTimeoutId = null;
    this.syncIntervalId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const region = localStorage.getItem('region') || 'DEFAULT';
      const wsUrl = ENDPOINTS[region];
      
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
            console.debug('🔼 Sending queued message:', message.action);
            this.send(message);
          }
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.debug('🔽 WebSocket received:', data);
          
          if (data.code === 0 && data.message === 'ack') {
            console.debug('ACK received');
            return;
          }
          
          if (data.code) {
            if (this.callbacks?.onError) {
              this.callbacks.onError(data);
            }
          } else {
            if (this.callbacks?.onGameState) {
              this.callbacks.onGameState(data);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
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

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      if (this.callbacks?.onMaxReconnectReached) {
        this.callbacks.onMaxReconnectReached();
      }
      return;
    }

    this.reconnectAttempts++;
    console.debug(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
        .then(() => {
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
          // Exponential backoff with max cap
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
          this.attemptReconnect();
        });
    }, this.reconnectDelay);
  }

  send(message) {
    console.debug('🔼 WebSocket sending:', message.action || message.actionType, message);
    
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

  startSyncPolling() {
    this.stopSyncPolling();
    console.debug('🔄 Starting sync polling every 60 seconds');
    this.syncIntervalId = setInterval(() => {
      if (this.gameId && this.playerId) {
        console.debug('⏰ Sync polling - sending refresh request');
        this.send({
          action: 'play',
          actionType: 'refresh',
          gameId: this.gameId,
          playerId: this.playerId
        });
      }
    }, 60000);
  }

  stopSyncPolling() {
    if (this.syncIntervalId) {
      console.debug('🛑 Stopping sync polling');
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  disconnect() {
    if (this.reconnectTimeoutId) {
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

  setGameSession(gameId, playerId) {
    this.gameId = gameId;
    this.playerId = playerId;
    
    // Save session to localStorage
    const session = {
      gameId,
      playerId,
      timestamp: Date.now()
    };
    localStorage.setItem('twinge-session', JSON.stringify(session));
  }

  loadSession() {
    try {
      const stored = localStorage.getItem('twinge-session');
      if (!stored) return null;
      
      const session = JSON.parse(stored);
      
      // Check if session is older than 1 hour
      const sessionAge = Date.now() - (session.timestamp || 0);
      if (sessionAge > 3600000) {
        this.clearSession();
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  }

  clearSession() {
    localStorage.removeItem('twinge-session');
  }
}
