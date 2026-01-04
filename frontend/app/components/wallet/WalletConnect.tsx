'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  async () => 
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function WalletConnect() {
  return (
    <WalletMultiButton 
      className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg"
    />
  );
}
