"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, Connection, PublicKey } from '@solana/web3.js';
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
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monitorAddress, setMonitorAddress] = useState<string>('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityEvent[]>([]);
  const [stream, setStream] = useState<SolActStream | null>(null);

  const handleDisconnect = async () => {
    // Stop monitoring if active
    if (isMonitoring && stream) {
      try {
        await stream.unsubscribe(monitorAddress);
        setStream(null);
        setIsMonitoring(false);
      } catch (error) {
        console.error('Failed to stop monitoring:', error);
      }
    }
    
    // Clear all state
    setBalance(null);
    setTransactions([]);
    setActivityLogs([]);
    setMonitorAddress('');
    
    // Disconnect wallet
    disconnect();
  };

  useEffect(() => {
    if (connected && publicKey) {
      getBalance();
      getTransactions();
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (monitorAddress && isMonitoring) {
      getTransactions();
    }
  }, [monitorAddress, isMonitoring]);

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
    // Get transactions for the monitored address if available, otherwise use connected wallet
    const addressToFetch = monitorAddress && isMonitoring ? monitorAddress : publicKey;
    if (!addressToFetch || !connection) return;
    
    try {
      // Use testnet connection for transactions
      const testnetConnection = new Connection('https://api.testnet.solana.com');
      const publicKey = typeof addressToFetch === 'string' ? new PublicKey(addressToFetch) : addressToFetch;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <main className="relative container mx-auto px-6 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Whale Stream</h1>
            </div>
          </div>
          
          {!connected ? (
            <WalletMultiButton className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-purple-500/40" />
          ) : (
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20 shadow-xl">
                <p className="text-sm text-gray-300 font-medium">
                  <span className="text-purple-400">Connected:</span> {publicKey?.toBase58().substring(0, 6)}...{publicKey?.toBase58().substring(publicKey.toBase58().length - 4)}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40"
              >
                Disconnect
              </button>
            </div>
          )}
        </header>

        {connected && (
          <div className="space-y-8">
            {/* Address Monitoring Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
              <div className="flex items-center mb-6">
                <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                <h2 className="text-xl font-semibold text-white">Monitor Whale Address</h2>
              </div>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter Solana address to monitor"
                    value={monitorAddress}
                    onChange={(e) => setMonitorAddress(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                    disabled={isMonitoring}
                  />
                  {monitorAddress && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
                {!isMonitoring ? (
                  <button
                    onClick={startMonitoring}
                    disabled={!monitorAddress.trim()}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200 hover:shadow-green-500/40 disabled:shadow-none"
                  >
                    <span className="flex items-center space-x-2">
                      <span>Start Monitoring</span>
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={stopMonitoring}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40"
                  >
                    <span className="flex items-center space-x-2">
                      <span>Stop Monitoring</span>
                    </span>
                  </button>
                )}
              </div>
              {isMonitoring && (
                <div className="mt-6 flex items-center text-green-400 bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                  <span className="font-medium">Monitoring: {monitorAddress.substring(0, 8)}...{monitorAddress.substring(monitorAddress.length - 8)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Account Balance</h2>
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    {balance !== null ? `${balance}` : '...'}
                  </p>
                  <p className="text-lg text-purple-300">SOL</p>
                </div>
                {balance !== null && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center text-sm text-gray-400">
                      <span>≈ ${(balance * 25.50).toFixed(2)} USD</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Recent Transactions of</h2>
                    {monitorAddress && isMonitoring ? (
                      <p className="text-sm font-medium text-purple-400 mt-1">
                        {monitorAddress.substring(0, 8)}...{monitorAddress.substring(monitorAddress.length - 8)}
                      </p>
                    ) : publicKey ? (
                      <p className="text-sm font-medium text-gray-400 mt-1">
                        {publicKey.toBase58().substring(0, 8)}...{publicKey.toBase58().substring(publicKey.toBase58().length - 8)}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-gray-500 mt-1">No address</p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                  </div>
                </div>
                {transactions.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {transactions.map((tx, index) => (
                      <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg font-semibold text-white">
                                {tx.amount} SOL
                              </span>
                              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                tx.status === 'success' 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {tx.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 text-sm text-gray-400">
                              <p><span className="text-gray-500">From:</span> {tx.from}</p>
                              <p><span className="text-gray-500">To:</span> {tx.to}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(tx.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <div className="w-8 h-8 bg-purple-500/30 rounded-full"></div>
                    </div>
                    <p className="text-gray-400">No transactions found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Logs Section */}
            {activityLogs.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Activity Logs</h2>
                    <p className="text-sm text-purple-400 mt-1">{activityLogs.length} events detected</p>
                  </div>
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {activityLogs.map((log, index) => {
                    const balanceChange = log.data.balanceChange || 0;
                    // For the monitored address, positive balance change should be green (receiving SOL)
                    // Negative balance change should be red (sending SOL)
                    const isPositive = balanceChange > 0;
                    const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
                    const changeIcon = isPositive ? '↑' : '↓';
                    const hasBalanceChange = Math.abs(balanceChange) > 0.0001;
                    
                    // Debug logging
                    console.log(`Activity log ${index}:`, {
                      address: log.address,
                      balanceChange,
                      isPositive,
                      type: log.type,
                      data: log.data
                    });
                    
                    return (
                      <div key={`${log.txHash}-${index}`} className="bg-white/5 rounded-xl p-4 border-l-4 border-purple-500 hover:bg-white/10 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-sm font-semibold text-white uppercase tracking-wide">
                                {log.type}
                              </span>
                              <span className="text-xs text-gray-400">
                                {log.address.substring(0, 8)}...{log.address.substring(log.address.length - 8)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4">
                              {hasBalanceChange ? (
                                <p className={`text-lg font-bold ${changeColor}`}>
                                  {changeIcon} {Math.abs(balanceChange).toFixed(4)} SOL
                                </p>
                              ) : (
                                <p className="text-sm text-gray-400">
                                  Transaction detected
                                </p>
                              )}
                              {log.data.fee > 0 && (
                                <p className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded-lg">
                                  Fee: {log.data.fee.toFixed(4)} SOL
                                </p>
                              )}
                            </div>
                            {log.txHash && (
                              <p className="text-xs text-gray-500 mt-2 font-mono">
                                {log.txHash.substring(0, 16)}...{log.txHash.substring(log.txHash.length - 8)}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 whitespace-nowrap ml-4 bg-white/10 px-2 py-1 rounded-lg">
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
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-500/20 p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="w-8 h-8 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                  <h2 className="text-xl font-semibold text-blue-300 mb-2">Monitoring Active</h2>
                  <p className="text-sm text-blue-400 mb-4">
                    Waiting for transactions on address: {monitorAddress.substring(0, 8)}...{monitorAddress.substring(monitorAddress.length - 8)}
                  </p>
                  <p className="text-xs text-blue-500">
                    Check browser console for detection logs
                  </p>
                </div>
              </div>
            )}

            {/* Debug Info */}
            {/* {process.env.NODE_ENV === 'development' && (
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
            )} */}
          </div>
        )}

        {!connected && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-12 max-w-md w-full text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <div className="w-12 h-12 bg-white rounded-xl"></div>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">Welcome to Whale Stream</h2>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Connect your wallet and monitor whale addresses for real-time balance changes and transactions.
              </p>
              <WalletMultiButton className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-purple-500/40 w-full" />
            </div>
          </div>
        )}

        {/* Use Cases Section */}
        <div className="mt-20 mb-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">Use Cases</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Powered by Solana's high-performance blockchain, enabling instant data streaming for next-generation applications
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Gaming */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Gaming</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2">•</span>
                  <span>Live match data & scores</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2">•</span>
                  <span>Real-time leaderboards</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2">•</span>
                  <span>Instant item transfers</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2">•</span>
                  <span>Achievement unlocks</span>
                </li>
              </ul>
            </div>

            {/* Sports */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Sports</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  <span>Instant match results</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  <span>Live score updates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  <span>Player statistics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  <span>Tournament brackets</span>
                </li>
              </ul>
            </div>

            {/* Prediction & Betting */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Prediction & Betting</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Instant odds updates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Live bet settlements</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Real-time price feeds</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Risk management data</span>
                </li>
              </ul>
            </div>

            {/* Finance */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Finance</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Real-time analytics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Market data streams</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Trading notifications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Risk monitoring</span>
                </li>
              </ul>
            </div>

            {/* AI & Simulation */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">AI & Simulation</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Training data traces</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Real-time simulation results</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Model performance metrics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Neural network updates</span>
                </li>
              </ul>
            </div>

            {/* DeFi */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 hover:bg-white/15 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-6">
                <div className="w-6 h-6 bg-white rounded-lg"></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">DeFi</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  <span>Yield farming updates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  <span>Liquidity pool changes</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  <span>Token swap notifications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  <span>Smart contract events</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 51, 234, 0.7);
        }
      `}</style>
    </div>
  );
}
