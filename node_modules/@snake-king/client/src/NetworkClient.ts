import {
  encodeInput,
  decodeStateDelta,
  type InputMessage,
  type StateDelta,
  type InputType,
} from '@snake-king/shared';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type NetworkEventType = 'connected' | 'disconnected' | 'state_delta' | 'reconnecting';
export type NetworkEventHandler = (event: NetworkEventType, data?: StateDelta) => void;

// ─── NetworkClient ───────────────────────────────────────────────────────────

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private sequenceNumber: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1666; // ~5s / 3 attempts
  private handlers: NetworkEventHandler[] = [];
  private connected: boolean = false;
  private intentionalDisconnect: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /** Connect to the server */
  connect(): void {
    this.intentionalDisconnect = false;
    this.createWebSocket();
  }

  /** Disconnect from the server */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /** Send a direction input */
  sendDirection(targetDirection: number): void {
    this.sendInput('direction', targetDirection);
  }

  /** Send boost start */
  sendBoostStart(): void {
    this.sendInput('boost_start');
  }

  /** Send boost end */
  sendBoostEnd(): void {
    this.sendInput('boost_end');
  }

  /** Register an event handler */
  on(handler: NetworkEventHandler): void {
    this.handlers.push(handler);
  }

  /** Remove an event handler */
  off(handler: NetworkEventHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /** Get connection status */
  isConnected(): boolean {
    return this.connected;
  }

  /** Get current sequence number */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private createWebSocket(): void {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.dispatch('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        // JSON format from server
        try {
          const delta = JSON.parse(event.data);
          this.dispatch('state_delta', delta);
        } catch {
          // ignore malformed
        }
      } else if (event.data instanceof ArrayBuffer) {
        const delta = decodeStateDelta(event.data);
        this.dispatch('state_delta', delta);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      } else {
        this.dispatch('disconnected');
      }
    };

    this.ws.onerror = () => {
      // Error will trigger onclose, so reconnect logic is handled there
    };
  }

  private sendInput(type: InputType, targetDirection?: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sequenceNumber++;

    const msg: InputMessage = {
      type,
      sequenceNumber: this.sequenceNumber,
      timestamp: Date.now(),
    };

    if (type === 'direction' && targetDirection !== undefined) {
      msg.targetDirection = targetDirection;
    }

    const encoded = encodeInput(msg);
    this.ws.send(encoded);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.dispatch('disconnected');
      return;
    }

    this.reconnectAttempts++;
    this.dispatch('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.createWebSocket();
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private dispatch(event: NetworkEventType, data?: StateDelta): void {
    for (const handler of this.handlers) {
      handler(event, data);
    }
  }
}
