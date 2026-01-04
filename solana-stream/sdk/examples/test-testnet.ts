import { SolActStream } from '../src/SolActStream';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration
const CONFIG = {
  // Solana testnet node URL
  NODE_URL: 'https://api.testnet.solana.com',
  // Address to monitor on testnet
  ADDRESS_TO_MONITOR: '8osSfaWw2WpRJZQfyaRsUwF31hxuQwGMktePPnCLCRT9',
  // Check balance every 5 seconds
  BALANCE_CHECK_INTERVAL: 5000
};

// Track previous balance
let previousBalance: number | null = null;

// Create Solana connection
const connection = new Connection(CONFIG.NODE_URL);

async function getCurrentBalance(address: string): Promise<number> {
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to SOL
}

async function checkBalanceChange(address: string) {
  try {
    const currentBalance = await getCurrentBalance(address);
    
    if (previousBalance === null) {
      console.log(`Initial balance: ${currentBalance} SOL`);
    } else if (currentBalance !== previousBalance) {
      const diff = currentBalance - previousBalance;
      console.log(`\n=== Balance Changed ===`);
      console.log(`Previous: ${previousBalance} SOL`);
      console.log(`Current:  ${currentBalance} SOL`);
      console.log(`Difference: ${diff > 0 ? '+' : ''}${diff} SOL`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
    }
    
    previousBalance = currentBalance;
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

async function main() {
  console.log('Starting Solana Testnet Activity Monitor...');
  console.log(`Monitoring address: ${CONFIG.ADDRESS_TO_MONITOR}`);
  
  // Initial balance check
  await checkBalanceChange(CONFIG.ADDRESS_TO_MONITOR);
  
  // Set up balance check interval
  const balanceCheckInterval = setInterval(
    () => checkBalanceChange(CONFIG.ADDRESS_TO_MONITOR),
    CONFIG.BALANCE_CHECK_INTERVAL
  );
  
  // Create a new instance of SolActStream with testnet URL
  const activityStream = new SolActStream({
    nodeUrl: CONFIG.NODE_URL,
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  });

  try {
    // Watch for address activity
    const subscription = activityStream.watchAddress(
      CONFIG.ADDRESS_TO_MONITOR,
      'transactions',
      (event: any) => {
        // We'll still log all transactions for reference
        console.log('\n=== New Transaction ===');
        console.log('Transaction Hash:', event.txHash);
        console.log('Block Height:', event.blockHeight);
        console.log('Timestamp:', new Date(event.timestamp).toISOString());
        
        // Trigger an immediate balance check
        checkBalanceChange(CONFIG.ADDRESS_TO_MONITOR);
      }
    );

    console.log('Monitoring started. Press Ctrl+C to stop.');

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\nStopping monitor...');
      clearInterval(balanceCheckInterval);
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error);
    clearInterval(balanceCheckInterval);
    process.exit(1);
  }
}

main().catch(console.error);
