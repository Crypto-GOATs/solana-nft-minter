"use client";

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram } from '@/contexts/ProgramProvider';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from '@metaplex-foundation/umi';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { DollarSign, TrendingUp, Activity, Eye, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Helper function to fetch NFT metadata
const fetchNFTMetadata = async (mintAddress, connection, wallet) => {
  try {
    const umi = createUmi(connection)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());

    const mint = publicKey(mintAddress);
    const asset = await fetchDigitalAsset(umi, mint);

    if (asset.metadata.uri) {
      const response = await fetch(asset.metadata.uri);
      const metadata = await response.json();

      return {
        name: asset.metadata.name || metadata.name || 'Unknown NFT',
        image: metadata.image || null,
        description: metadata.description || '',
      };
    }

    return {
      name: asset.metadata.name || 'Unknown NFT',
      image: null,
      description: '',
    };
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return {
      name: 'Unknown NFT',
      image: null,
      description: '',
    };
  }
};

const NFTCard = ({ nft, onUnlist, isUnlisting }) => {
  const priceInSOL = nft.account?.price ? (nft.account.price.toNumber() / 1_000_000_000).toFixed(2) : 'N/A';
  const isSold = nft.account?.closed;
  
  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '200px', height: '200px', flexShrink: 0 }}>
          {nft.metadata?.image ? (
            <img
              src={nft.metadata.image}
              alt={nft.metadata.name}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                borderRadius: '8px',
                filter: isSold ? 'grayscale(50%)' : 'none'
              }}
              onError={(e) => e.target.src = '/placeholder-image.svg'}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              backgroundColor: '#f3f4f6', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '8px',
              color: '#6b7280'
            }}>
              No Image
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>
            {nft.metadata?.name || 'Unknown NFT'}
          </h3>
          
          {nft.metadata?.description && (
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 12px 0' }}>
              {nft.metadata.description}
            </p>
          )}
          
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>Price:</strong> {priceInSOL} SOL
            </div>
            <div style={{ marginBottom: '4px' }}>
              <strong>Status:</strong>{' '}
              <span className="tag" style={{ 
                backgroundColor: isSold ? '#10b981' : '#f59e0b',
                color: 'white'
              }}>
                {isSold ? 'Sold' : 'Listed'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isSold && (
              <button
                className="button"
                onClick={() => onUnlist(nft)}
                disabled={isUnlisting}
                style={{ backgroundColor: isUnlisting ? '#6b7280' : '#ef4444' }}
              >
                {isUnlisting ? 'Unlisting...' : 'Unlist NFT'}
              </button>
            )}
            
            {!isSold && (
              <button
                className="button"
                disabled
                style={{ backgroundColor: '#6b7280' }}
              >
                Edit Price (Soon)
              </button>
            )}

            {isSold && (
              <span style={{ 
                color: '#10b981', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center'
              }}>
                ✅ Successfully Sold!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MyNFTs() {
  const { publicKey: walletPublicKey, connected } = useWallet();
  const wallet = useWallet();
  const { program, error: programError } = useProgram();
  const [nfts, setNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [unlisting, setUnlisting] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchNFTs = async () => {
    if (!program) return;
    try {
      setLoading(true);
      setFetchError(null);
      
      if (!program.account?.listing) {
        setFetchError("Program listing account not found.");
        return;
      }
      const allListings = await program.account.listing.all();
      const myListings = allListings.filter(listing => 
        listing.account.seller.equals(walletPublicKey)
      );

      const nftsWithMetadata = await Promise.all(
        myListings.map(async (listing) => {
          const metadata = await fetchNFTMetadata(
            listing.account.mint.toString(),
            program.provider.connection,
            wallet
          );
          return { ...listing, metadata };
        })
      );
      setNFTs(nftsWithMetadata);
    } catch (err) {
      console.error("Error fetching NFTs:", err);
      setFetchError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected && program) {
      fetchNFTs();
    } else {
      setNFTs([]);
    }
  }, [program, walletPublicKey, connected, wallet]);

  const handleUnlistNFT = async (listing) => {
    if (!program || !walletPublicKey) return;
    try {
      setUnlisting(listing.publicKey.toString());
      
      const mintAddress = listing.account.mint;
      const tokenAccount = getAssociatedTokenAddressSync(mintAddress, walletPublicKey);
      
      const unlistTransaction = await program.methods.unlistNft()
        .accounts({
          listing: listing.publicKey,
          mint: mintAddress,
          seller: walletPublicKey,
          sellerTokenAccount: tokenAccount,
        })
        .transaction();
      
      const txId = await program.provider.sendAndConfirm(unlistTransaction);
      console.log('Unlist transaction successful:', txId);
      
      await fetchNFTs(); // Refresh the NFT list
      alert('NFT unlisted successfully!');

    } catch (err) {
      console.error("Error unlisting NFT:", err);
      alert(`Failed to unlist NFT: ${err.message}`);
    } finally {
      setUnlisting(null);
    }
  };

  // Use useMemo to calculate statistics and chart data
  const { totalEarnings, totalSales, averageEarning, chartData } = useMemo(() => {
    const soldItems = nfts.filter(nft => nft.account.closed);
    const total = soldItems.reduce((sum, item) => {
      return sum + (item.account.price.toNumber() / 1_000_000_000);
    }, 0);
    const count = soldItems.length;
    const average = count > 0 ? total / count : 0;
    
    // Prepare data for the chart, assuming your 'listing' account has a timestamp
    const soldItemsWithDate = soldItems.map(item => ({
      amount: item.account.price.toNumber() / 1_000_000_000,
      // You'll need to replace this with the actual timestamp field from your program's account
      date: new Date(item.account.timestamp ? item.account.timestamp.toNumber() * 1000 : Date.now()).toLocaleDateString(),
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    let cumulativeEarnings = 0;
    const data = soldItemsWithDate.map(item => {
      cumulativeEarnings += item.amount;
      return {
        date: item.date,
        amount: cumulativeEarnings,
      };
    });

    const aggregatedData = data.reduce((acc, curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) {
        existing.amount = curr.amount;
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);

    return {
      totalEarnings: total,
      totalSales: count,
      averageEarning: average,
      chartData: aggregatedData
    };
  }, [nfts]);

  const filteredNFTs = nfts.filter(nft => {
    if (filter === 'listed') return !nft.account.closed;
    if (filter === 'sold') return nft.account.closed;
    return true;
  });

  const listedCount = nfts.filter(nft => !nft.account.closed).length;
  const soldCount = nfts.filter(nft => nft.account.closed).length;

  const renderContent = () => {
    if (programError) {
      return <p style={{ color: 'red' }}>Program error: {programError}</p>;
    }
    if (!program) {
      return <p>Loading program...</p>;
    }
    if (!connected) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view your NFTs.</p>
        </div>
      );
    }
    if (loading) {
      return (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={20} style={{ 
              animation: 'spin 1s linear infinite',
              color: '#3b82f6'
            }} />
            <div>
              <div style={{ fontWeight: 'bold' }}>Loading your NFTs...</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Fetching listing and sales data from the platform.
              </div>
            </div>
          </div>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }
    if (fetchError) {
      return <p style={{ color: 'red' }}>Error: {fetchError}</p>;
    }
    if (filteredNFTs.length === 0 && nfts.length > 0) {
      return <p>No NFTs match the selected filter.</p>;
    }
    if (nfts.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No NFTs Listed</h3>
          <p>You haven't listed any NFTs for sale yet.</p>
          <button 
            className="button"
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '16px' }}
          >
            Mint & List an NFT
          </button>
        </div>
      );
    }
    return (
      <div>
        {filteredNFTs.map((nft, index) => (
          <NFTCard 
            key={nft.publicKey?.toString() || index}
            nft={nft} 
            onUnlist={handleUnlistNFT}
            isUnlisting={unlisting === nft.publicKey?.toString()}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1>My listings</h1>
        <WalletMultiButton />
      </div>
      
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>My Earnings</h2>
      
      {connected && nfts.length > 0 && (
        <>
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
              <Activity size={24} style={{ color: '#8b5cf6', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px 0', color: '#8b5cf6' }}>
                {totalSales}
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
          
          {chartData.length > 0 && (
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
          )}
        </>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span className="tag">Total: {nfts.length}</span>
          <span className="tag">Listed: {listedCount}</span>
          <span className="tag">Sold: {soldCount}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="button"
            onClick={() => setFilter('all')}
            style={{ 
              backgroundColor: filter === 'all' ? '#3b82f6' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px'
            }}
          >
            All ({nfts.length})
          </button>
          <button
            className="button"
            onClick={() => setFilter('listed')}
            style={{ 
              backgroundColor: filter === 'listed' ? '#3b82f6' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px'
            }}
          >
            Listed ({listedCount})
          </button>
          <button
            className="button"
            onClick={() => setFilter('sold')}
            style={{ 
              backgroundColor: filter === 'sold' ? '#3b82f6' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px'
            }}
          >
            Sold ({soldCount})
          </button>
        </div>
      </div>
      
      {renderContent()}
      
      <p className="footer">Manage your listed NFTs and track your sales.</p>
    </div>
  );
}