"use client";

import WalletAdapterProvider from './WalletAdapterProvider';

export default function WalletContext({ children }: { children: React.ReactNode }) {
  return <WalletAdapterProvider>{children}</WalletAdapterProvider>;
}
