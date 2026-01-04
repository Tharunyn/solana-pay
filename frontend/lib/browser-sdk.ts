import { Connection, PublicKey } from '@solana/web3.js';

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

export class SolActStream {
  private connection: Connection;
  private nodeUrl: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private watchedAddresses: Set<string> = new Set();
  private lastProcessedTx: { [key: string]: string } = {};
  private handlers: Map<string, StreamHandler> = new Map();
  private addressBalances: { [key: string]: number } = {}; // Track balances

  constructor(options: StreamOptions = {}) {
    this.nodeUrl = options.nodeUrl || 'https://api.testnet.solana.com';
    this.connection = new Connection(this.nodeUrl, {
      commitment: 'confirmed'
    });
  }

  async subscribe(address: string, handler: StreamHandler): Promise<StreamSubscription> {
    this.watchedAddresses.add(address);
    this.handlers.set(address, handler);

    // Get initial balance when starting to monitor
    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      this.addressBalances[address] = balance / 1e9; // Convert to SOL
      console.log(`Initial balance for ${address}: ${this.addressBalances[address]} SOL`);
    } catch (error) {
      console.error(`Failed to get initial balance for ${address}:`, error);
      this.addressBalances[address] = 0;
    }

    // Start polling if this is the first address
    if (this.watchedAddresses.size === 1) {
      this.startPolling();
    }

    return {
      unsubscribe: async () => {
        this.watchedAddresses.delete(address);
        this.handlers.delete(address);
        
        if (this.watchedAddresses.size === 0) {
          this.stopPolling();
        }
      }
    };
  }

  async unsubscribe(address: string): Promise<void> {
    this.watchedAddresses.delete(address);
    this.handlers.delete(address);
    
    if (this.watchedAddresses.size === 0) {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.checkAddressActivities();
    }, 5000); // Poll every 5 seconds
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async checkAddressActivities(): Promise<void> {
    if (this.watchedAddresses.size === 0) return;

    for (const address of this.watchedAddresses) {
      try {
        console.log(`Checking activity for address: ${address}`);
        const pubkey = new PublicKey(address);
        const signatures = await this.connection.getSignaturesForAddress(pubkey, {
          limit: 5
        });

        console.log(`Found ${signatures.length} signatures for address: ${address}`);

        if (signatures.length > 0) {
          const latestSignature = signatures[0].signature;
          console.log(`Latest signature: ${latestSignature}, Previously processed: ${this.lastProcessedTx[address]}`);
          
          if (this.lastProcessedTx[address] !== latestSignature) {
            console.log(`New transaction detected: ${latestSignature}`);
            
            // Create event from signature data first
            const signature = signatures[0];
            const event: ActivityEvent = {
              type: 'transactions',
              address: address,
              timestamp: signature.blockTime ? signature.blockTime * 1000 : Date.now(),
              data: {
                amount: 0, // We'll try to get this below
                slot: signature.slot || 0,
                fee: 0,
                status: signature.err ? 'failed' : 'success'
              },
              txHash: latestSignature,
              blockHeight: signature.slot || 0
            };

            // Try to get full transaction details, but don't fail if we can't
            try {
              const tx = await this.connection.getTransaction(latestSignature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });
              
              if (tx && tx.meta && tx.transaction.message) {
                // Find the account index for the monitored address
                const accountKeys = tx.transaction.message.staticAccountKeys.map(key => key.toString());
                const monitoredAddressIndex = accountKeys.findIndex(key => key === address);
                
                if (monitoredAddressIndex !== -1) {
                  // Calculate balance change for the monitored address
                  const preBalance = tx.meta.preBalances[monitoredAddressIndex] / 1e9;
                  const postBalance = tx.meta.postBalances[monitoredAddressIndex] / 1e9;
                  const balanceChange = postBalance - preBalance;
                  
                  // Update tracked balance
                  const currentBalance = this.addressBalances[address] || 0;
                  this.addressBalances[address] = postBalance;
                  
                  event.data.amount = Math.abs(balanceChange);
                  event.data.fee = tx.meta.fee / 1e9;
                  event.data.balanceChange = balanceChange; // Positive for incoming, negative for outgoing
                  event.data.previousBalance = preBalance;
                  event.data.newBalance = postBalance;
                  
                  console.log(`Balance change for ${address}: ${balanceChange > 0 ? '+' : ''}${balanceChange} SOL (${balanceChange > 0 ? 'Received' : 'Sent'})`);
                } else {
                  console.log(`Monitored address ${address} not found in transaction accounts`);
                  // Use fallback method
                  const pubkey = new PublicKey(address);
                  const currentBalance = await this.connection.getBalance(pubkey);
                  const currentBalanceSOL = currentBalance / 1e9;
                  const previousBalance = this.addressBalances[address] || 0;
                  const estimatedChange = currentBalanceSOL - previousBalance;
                  
                  if (Math.abs(estimatedChange) > 0.0001) {
                    event.data.amount = Math.abs(estimatedChange);
                    event.data.balanceChange = estimatedChange;
                    event.data.previousBalance = previousBalance;
                    event.data.newBalance = currentBalanceSOL;
                    
                    this.addressBalances[address] = currentBalanceSOL;
                    
                    console.log(`Estimated balance change: ${estimatedChange > 0 ? '+' : ''}${estimatedChange} SOL`);
                  }
                }
              } else {
                console.log(`Full transaction details not available, trying alternative approach`);
                
                // Fallback: try to get current balance and estimate change
                try {
                  const pubkey = new PublicKey(address);
                  const currentBalance = await this.connection.getBalance(pubkey);
                  const currentBalanceSOL = currentBalance / 1e9;
                  const previousBalance = this.addressBalances[address] || 0;
                  const estimatedChange = currentBalanceSOL - previousBalance;
                  
                  if (Math.abs(estimatedChange) > 0.0001) { // Only show significant changes
                    event.data.amount = Math.abs(estimatedChange);
                    event.data.balanceChange = estimatedChange;
                    event.data.previousBalance = previousBalance;
                    event.data.newBalance = currentBalanceSOL;
                    
                    // Update tracked balance
                    this.addressBalances[address] = currentBalanceSOL;
                    
                    console.log(`Estimated balance change: ${estimatedChange > 0 ? '+' : ''}${estimatedChange} SOL`);
                  }
                } catch (balanceError:any) {
                  console.log(`Could not get balance for fallback: ${balanceError.message}`);
                }
              }
            } catch (txError:any) {
              console.log(`Failed to get transaction details: ${txError.message}`);
              
              // Final fallback: just show that a transaction occurred
              event.data.amount = 0;
              event.data.balanceChange = 0;
            }

            console.log(`Emitting event:`, event);

            const handler = this.handlers.get(address);
            if (handler) {
              handler(event);
            }

            // Mark as processed
            this.lastProcessedTx[address] = latestSignature;
            console.log(`Marked ${latestSignature} as processed`);
          }
        } else {
          console.log(`No signatures found for address: ${address}`);
        }
      } catch (error) {
        console.error(`Error checking activity for address ${address}:`, error);
      }
    }
  }
}
