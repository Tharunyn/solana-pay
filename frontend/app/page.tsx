"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

type Transaction = {
  signature: string;
  timestamp: number;
  status: 'success' | 'failed';
  amount: number;
  from: string;
  to: string;
};

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock function to connect wallet
  const connectWallet = async () => {
    try {
      setIsLoading(true);
      // In a real app, you would connect to a wallet like Phantom here
      // This is just a mock implementation
      setTimeout(() => {
        setPublicKey('YourPublicKey123...');
        setBalance(42.5);
        setIsConnected(true);
        setIsLoading(false);
        
        // Mock transactions
        setTransactions([
          {
            signature: '5nX9...XyZ1',
            timestamp: Date.now() - 3600000,
            status: 'success',
            amount: 1.5,
            from: 'FromAddress123...',
            to: 'YourPublicKey123...'
          },
          {
            signature: '3mY2...AbC9',
            timestamp: Date.now() - 7200000,
            status: 'success',
            amount: 2.8,
            from: 'YourPublicKey123...',
            to: 'AnotherAddress456...'
          }
        ]);
      }, 1000);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Image
              src="/next.svg"
              alt="Solana Monitor"
              width={120}
              height={28}
              className="dark:invert"
              priority
            />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Solana Monitor</h1>
          </div>
          
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 flex items-center"
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
              {isLoading && (
                <svg className="animate-spin -mr-1 ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow">
              <p className="text-sm text-gray-600 dark:text-gray-300">Connected: {publicKey?.substring(0, 6)}...{publicKey?.substring(publicKey.length - 4)}</p>
            </div>
          )}
        </div>

        {isConnected && (
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
        )}

        {!isConnected && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Solana Monitor</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Connect your wallet to monitor your Solana transactions and account balance.
            </p>
            <button
              onClick={connectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
