import '@/styles/globals.css';
import { useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import '@solana/wallet-adapter-react-ui/styles.css';
import { UmiProvider } from '@/contexts/UmiProvider';
import { ProgramProvider } from '@/contexts/ProgramProvider';
import Head from 'next/head'; // Import the Head component
import { Scroll, X } from 'lucide-react';

// --- START: Terms of Service Content ---
const TERMS_OF_SERVICE_MD = `
# TERMS OF SERVICE: OnlyFansSolana DEVNET MARKETPLACE

**Last Updated:** September 27, 2025

**IMPORTANT NOTICE: THIS IS A DEVNET/TESTING PLATFORM.**
THIS PLATFORM OPERATES EXCLUSIVELY ON THE SOLANA DEVELOPMENT NETWORK (DEVNET). ALL TOKENS, INCLUDING SOL AND NON-FUNGIBLE TOKENS (NFTS), HAVE **NO MONETARY VALUE** AND CANNOT BE EXCHANGED FOR REAL CURRENCY, MAINNET TOKENS, OR OTHER REAL-WORLD ASSETS. BY ACCESSING OR USING THIS SERVICE, YOU ACKNOWLEDGE AND ACCEPT THE RISKS ASSOCIATED WITH EXPERIMENTAL SOFTWARE, INCLUDING POTENTIAL LOSS OF TEST DATA AND ASSETS.

---

## 1. Acceptance of Terms

By using the services provided by OnlyFansSolana (referred to as "We," "Us," or "Our") through the OnlyFansSolana Devnet Marketplace ("the Service"), you agree to be bound by these Terms of Service (the "Terms"). If you do not agree to these Terms, do not use the Service.

**The primary purpose of the Service is to facilitate testing, development, and debugging of decentralized applications. It is not intended for commercial use.**

## 2. Devnet & Experimental Status Disclaimers

### 2.1. NO MONETARY VALUE

1. **Test Tokens Only:** All transactions on the Service use tokens (SOL and NFTs) obtained from the Solana Devnet faucet. These tokens are for testing purposes only and **possess zero (0) economic or financial value**.

2. **No Financial Liability:** We are not responsible for, and you will not have any claim against us for, any purported monetary loss, capital gain, tax liability, or financial damages arising from the use of, loss of, or changes to any Devnet assets.

3. **No Future Guarantee:** Your participation in the Devnet does not entitle you to any future compensation, airdrops, ownership, or rights on the Solana Mainnet, Testnet, or any future production environment.

### 2.2. SOFTWARE AS-IS & NO WARRANTY

The Service is provided on an **"AS IS"** and **"AS AVAILABLE"** basis. We make no guarantees regarding its functionality, security, or availability. You acknowledge and agree that:

* The Service may contain bugs, errors, or security vulnerabilities.

* The underlying Solana Devnet may experience resets, instability, or downtime without notice.

* Any data, smart contracts, or tokens deployed or stored on Devnet may be permanently deleted or lost without recovery.

## 3. User Accounts and Access

### 3.1. Eligibility

By using the Service, you represent and warrant that you are of legal age to form a binding contract in your jurisdiction.

### 3.2. Wallet Connection

You are solely responsible for maintaining the security of your Solana wallet and private keys used to access the Service. We do not store or control your private keys and cannot recover access to your wallet. You acknowledge that if your Devnet wallet is compromised, we bear no responsibility.

## 4. User Conduct and Content (Intellectual Property)

### 4.1. Responsibility for Content

You are solely responsible for all content, including any underlying digital assets (art, code, video, etc.) and metadata, that you mint, upload, trade, or associate with an NFT on the Service ("User Content").

### 4.2. IP Representation and Warranty

By creating or trading User Content, you represent and warrant that:

1. You own all intellectual property rights (including copyright, trademark, and publicity rights) necessary to use, mint, and offer the User Content for sale, or you have secured all necessary licenses and permissions.

2. The User Content does not infringe upon the intellectual property rights or other proprietary rights of any third party.

3. The User Content complies with all applicable laws and is not unlawful, defamatory, or hateful.

### 4.3. Indemnification for IP Infringement

You agree to indemnify, defend, and hold harmless OnlyFansSolana from and against all claims, liabilities, damages, and expenses (including legal fees) arising from any breach of your IP representations in this Section 4, regardless of the Devnet status.

## 5. Smart Contract and Blockchain Risks

### 5.1. Smart Contract Integrity

You acknowledge that the smart contracts governing the Service are experimental. We make no warranty that the smart contracts are free of errors or vulnerabilities. You use all smart contracts deployed on this Devnet at your own testing risk.

### 5.2. Network Risk

You accept the inherent risks associated with the Solana Devnet, including, but not limited to: high latency, transaction failure, consensus errors, and intentional or unintentional network resets or forks.

## 6. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL OnlyFansSolana OR ITS AFFILIATES BE LIABLE FOR ANY CONSEQUENTIAL, INCIDENTAL, INDIRECT, SPECIAL, PUNITIVE, OR OTHER DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF TEST DATA, LOSS OF TEST TOKENS, OR ANY OTHER PECUNIARY LOSS) ARISING OUT OF OR IN ANY WAY RELATED TO YOUR USE OF THE SERVICE, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

## 7. Governing Law

These Terms shall be governed by the laws of Switzerland without regard to its conflict of law principles.

## 8. Modifications to Terms

We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. We will provide notice of material changes by updating the "Last Updated" date at the top of these Terms. By continuing to access or use the Service after those revisions become effective, you agree to be bound by the revised Terms.
`;
// --- END: Terms of Service Content ---

/**
 * Custom component to render the basic structure of the Markdown text as a modal.
 */
const SimpleMarkdownRenderer = ({ content, onClose }) => {
    const parts = content.split('\n').map(line => line.trim());
    const elements = [];
  
    for (let i = 0; i < parts.length; i++) {
      let line = parts[i];
  
      if (line.startsWith('# TERMS OF SERVICE:')) {
        elements.push(<h1 key={i} className="text-3xl font-bold mt-8 mb-4 text-center text-red-600/90">{line.substring(2).trim()}</h1>);
      } else if (line.startsWith('**Last Updated:')) {
        elements.push(<p key={i} className="text-sm font-medium text-center text-gray-500 mb-6">{line.substring(2, line.length - 2)}</p>);
      } else if (line.startsWith('**IMPORTANT NOTICE:')) {
        elements.push(<p key={i} className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 font-semibold text-lg text-center my-6 rounded-md">{line.substring(2, line.length - 2)}</p>);
      } else if (line.startsWith('---')) {
        elements.push(<hr key={i} className="my-6 border-gray-300" />);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-2xl font-semibold mt-6 mb-3 text-gray-700">{line.substring(3).trim()}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-xl font-medium mt-5 mb-2 text-gray-600">{line.substring(4).trim()}</h3>);
      } else if (line.startsWith('*')) {
        elements.push(<li key={i} className="list-disc ml-6 text-gray-600">{line.substring(1).trim()}</li>);
      } else if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
        elements.push(<li key={i} className="list-decimal ml-6 text-gray-600 mt-1"><span className="font-semibold text-gray-700">{line}</span></li>);
      } else if (line.length > 0) {
        // Basic paragraph/text handling
        const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(<p key={i} className="text-gray-400 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />);
      }
    }
  
    return (
      // Modal Overlay
      <div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex justify-center p-4 overflow-y-auto backdrop-blur-sm">
        <div className="bg-[#1f2033] text-gray-200 p-6 md:p-10 w-full max-w-4xl h-fit min-h-full rounded-xl shadow-2xl relative border border-indigo-700">
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-[#2a2a40] hover:bg-[#3b3b55] text-white/80 rounded-full transition duration-150 z-10"
          >
            <X size={24} />
          </button>
  
          {/* Content Header */}
          <div className="text-center pb-4 border-b border-indigo-700">
            <h1 className="text-3xl font-extrabold text-pink-500">Service Agreement</h1>
            <p className="text-sm text-gray-400">Mandatory Review for Devnet Use</p>
          </div>
  
          {/* Rendered ToS Content */}
          <div className="pt-4 space-y-3 pb-24">
            {elements}
          </div>
          
          {/* Footer for scrolling/acceptance */}
          <div className="sticky bottom-0 left-0 right-0 bg-[#1f2033] p-4 border-t border-indigo-700 text-center mt-6 rounded-b-xl z-5">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-pink-600 text-white font-bold rounded-lg shadow-lg shadow-pink-600/30 hover:bg-pink-700 transition duration-150 transform hover:scale-[1.02]"
            >
              I Understand and Accept Devnet Terms
            </button>
          </div>
        </div>
      </div>
    );
  };


function AppContent({ Component, pageProps }) {
  const [showTOS, setShowTOS] = useState(false); // State to control TOS modal visibility

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

  const wallets = useMemo(() => {
    // Check for window existence is necessary for server-side rendering
    if (typeof window === 'undefined') return []; 
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, []);

  // Handler to close the modal (and implicitly "accept" the terms for now)
  const handleAcceptTOS = () => {
    setShowTOS(false);
    // In a production environment, this is where you would log acceptance or set a persistent state (like a cookie).
  };

  return (
    <>
    <Head>
        <title>OnlyFansSolana</title>
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
              <Link href="/my-content">  
                <button className="button">My Content</button>
              </Link>
              <Link href="/litepaper">  
                <button className="button">Litepaper</button>
              </Link>
              {/* TOS Button added to the navigation */}
              <Link href="/terms-of-service">
                <button
                  className="button bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-1"
                  aria-label="View Terms of Service"
                >
                  Terms of Service
                </button>
              </Link>
            </div>
            <div>
            </div>
          </div>
        </nav>
          {/* Page content */}
          <UmiProvider>   
            <ProgramProvider>
          <Component {...pageProps} />
          </ProgramProvider>
          </UmiProvider>   
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
    
    {/* Conditional Rendering of TOS Modal */}
    {showTOS && (
        <SimpleMarkdownRenderer 
            content={TERMS_OF_SERVICE_MD} 
            onClose={handleAcceptTOS} 
        />
    )}
    </>
  );
}

// Disable SSR for wallet adapter to prevent hydration mismatch
const App = dynamic(() => Promise.resolve(AppContent), { ssr: false });

export default App;