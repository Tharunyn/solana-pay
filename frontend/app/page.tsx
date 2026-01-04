"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

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

  useEffect(() => {
    if (connected && publicKey) {
      getBalance();
      getTransactions();
    }
  }, [connected, publicKey, connection]);

  const getBalance = async () => {
    if (!publicKey || !connection) return;
    
    try {
      const balance = await connection.getBalance(publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
  };

  const getTransactions = async () => {
    if (!publicKey || !connection) return;
    
    try {
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
      const txs = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await connection.getTransaction(sig.signature);
          if (tx && tx.meta && tx.message) {
            const amount = (tx.meta.preBalances[0] - tx.meta.postBalances[0]) / LAMPORTS_PER_SOL;
            return {
              signature: sig.signature,
              timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
              status: tx.meta.err ? 'failed' : 'success',
              amount: Math.abs(amount),
              from: tx.message.accountKeys[0]?.toBase58() || 'Unknown',
              to: tx.message.accountKeys[1]?.toBase58() || 'Unknown'
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
          
          {!connected ? (
            <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg" />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow">
              <p className="text-sm text-gray-600 dark:text-gray-300">Connected: {publicKey?.toBase58().substring(0, 6)}...{publicKey?.toBase58().substring(publicKey.toBase58().length - 4)}</p>
            </div>
          )}
        </div>

        {connected && (
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

        {!connected && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Solana Monitor</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Connect your wallet to monitor your Solana transactions and account balance.
            </p>
            <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg" />
          </div>
        )}
      </main>
    </div>
  );
}
