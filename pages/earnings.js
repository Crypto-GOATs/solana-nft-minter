"use client";

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram } from '@/contexts/ProgramProvider';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from '@metaplex-foundation/umi';
import { DollarSign, TrendingUp, Calendar, Eye, RefreshCw, Activity } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Helper function to fetch NFT metadata with improved error handling
const fetchNFTMetadata = async (mintAddress, connection, wallet) => {
  try {
    const umi = createUmi(connection)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());

    const mint = publicKey(mintAddress);
    const asset = await fetchDigitalAsset(umi, mint);

    let metadata = {
      name: asset.metadata.name || 'Unknown NFT',
      image: null,
      description: '',
    };

    if (asset.metadata.uri) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(asset.metadata.uri, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const jsonMetadata = await response.json();
          metadata = {
            name: asset.metadata.name || jsonMetadata.name || 'Unknown NFT',
            image: jsonMetadata.image || null,
            description: jsonMetadata.description || '',
          };
        }
      } catch (fetchError) {
        console.warn(`Metadata fetch failed for ${mintAddress}:`, fetchError.message);
      }
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return {
      name: 'Unknown NFT',
      image: null,
      description: '',
    };
  }
};

// Helper function to get recent transactions for earnings analysis
const getWalletTransactions = async (connection, walletPublicKey, limit = 100) => {
  try {
    const signatures = await connection.getSignaturesForAddress(
      walletPublicKey,
      { limit }
    );
    return signatures;
  } catch (error) {
    console.error('Error fetching transaction signatures:', error);
    return [];
  }
};

// Helper function to analyze transactions for NFT marketplace earnings
const analyzeTransactionForEarnings = async (connection, signature, walletPublicKey, programId) => {
  try {
    const transaction = await connection.getTransaction(signature.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!transaction || !transaction.meta) return null;

    // Check if transaction was successful
    if (transaction.meta.err) return null;

    // Get account keys
    const accountKeys = transaction.transaction.message.getAccountKeys();
    const walletIndex = Array.from(accountKeys).findIndex(key => key.equals(walletPublicKey));
    
    if (walletIndex === -1) return null;

    // Check if this involves our marketplace program
    const involvesProgramId = Array.from(accountKeys).some(key => key.equals(programId));
    if (!involvesProgramId) return null;

    // Calculate balance change for the wallet
    const preBalance = transaction.meta.preBalances[walletIndex] || 0;
    const postBalance = transaction.meta.postBalances[walletIndex] || 0;
    const balanceChange = (postBalance - preBalance) / 1_000_000_000; // Convert lamports to SOL

    // Only consider positive balance changes as earnings
    if (balanceChange <= 0) return null;

    // Parse logs to determine if this was a sale
    const logs = transaction.meta.logMessages || [];
    const isSale = logs.some(log => 
      log.includes('buy_nft') || 
      log.includes('NFT sold') ||
      log.includes('Instruction: BuyNft')
    );

    if (!isSale) return null;

    return {
      signature: signature.signature,
      amount: balanceChange,
      timestamp: signature.blockTime * 1000,
      type: 'sale',
      date: new Date(signature.blockTime * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    return null;
  }
};

// Helper function to get earnings from marketplace listings
const getListingSaleEarnings = async (program, walletPublicKey) => {
  try {
    if (!program.account?.listing) return [];

    // Get all listings
    const allListings = await program.account.listing.all();
    
    // Find sold listings where user was the seller
    const soldListings = allListings.filter(listing => 
      listing.account.seller.equals(walletPublicKey) && 
      listing.account.closed
    );

    // Convert to earnings format
    return soldListings.map(listing => ({
      signature: listing.publicKey.toString(),
      amount: listing.account.price.toNumber() / 1_000_000_000,
      type: 'sale',
      date: new Date().toISOString().split('T')[0], // We don't have exact sale date from listing
      nftMint: listing.account.mint.toString(),
      listingAddress: listing.publicKey.toString()
    }));
  } catch (error) {
    console.error('Error fetching listing earnings:', error);
    return [];
  }
};

const EarningCard = ({ earning }) => {
  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: earning.type === 'sale' ? '#10b981' : '#3b82f6' 
            }}></div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              {earning.nftName || 'NFT Sale'}
            </h3>
            <span className="tag" style={{ 
              backgroundColor: earning.type === 'sale' ? '#10b981' : '#3b82f6',
              color: 'white',
              fontSize: '12px'
            }}>
              Sale
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DollarSign size={16} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                {earning.amount.toFixed(3)} SOL
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b7280' }}>
              <Calendar size={16} />
              <span style={{ fontSize: '14px' }}>
                {new Date(earning.date).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {earning.signature && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              <a 
                href={`https://explorer.solana.com/tx/${earning.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                View Transaction ↗
              </a>
            </div>
          )}
          
          {earning.listingAddress && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Listing: {earning.listingAddress.slice(0, 8)}...{earning.listingAddress.slice(-8)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function EarningsTracker() {
  const { publicKey: walletPublicKey, connected } = useWallet();
  const wallet = useWallet();
  const { program, error: programError } = useProgram();
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchingTransactions, setFetchingTransactions] = useState(false);
  const [fetchingListings, setFetchingListings] = useState(false);

  // Fetch earnings automatically from blockchain
  const fetchEarnings = async () => {
    if (!program || !connected || !walletPublicKey) return;
    
    try {
      setLoading(true);
      setFetchError(null);
      
      console.log('Fetching earnings for wallet:', walletPublicKey.toString());
      
      const allEarnings = [];
      
      // Method 1: Get earnings from marketplace listings (more reliable)
      setFetchingListings(true);
      const listingEarnings = await getListingSaleEarnings(program, walletPublicKey);
      console.log(`Found ${listingEarnings.length} earnings from marketplace listings`);
      
      // Fetch metadata for listing earnings
      for (const earning of listingEarnings) {
        if (earning.nftMint) {
          try {
            const metadata = await fetchNFTMetadata(
              earning.nftMint,
              program.provider.connection,
              wallet
            );
            earning.nftName = metadata.name;
          } catch (error) {
            console.warn('Failed to fetch metadata for NFT:', earning.nftMint);
            earning.nftName = 'Unknown NFT';
          }
        }
      }
      
      allEarnings.push(...listingEarnings);
      setFetchingListings(false);
      
      // Method 2: Analyze recent transactions for additional earnings
      setFetchingTransactions(true);
      const signatures = await getWalletTransactions(
        program.provider.connection, 
        walletPublicKey,
        50 // Check last 50 transactions
      );
      
      console.log(`Analyzing ${signatures.length} recent transactions`);
      
      const transactionEarnings = [];
      
      // Process transactions in small batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < Math.min(signatures.length, 20); i += batchSize) { // Limit to 20 most recent
        const batch = signatures.slice(i, i + batchSize);
        
        const batchPromises = batch.map(sig => 
          analyzeTransactionForEarnings(
            program.provider.connection,
            sig,
            walletPublicKey,
            program.programId
          )
        );
        
        const results = await Promise.all(batchPromises);
        
        results.forEach(result => {
          if (result) {
            // Check if we already have this earning from listings
            const existingEarning = allEarnings.find(e => 
              e.signature === result.signature ||
              (e.amount === result.amount && Math.abs(new Date(e.date) - new Date(result.date)) < 86400000) // Same day, same amount
            );
            
            if (!existingEarning) {
              transactionEarnings.push({
                ...result,
                nftName: 'NFT Sale',
                id: result.signature
              });
            }
          }
        });
        
        // Small delay between batches
        if (i + batchSize < Math.min(signatures.length, 20)) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`Found ${transactionEarnings.length} additional earnings from transactions`);
      allEarnings.push(...transactionEarnings);
      setFetchingTransactions(false);
      
      // Sort by timestamp (newest first) and remove duplicates
      const uniqueEarnings = allEarnings.reduce((acc, current) => {
        const existingIndex = acc.findIndex(item => 
          item.signature === current.signature ||
          (Math.abs(item.amount - current.amount) < 0.001 && 
           Math.abs(new Date(item.date) - new Date(current.date)) < 86400000)
        );
        
        if (existingIndex === -1) {
          acc.push({
            ...current,
            id: current.signature || current.listingAddress || Date.now() + Math.random()
          });
        }
        return acc;
      }, []);
      
      uniqueEarnings.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log(`Total unique earnings found: ${uniqueEarnings.length}`);
      setEarnings(uniqueEarnings);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error("Error fetching earnings:", err);
      setFetchError(err.message || 'Failed to fetch earnings data');
    } finally {
      setLoading(false);
      setFetchingTransactions(false);
      setFetchingListings(false);
    }
  };

  useEffect(() => {
    if (connected && program && walletPublicKey) {
      fetchEarnings();
    } else {
      setEarnings([]);
    }
  }, [program, walletPublicKey, connected]);

  // Calculate statistics
  const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
  const saleEarnings = earnings.filter(e => e.type === 'sale').reduce((sum, e) => sum + e.amount, 0);
  const royaltyEarnings = earnings.filter(e => e.type === 'royalty').reduce((sum, e) => sum + e.amount, 0);
  const averageEarning = earnings.length > 0 ? totalEarnings / earnings.length : 0;

  // Prepare data for the chart
  const chartData = useMemo(() => {
    if (earnings.length === 0) return [];
    
    // Sort earnings by date (oldest first) for correct cumulative calculation
    const sortedEarnings = [...earnings].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let cumulativeEarnings = 0;
    const data = sortedEarnings.map(e => {
      cumulativeEarnings += e.amount;
      return {
        date: new Date(e.date).toLocaleDateString(),
        amount: cumulativeEarnings,
      };
    });

    // Aggregate data by date to avoid multiple points on the same day
    const aggregatedData = data.reduce((acc, curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) {
        existing.amount = curr.amount; // Use the latest cumulative amount for that day
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);

    return aggregatedData;
  }, [earnings]);

  // Filter earnings
  const filteredEarnings = earnings.filter(earning => {
    if (filter === 'sales') return earning.type === 'sale';
    if (filter === 'royalties') return earning.type === 'royalty';
    return true;
  });

  const renderContent = () => {
    if (programError) {
      return <p style={{ color: 'red' }}>Program error: {programError}</p>;
    }
    if (!connected) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view your earnings from the blockchain.</p>
        </div>
      );
    }
    
    return (
      <>
        {/* Statistics Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <DollarSign size={24} style={{ color: '#10b981', marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 4px 0', color: '#10b981' }}>
              {totalEarnings.toFixed(3)} SOL
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Total Earnings</p>
          </div>
          
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <TrendingUp size={24} style={{ color: '#3b82f6', marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 4px 0', color: '#3b82f6' }}>
              {saleEarnings.toFixed(3)} SOL
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Sales</p>
          </div>
          
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <Activity size={24} style={{ color: '#8b5cf6', marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 4px 0', color: '#8b5cf6' }}>
              {earnings.length}
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Total Sales</p>
          </div>
          
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <Eye size={24} style={{ color: '#f59e0b', marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 4px 0', color: '#f59e0b' }}>
              {averageEarning.toFixed(3)} SOL
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Average Sale</p>
          </div>
        </div>
        
        {/* New Chart Component */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Total Earnings Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Loading States */}
        {(fetchingListings || fetchingTransactions) && (
          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={20} style={{ 
                animation: 'spin 1s linear infinite',
                color: '#3b82f6'
              }} />
              <div>
                <div style={{ fontWeight: 'bold' }}>Loading earnings data...</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {fetchingListings && 'Checking marketplace listings...'}
                  {fetchingTransactions && 'Analyzing recent transactions...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Last Updated & Refresh */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="button"
              onClick={() => setFilter('all')}
              style={{ 
                backgroundColor: filter === 'all' ? '#3b82f6' : '#6b7280',
                fontSize: '14px',
                padding: '6px 12px'
              }}
            >
              All ({earnings.length})
            </button>
            <button
              className="button"
              onClick={() => setFilter('sales')}
              style={{ 
                backgroundColor: filter === 'sales' ? '#3b82f6' : '#6b7280',
                fontSize: '14px',
                padding: '6px 12px'
              }}
            >
              Sales ({earnings.filter(e => e.type === 'sale').length})
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastUpdated && (
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              className="button"
              onClick={fetchEarnings}
              disabled={loading}
              style={{ 
                backgroundColor: loading ? '#6b7280' : '#3b82f6', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '14px',
                padding: '6px 12px'
              }}
            >
              <RefreshCw size={16} style={{ 
                animation: loading ? 'spin 1s linear infinite' : 'none'
              }} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error State */}
        {fetchError && (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#ef4444' }}>Error Loading Earnings</h3>
            <p style={{ color: '#6b7280' }}>{fetchError}</p>
            <button
              className="button"
              onClick={fetchEarnings}
              style={{ backgroundColor: '#3b82f6', marginTop: '16px' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Earnings List */}
        {!loading && !fetchError && (
          <>
            {filteredEarnings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <Activity size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <h3>No Earnings Found</h3>
                <p>
                  No NFT sales detected for your wallet. Start selling NFTs to see your earnings here!
                </p>
                <button 
                  className="button"
                  onClick={() => window.location.href = '/'}
                  style={{ backgroundColor: '#10b981', marginTop: '16px' }}
                >
                  Create & Sell NFTs
                </button>
              </div>
            ) : (
              <div>
                {filteredEarnings.map(earning => (
                  <EarningCard
                    key={earning.id}
                    earning={earning}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1>Earnings Tracker</h1>
        <WalletMultiButton />
      </div>
      
      {renderContent()}
      
      <p className="footer">
        Earnings are automatically detected from your blockchain transactions and marketplace listings.
      </p>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}