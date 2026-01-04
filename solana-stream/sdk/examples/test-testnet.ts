import { SolActStream } from '../src/SolActStream';

// Configuration
const CONFIG = {
  // Solana testnet node URL
  NODE_URL: 'https://api.testnet.solana.com',
  // Address to monitor on testnet
  ADDRESS_TO_MONITOR: '8osSfaWw2WpRJZQfyaRsUwF31hxuQwGMktePPnCLCRT9'
};

async function main() {
  console.log('Starting Solana Testnet Activity Monitor...');
  console.log(`Monitoring address: ${CONFIG.ADDRESS_TO_MONITOR}`);
  
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
        console.log('\n=== New Activity ===');
        console.log('Type:', event.type);
        console.log('Address:', event.address);
        console.log('Transaction Hash:', event.txHash);
        console.log('Block Height:', event.blockHeight);
        console.log('Timestamp:', new Date(event.timestamp).toISOString());
        console.log('Data:', event.data);
      }
    );

    console.log('Monitoring started. Press Ctrl+C to stop.');

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\nStopping monitor...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
