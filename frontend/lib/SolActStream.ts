import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import { ActivityEvent, ActivityType, StreamHandler, StreamOptions, StreamSubscription } from './types';
import WebSocket, { WebSocketServer } from 'ws';

export class SolActStream {
  private connection: Connection;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private nodeUrl: string;
  private reconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;
  private watchedAddresses: Set<string> = new Set();
  private lastProcessedTx: { [key: string]: string } = {};
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private handlers: Map<string, StreamHandler> = new Map();

  constructor(options: StreamOptions = {}) {
    this.nodeUrl = options.nodeUrl || 'https://api.mainnet-beta.solana.com';
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;

    // Initialize Solana connection
    this.connection = new Connection(this.nodeUrl, {
      commitment: 'confirmed',
      wsEndpoint: this.nodeUrl.replace('https', 'wss')
    });
  }

  // ... [Previous methods remain the same until checkAddressActivities]

  private async checkAddressActivities(): Promise<void> {
    if (this.watchedAddresses.size === 0) return;

    for (const address of this.watchedAddresses) {
      try {
        // Get signatures for the address
        const pubkey = new PublicKey(address);
        const signatures = await this.connection.getSignaturesForAddress(pubkey, {
          limit: 5
        });

        if (signatures.length > 0) {
          const latestSignature = signatures[0].signature;
          
          if (this.lastProcessedTx[address] !== latestSignature) {
            // Get the full transaction details
            const tx = await this.connection.getParsedTransaction(latestSignature, {
              maxSupportedTransactionVersion: 0,
            });

            if (tx) {
              this.lastProcessedTx[address] = latestSignature;
              
              // Create activity event
              const activityEvent: ActivityEvent = {
                type: 'transactions',
                address,
                timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                data: tx,
                txHash: latestSignature,
                blockHeight: tx.slot
              };

              // Broadcast to all clients
              this.broadcast(activityEvent);

              // Call individual handler if it exists
              const handler = this.handlers.get(address);
              if (handler) {
                handler(activityEvent);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error checking activities for address ${address}:`, error);
      }
    }
  }

  // ... [Rest of the methods remain the same]

  public watchAddress(
    address: string,
    type: ActivityType = 'all',
    handler?: StreamHandler
  ): StreamSubscription {
    // Validate Solana address
    try {
      new PublicKey(address);
    } catch (error) {
      throw new Error(`Invalid Solana address: ${address}`);
    }

    const subscriptionId = `${address}-${Date.now()}`;
    this.watchedAddresses.add(address);

    if (handler) {
      this.handlers.set(address, handler);
    }

    // Start polling if not already started
    if (!this.pollingInterval) {
      this.startPolling();
    }

    return {
      unsubscribe: async () => {
        this.watchedAddresses.delete(address);
        this.handlers.delete(address);
        
        if (this.watchedAddresses.size === 0 && this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
      }
    };
  }

  public async getAddressActivities(
    address: string,
    limit: number = 10
  ): Promise<ActivityEvent[]> {
    try {
      const pubkey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit
      });

      const activities: ActivityEvent[] = [];
      
      for (const sig of signatures) {
        const tx = await this.connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          activities.push({
            type: 'transactions',
            address,
            timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
            data: tx,
            txHash: sig.signature,
            blockHeight: tx.slot
          });
        }
      }

      return activities;
    } catch (error) {
      console.error(`Error getting activities for address ${address}:`, error);
      throw error;
    }
  }

  /**
   * Broadcasts data to all connected WebSocket clients
   * @param data The data to broadcast
   */
  private broadcast(data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      } else {
        // Remove disconnected clients
        this.clients.delete(client);
      }
    });
  }

  /**
   * Stops all polling and cleans up resources
   */
  public async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Close all WebSocket connections
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();
    
    // Clear all subscriptions
    this.subscriptions.clear();
    this.handlers.clear();
    this.watchedAddresses.clear();
    
    // Reset reconnection attempts
    this.reconnectAttempts = 0;
  }

  /**
   * Starts polling for address activities at regular intervals
   * @private
   */
  private startPolling(): void {
    // Clear any existing interval to prevent duplicates
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Set up a new interval to check for address activities
    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkAddressActivities();
      } catch (error) {
        console.error('Error during address activity polling:', error);
        // Attempt to restart polling on error if needed
        if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.startPolling(), this.reconnectInterval);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached. Polling stopped.');
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
        }
      }
    }, 10000); // Poll every 10 seconds
  }
}