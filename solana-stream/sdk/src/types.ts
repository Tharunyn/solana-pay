// import { AccountAddressInput } from '@solana-labs/ts-sdk';

export type ActivityType = 'all' | 'transactions' | 'events' | 'resources';

export interface ActivityEvent {
  type: ActivityType;
  address: string;
  timestamp: number;
  data: any;
  txHash?: string;
  blockHeight?: number;
}

export interface StreamOptions {
  nodeUrl?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface StreamHandler {
  (event: ActivityEvent): void;
}

export interface StreamSubscription {
  unsubscribe: () => Promise<void>;
}
