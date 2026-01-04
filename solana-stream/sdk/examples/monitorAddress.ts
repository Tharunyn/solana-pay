import { SolActStream } from '../src/SolActStream';
import type { ActivityType } from '../src/types';

// Configuration
const CONFIG = {
  // Solana RPC URL (mainnet, testnet, or devnet)
  NODE_URL: 'https://api.mainnet-beta.solana.com',
  // Solana address to monitor (replace with the address you want to monitor)
  ADDRESS_TO_MONITOR: 'YOUR_SOLANA_ADDRESS_HERE',
  // Polling interval in milliseconds
  POLLING_INTERVAL: 10000,
};

async function main() {
  console.log('Starting Solana Activity Monitor...');
  
  // Create a new instance of SolActStream
  const activityStream = new SolActStream({
    nodeUrl: CONFIG.NODE_URL,
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  });

  try {
    console.log(`Starting to monitor address: ${CONFIG.ADDRESS_TO_MONITOR}`);
    
    // Watch for all activities on the specified address
    const subscription = activityStream.watchAddress(
      CONFIG.ADDRESS_TO_MONITOR,
      'all', // Monitor all activity types
      (event) => {
        console.log('\n=== New Activity Detected ===');
        console.log('Type:', event.type);
        console.log('Address:', event.address);
        console.log('Timestamp:', new Date(event.timestamp).toISOString());
        console.log('Transaction Hash:', event.txHash);
        console.log('Block Height:', event.blockHeight);
        console.log('Data:', JSON.stringify(event.data, null, 2));
        console.log('===========================\n');
      }
    );
    
    // The watchAddress method should automatically start monitoring
    console.log('Successfully started monitoring. Waiting for activities...');

    console.log(`Monitoring address: ${CONFIG.ADDRESS_TO_MONITOR}`);
    console.log('Press Ctrl+C to stop monitoring...');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nStopping monitor...');
      await subscription.unsubscribe();
      await activityStream.stop();
      console.log('Monitor stopped.');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start monitor:', error);
    process.exit(1);
  }
}

main().catch(console.error);
