"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { SolActStream, ActivityEvent } from '../lib/browser-sdk';

type Transaction = {
  signature: string;
  timestamp: number;
  status: 'success' | 'failed';
  amount: number;
  from: string;
  to: string;
};

export default function Home() {
  const { publicKey, connected, connecting } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monitorAddress, setMonitorAddress] = useState<string>('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityEvent[]>([]);
  const [stream, setStream] = useState<SolActStream | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      getBalance();
      getTransactions();
    }
  }, [connected, publicKey, connection]);

  const getBalance = async () => {
    if (!publicKey || !connection) return;
    
    try {
      // Use testnet connection for balance
      const testnetConnection = new Connection('https://api.testnet.solana.com');
      const balance = await testnetConnection.getBalance(publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
  };

  const getTransactions = async () => {
    if (!publicKey || !connection) return;
    
    try {
      // Use testnet connection for transactions
      const testnetConnection = new Connection('https://api.testnet.solana.com');
      const signatures = await testnetConnection.getSignaturesForAddress(publicKey, { limit: 10 });
      const txs = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await testnetConnection.getTransaction(sig.signature);
          if (tx && tx.meta && tx.transaction.message) {
            const amount = (tx.meta.preBalances[0] - tx.meta.postBalances[0]) / LAMPORTS_PER_SOL;
            return {
              signature: sig.signature,
              timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
              status: tx.meta.err ? 'failed' : 'success',
              amount: Math.abs(amount),
              from: tx.transaction.message.accountKeys[0]?.toBase58() || 'Unknown',
              to: tx.transaction.message.accountKeys[1]?.toBase58() || 'Unknown'
            };
          }
          return null;
        })
      );
      
      setTransactions(txs.filter((tx): tx is Transaction => tx !== null));
    } catch (error) {
      console.error('Failed to get transactions:', error);
    }
  };

  const startMonitoring = async () => {
    if (!monitorAddress.trim()) return;
    
    try {
      const newStream = new SolActStream({
        nodeUrl: 'https://api.testnet.solana.com'
      });
      
      const subscription = newStream.subscribe(monitorAddress, (event: ActivityEvent) => {
        console.log('Page received event:', event);
        setActivityLogs(prev => {
          console.log('Current activity logs:', prev.length);
          const newLogs = [event, ...prev].slice(0, 50);
          console.log('New activity logs count:', newLogs.length);
          return newLogs;
        });
      });
      
      setStream(newStream);
      setIsMonitoring(true);
      console.log('Started monitoring address:', monitorAddress);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const stopMonitoring = async () => {
    if (stream) {
      try {
        await stream.unsubscribe(monitorAddress);
        setStream(null);
        setIsMonitoring(false);
      } catch (error) {
        console.error('Failed to stop monitoring:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Whale Stream</h1>
          </div>
          
          {!connected ? (
            <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg" />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow">
              <p className="text-sm text-gray-600 dark:text-gray-300">Connected: {publicKey?.toBase58().substring(0, 6)}...{publicKey?.toBase58().substring(publicKey.toBase58().length - 4)}</p>
            </div>
          )}
        </div>

        {connected && (
          <div className="space-y-6">
            {/* Address Monitoring Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Monitor Whale Address</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter Solana address to monitor"
                  value={monitorAddress}
                  onChange={(e) => setMonitorAddress(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isMonitoring}
                />
                {!isMonitoring ? (
                  <button
                    onClick={startMonitoring}
                    disabled={!monitorAddress.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg"
                  >
                    Start Monitoring
                  </button>
                ) : (
                  <button
                    onClick={stopMonitoring}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-lg"
                  >
                    Stop Monitoring
                  </button>
                )}
              </div>
              {isMonitoring && (
                <div className="mt-4 flex items-center text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
                  Monitoring: {monitorAddress.substring(0, 8)}...{monitorAddress.substring(monitorAddress.length - 8)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Account Balance</h2>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {balance !== null ? `${balance} SOL` : 'Loading...'}
                </p>
              </div>

              <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Recent Transactions</h2>
                {transactions.length > 0 ? (
                  <div className="space-y-4">
                    {transactions.map((tx, index) => (
                      <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {tx.amount} SOL
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tx.status === 'success' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {tx.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <p>From: {tx.from}</p>
                          <p>To: {tx.to}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
                )}
              </div>
            </div>

            {/* Activity Logs Section */}
            {activityLogs.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
                  Activity Logs ({activityLogs.length})
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activityLogs.map((log, index) => {
                    const balanceChange = log.data.balanceChange || 0;
                    const isPositive = balanceChange > 0;
                    const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
                    const changeIcon = isPositive ? '↑' : '↓';
                    const hasBalanceChange = Math.abs(balanceChange) > 0.0001;
                    
                    return (
                      <div key={`${log.txHash}-${index}`} className="border-l-4 border-purple-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.type.toUpperCase()} - {log.address.substring(0, 8)}...{log.address.substring(log.address.length - 8)}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              {hasBalanceChange ? (
                                <p className={`text-sm font-semibold ${changeColor}`}>
                                  {changeIcon} {Math.abs(balanceChange).toFixed(4)} SOL
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  Transaction detected (amount unknown)
                                </p>
                              )}
                              {log.data.fee > 0 && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Fee: {log.data.fee.toFixed(4)} SOL
                                </p>
                              )}
                            </div>
                            {log.txHash && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                TX: {log.txHash.substring(0, 16)}...{log.txHash.substring(log.txHash.length - 8)}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show when no activity logs but monitoring is active */}
            {isMonitoring && activityLogs.length === 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Monitoring Active</h2>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Waiting for transactions on address: {monitorAddress.substring(0, 8)}...{monitorAddress.substring(monitorAddress.length - 8)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Check browser console for detection logs
                </p>
              </div>
            )}

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl shadow-md p-4">
                <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Debug Info</h3>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  <p>Monitoring: {isMonitoring ? 'Yes' : 'No'}</p>
                  <p>Address: {monitorAddress || 'None'}</p>
                  <p>Activity Logs Count: {activityLogs.length}</p>
                  <p>Check browser console for detailed logs</p>
                  {activityLogs.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-800 rounded">
                      <p className="font-semibold">Latest Log:</p>
                      <p>TX: {activityLogs[0]?.txHash?.substring(0, 16)}...</p>
                      <p>Time: {new Date(activityLogs[0]?.timestamp || 0).toLocaleTimeString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!connected && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Whale Stream</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Connect your wallet and monitor whale addresses for balance changes and transactions.
            </p>
            <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg" />
          </div>
        )}
      </main>
    </div>
  );
}
