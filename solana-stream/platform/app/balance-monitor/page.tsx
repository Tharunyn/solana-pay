'use client';

import { useState, useEffect, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function BalanceMonitor() {
  const [address, setAddress] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const subscriptionId = useRef<number | null>(null);
  const balanceInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize connection to Solana testnet
  useEffect(() => {
    const conn = new Connection('https://api.testnet.solana.com', 'confirmed');
    setConnection(conn);
    
    return () => {
      // Cleanup on unmount
      if (subscriptionId.current !== null && connection) {
        connection.removeAccountChangeListener(subscriptionId.current);
      }
      if (balanceInterval.current) {
        clearInterval(balanceInterval.current);
      }
    };
  }, []);

  const fetchBalance = async (address: string) => {
    if (!connection) return;
    
    try {
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      setBalance(prevBalance => {
        // Only update if balance has changed
        if (prevBalance !== solBalance) {
          // Add to transactions if this is a change
          if (prevBalance !== null && prevBalance !== solBalance) {
            setTransactions(prev => [
              {
                type: 'balanceChange',
                timestamp: new Date().toISOString(),
                oldBalance: prevBalance,
                newBalance: solBalance,
                change: solBalance - prevBalance
              },
              ...prev
            ].slice(0, 50));
          }
          return solBalance;
        }
        return prevBalance;
      });
      
      setError(null);
      return solBalance;
    } catch (err) {
      setError('Invalid Solana address');
      setBalance(null);
      return null;
    }
  };

  const startMonitoring = async () => {
    if (!connection || !address) return;
    
    try {
      // First, validate the address
      new PublicKey(address);
      
      // Get initial balance
      await fetchBalance(address);
      
      // Set up polling for balance changes
      balanceInterval.current = setInterval(() => {
        fetchBalance(address);
      }, 5000); // Check every 5 seconds
      
      // Set up account change listener
      const publicKey = new PublicKey(address);
      subscriptionId.current = connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          const newBalance = accountInfo.lamports / LAMPORTS_PER_SOL;
          setBalance(prevBalance => {
            if (prevBalance !== null && prevBalance !== newBalance) {
              setTransactions(prev => [
                {
                  type: 'balanceChange',
                  timestamp: new Date().toISOString(),
                  oldBalance: prevBalance,
                  newBalance: newBalance,
                  change: newBalance - prevBalance
                },
                ...prev
              ].slice(0, 50));
            }
            return newBalance;
          });
        },
        'confirmed'
      );
      
      setIsMonitoring(true);
      setError(null);
      
    } catch (err) {
      setError('Invalid Solana address');
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = () => {
    if (balanceInterval.current) {
      clearInterval(balanceInterval.current);
      balanceInterval.current = null;
    }
    if (subscriptionId.current !== null && connection) {
      connection.removeAccountChangeListener(subscriptionId.current);
      subscriptionId.current = null;
    }
    setIsMonitoring(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMonitoring) {
      stopMonitoring();
    } else if (address) {
      startMonitoring();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Solana Balance Monitor (Testnet)
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Solana Address (Testnet)
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter Solana address"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isMonitoring}
              />
            </div>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <div className="flex justify-center">
              <button
                type="submit"
                className={`px-6 py-2 rounded-md text-white font-medium ${
                  isMonitoring 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-purple-600 hover:bg-purple-700'
                } transition-colors`}
              >
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
            </div>
          </form>
          
          {balance !== null && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h2 className="text-xl font-semibold mb-2">Account Balance</h2>
              <p className="text-2xl font-bold">{balance.toFixed(4)} SOL</p>
              <p className="text-sm text-gray-500 mt-1">
                {isMonitoring ? 'Monitoring active - updates in real-time' : 'Monitoring paused'}
              </p>
            </div>
          )}
        </div>
        
        {transactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Previous Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tx.type === 'balanceChange' ? 'Balance Update' : 'Transaction'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.oldBalance ? tx.oldBalance.toFixed(4) + ' SOL' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {tx.newBalance ? tx.newBalance.toFixed(4) + ' SOL' : 'N/A'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        tx.change > 0 ? 'text-green-600' : tx.change < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {tx.change > 0 ? '+' : ''}{tx.change ? tx.change.toFixed(4) + ' SOL' : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
