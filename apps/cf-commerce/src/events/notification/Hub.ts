interface HubState {
  connections: Map<string, (msg: string) => void>;
  messagesSent: number;
  totalRegistered: number;
}

export interface Hub {
  register(userId: string, send: (msg: string) => void): void;
  deregister(userId: string): void;
  push(userId: string, message: string): void;
  broadcast(message: string): void;
  closeAll(): void;
  connectionCount(): number;
  getState(): Readonly<{ messagesSent: number; totalRegistered: number; connectionCount: number }>;
}

export const createHub = (): Hub => {
  const state: HubState = {
    connections: new Map(),
    messagesSent: 0,
    totalRegistered: 0,
  };

  return {
    register(userId: string, send: (msg: string) => void): void {
      state.connections.set(userId, send);
      state.totalRegistered++;
    },

    deregister(userId: string): void {
      state.connections.delete(userId);
    },

    push(userId: string, message: string): void {
      const send = state.connections.get(userId);
      if (send !== undefined) {
        try {
          send(message);
          state.messagesSent++;
        } catch {
          state.connections.delete(userId);
        }
      }
    },

    broadcast(message: string): void {
      for (const [userId, send] of state.connections.entries()) {
        try {
          send(message);
          state.messagesSent++;
        } catch {
          state.connections.delete(userId);
        }
      }
    },

    closeAll(): void {
      state.connections.clear();
    },

    connectionCount(): number {
      return state.connections.size;
    },

    getState() {
      return {
        messagesSent: state.messagesSent,
        totalRegistered: state.totalRegistered,
        connectionCount: state.connections.size,
      };
    },
  };
};
