import '@/styles/globals.css';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import '@solana/wallet-adapter-react-ui/styles.css';
import { MetaplexProvider } from '@/contexts/MetaplexContext'; // ✅ Import the provider

function AppContent({ Component, pageProps }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
        <nav className="bg-[#13131f] border-b border-[#1f2033] shadow-md">
          <div className="container flex flex-wrap items-center justify-between py-4">
            <div className="flex gap-4">
              <Link href="/">
                <button className="button">Mint</button>
              </Link>
              <Link href="/my-nfts">
                <button className="button">My NFTs</button>
              </Link>
              <Link href="/marketplace">
                <button className="button">Marketplace</button>
              </Link>
            </div>
            <div>
            </div>
          </div>
        </nav>
          {/* Page content */}
          <MetaplexProvider>   {/* ✅ Wrap here */}
          <Component {...pageProps} />
          </MetaplexProvider>   {/* ✅ Wrap here */}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Disable SSR for wallet adapter to prevent hydration mismatch
const App = dynamic(() => Promise.resolve(AppContent), { ssr: false });

export default App;
