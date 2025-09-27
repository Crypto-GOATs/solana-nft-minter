import '@/styles/globals.css';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import '@solana/wallet-adapter-react-ui/styles.css';
import { UmiProvider } from '@/contexts/UmiProvider';
import { ProgramProvider } from '@/contexts/ProgramProvider';
import Head from 'next/head'; // Import the Head component

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
    <>
    <Head>
        <title>SolanaOnlyFans</title>
        <link rel="icon" href="/onlyfans-logo.svg" />
      </Head>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
        <nav className="bg-[#13131f] border-b border-[#1f2033] shadow-md">
          <div className="container flex flex-wrap items-center justify-between py-4">
            <div className="flex gap-4">
              <Link href="/">
                <button className="button">Generate</button>
              </Link>
              <Link href="/my-nfts">
                <button className="button">My listings</button>
              </Link>
              <Link href="/marketplace">
                <button className="button">Marketplace</button>
              </Link>
              {/* <Link href="/earnings">
                <button className="button">Earnings</button>
              </Link> */}
              <Link href="/my-content">  
                <button className="button">My Content</button>
              </Link>
            </div>
            <div>
            </div>
          </div>
        </nav>
          {/* Page content */}
          <UmiProvider>   {/* ✅ Wrap here */}
            <ProgramProvider>
          <Component {...pageProps} />
          </ProgramProvider>
          </UmiProvider>   {/* ✅ Wrap here */}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
    </>
  );
}

// Disable SSR for wallet adapter to prevent hydration mismatch
const App = dynamic(() => Promise.resolve(AppContent), { ssr: false });

export default App;
