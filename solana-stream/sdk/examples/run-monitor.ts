import { SolActStream } from '../src/SolActStream';
import type { ActivityEvent } from '../src/types';

// Simple monitoring script without WebSocket server
async function monitorAddress() {
  console.log('Starting Solana Address Monitor...');
  
  // Replace this with the address you want to monitor
  const addressToMonitor = 'So11111111111111111111111111111111111111112'; // SOL token address
  
  const activityStream = new SolActStream({
    nodeUrl: 'https://api.testnet-beta.solana.com',
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  });

  try {
    console.log(`Monitoring address: ${addressToMonitor}`);
    console.log('Press Ctrl+C to stop monitoring...\n');

    // Watch for activities
    const subscription = activityStream.watchAddress(
      addressToMonitor,
      'all',
      (event: ActivityEvent) => {
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

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nStopping monitor...');
      await subscription.unsubscribe();
      console.log('Monitor stopped.');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start monitor:', error);
    process.exit(1);
  }
}

monitorAddress().catch(console.error);
