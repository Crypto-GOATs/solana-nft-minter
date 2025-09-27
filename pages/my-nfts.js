"use client";

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram } from '@/contexts/ProgramProvider';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from '@metaplex-foundation/umi';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { DollarSign, TrendingUp, Activity, Eye, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PublicKey, SystemProgram, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/web3.js";


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
        name: asset.metadata.name || metadata.name || 'Unknown Fan NFT',
        image: metadata.image || null,
        description: metadata.description || '',
      };
    }

    return {
      name: asset.metadata.name || 'Unknown Fan NFT',
      image: null,
      description: '',
    };
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return {
      name: 'Unknown Fan NFT',
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
              color: '#6b7280',
              fontSize: '48px'
            }}>
              🪭
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>
            {nft.metadata?.name || 'Unknown Fan NFT'}
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
                backgroundColor: isSold ? '#10b981' : '#9945FF',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px'
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
                {isUnlisting ? 'Unlisting...' : 'Unlist Fan NFT'}
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
                ✅ Fan Successfully Sold!
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
      console.error("Error fetching Fan NFTs:", err);
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
    
    // Add the escrow token account
    const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), mintAddress.toBuffer()],
      program.programId
    );
    
    const unlistTransaction = await program.methods.unlistNft()
      .accounts({
        listing: listing.publicKey,
        escrowTokenAccount: escrowTokenAccount, // ADD THIS
        mint: mintAddress,
        seller: walletPublicKey,
        sellerTokenAccount: tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID, // ADD THIS
        systemProgram: SystemProgram.programId, // ADD THIS
      })
      .transaction();
    
    const txId = await program.provider.sendAndConfirm(unlistTransaction);
    console.log('Unlist transaction successful:', txId);
    
    await fetchNFTs();
    alert('Fan NFT unlisted successfully!');

  } catch (err) {
    console.error("Error unlisting Fan NFT:", err);
    alert(`Failed to unlist Fan NFT: ${err.message}`);
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
          <p>Please connect your wallet to view your Fan NFTs.</p>
        </div>
      );
    }
    if (loading) {
      return (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={20} style={{ 
              animation: 'spin 1s linear infinite',
              color: '#9945FF'
            }} />
            <div>
              <div style={{ fontWeight: 'bold' }}>Loading your Fan NFTs...</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Fetching listing and sales data from SolanaOnlyFans marketplace.
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
      return <p>No Fan NFTs match the selected filter.</p>;
    }
    if (nfts.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪭</div>
          <h3>No Fan NFTs Listed</h3>
          <p>You haven't listed any electric fan NFTs for sale yet.</p>
          <button 
            className="button"
            onClick={() => window.location.href = '/'}
            style={{ 
              marginTop: '16px',
              background: 'linear-gradient(45deg, #9945FF, #14F195)',
              border: 'none',
              color: 'white'
            }}
          >
            Mint & List a Fan NFT
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Animated OnlyFans Logo */}
          <div style={{ width: "70px", height: "47px", flexShrink: 0 }}>
            <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="fanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                  <stop offset="50%" style={{stopColor:"#14F195", stopOpacity:1}} />
                  <stop offset="100%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                </linearGradient>
                
                <linearGradient id="solanaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                  <stop offset="100%" style={{stopColor:"#14F195", stopOpacity:1}} />
                </linearGradient>
                
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Fan background */}
              <circle cx="150" cy="80" r="45" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" opacity="0.8"/>
              
              {/* Spinning fan blades */}
              <g filter="url(#glow)">
                <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transformOrigin="150 80">
                  <animateTransform attributeName="transform" attributeType="XML"
                                    type="rotate" from="0 150 80" to="360 150 80"
                                    dur="1.5s" repeatCount="indefinite"/>
                </ellipse>
                
                <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transform="rotate(120 150 80)" transformOrigin="150 80">
                  <animateTransform attributeName="transform" attributeType="XML"
                                    type="rotate" from="120 150 80" to="480 150 80"
                                    dur="1.5s" repeatCount="indefinite"/>
                </ellipse>
                
                <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transform="rotate(240 150 80)" transformOrigin="150 80">
                  <animateTransform attributeName="transform" attributeType="XML"
                                    type="rotate" from="240 150 80" to="600 150 80"
                                    dur="1.5s" repeatCount="indefinite"/>
                </ellipse>
              </g>
              
              {/* Fan center */}
              <circle cx="150" cy="80" r="8" fill="#1e293b"/>
              <circle cx="150" cy="80" r="4" fill="url(#solanaGradient)"/>
              
              {/* Fan stand */}
              <rect x="147" y="115" width="6" height="25" fill="#475569" rx="3"/>
              <ellipse cx="150" cy="145" rx="20" ry="5" fill="#64748b"/>
              
              {/* Logo text */}
              <text x="150" y="170" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="bold" 
                    textAnchor="middle" fill="url(#solanaGradient)">
                SolanaOnlyFans
              </text>
              
              <text x="150" y="190" fontFamily="Arial, sans-serif" fontSize="10" 
                    textAnchor="middle" fill="#64748b" fontStyle="italic">
                Premium Electric Fan NFTs
              </text>
              
              {/* Wind effect lines */}
              <g opacity="0.4">
                <path d="M 200 60 Q 220 65 240 60" stroke="#14F195" strokeWidth="2" fill="none" strokeLinecap="round">
                  <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite"/>
                </path>
                <path d="M 205 75 Q 230 78 250 75" stroke="#14F195" strokeWidth="1.5" fill="none" strokeLinecap="round">
                  <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.7s" repeatCount="indefinite"/>
                </path>
                <path d="M 200 90 Q 225 95 245 90" stroke="#14F195" strokeWidth="1" fill="none" strokeLinecap="round">
                  <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.9s" repeatCount="indefinite"/>
                </path>
              </g>
              
              {/* NFT badge */}
              <rect x="10" y="10" width="30" height="15" rx="7" fill="#1e293b" opacity="0.9"/>
              <text x="25" y="21" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" 
                    textAnchor="middle" fill="#14F195">NFT</text>
            </svg>
          </div>
          
          {/* Title with gradient text */}
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: "32px", 
              background: "linear-gradient(45deg, #9945FF, #14F195)", 
              WebkitBackgroundClip: "text", 
              WebkitTextFillColor: "transparent",
              fontWeight: 'bold'
            }}>
              My Fan Collection
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: "14px", 
              color: "#64748b", 
              fontStyle: "italic" 
            }}>
              Manage Your Electric Fan NFT Portfolio
            </p>
          </div>
        </div>
        <WalletMultiButton />
      </div>
      
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: 'bold', 
        marginBottom: '16px',
        background: "linear-gradient(45deg, #9945FF, #14F195)", 
        WebkitBackgroundClip: "text", 
        WebkitTextFillColor: "transparent"
      }}>
        Fan Sales Analytics
      </h2>
      
      {connected && nfts.length > 0 && (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px', 
            marginBottom: '24px' 
          }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <DollarSign size={24} style={{ color: '#14F195', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px 0', color: '#14F195' }}>
                {totalEarnings.toFixed(3)} SOL
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Total Fan Earnings</p>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <Activity size={24} style={{ color: '#9945FF', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px 0', color: '#9945FF' }}>
                {totalSales}
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Fans Sold</p>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <Eye size={24} style={{ color: '#f59e0b', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px 0', color: '#f59e0b' }}>
                {averageEarning.toFixed(3)} SOL
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Average Fan Price</p>
            </div>
          </div>
          
          {chartData.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                marginBottom: '16px',
                background: "linear-gradient(45deg, #9945FF, #14F195)", 
                WebkitBackgroundClip: "text", 
                WebkitTextFillColor: "transparent"
              }}>
                Fan Sales Revenue Over Time
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#14F195" 
                    strokeWidth={2} 
                    dot={{ r: 4, fill: '#9945FF' }} 
                    activeDot={{ r: 8, fill: '#14F195' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span className="tag" style={{ backgroundColor: '#9945FF', color: 'white' }}>
            Total Fans: {nfts.length}
          </span>
          <span className="tag" style={{ backgroundColor: '#14F195', color: 'white' }}>
            Listed: {listedCount}
          </span>
          <span className="tag" style={{ backgroundColor: '#10b981', color: 'white' }}>
            Sold: {soldCount}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="button"
            onClick={() => setFilter('all')}
            style={{ 
              background: filter === 'all' ? 'linear-gradient(45deg, #9945FF, #14F195)' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px',
              border: 'none',
              color: 'white'
            }}
          >
            All Fans ({nfts.length})
          </button>
          <button
            className="button"
            onClick={() => setFilter('listed')}
            style={{ 
              background: filter === 'listed' ? 'linear-gradient(45deg, #9945FF, #14F195)' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px',
              border: 'none',
              color: 'white'
            }}
          >
            Listed ({listedCount})
          </button>
          <button
            className="button"
            onClick={() => setFilter('sold')}
            style={{ 
              background: filter === 'sold' ? 'linear-gradient(45deg, #9945FF, #14F195)' : '#6b7280',
              fontSize: '14px',
              padding: '6px 12px',
              border: 'none',
              color: 'white'
            }}
          >
            Sold ({soldCount})
          </button>
        </div>
      </div>
      
      {renderContent()}
      
      <div style={{ 
        textAlign: 'center', 
        marginTop: '40px', 
        padding: '20px',
        borderTop: '1px solid #e2e8f0'
      }}>
        <p style={{ 
          color: '#64748b', 
          fontSize: '14px',
          margin: '0 0 8px 0'
        }}>
          Track your premium electric fan NFT sales and manage your listings
        </p>
        <p style={{ 
          color: '#9945FF', 
          fontSize: '12px',
          margin: 0,
          fontWeight: '500'
        }}>
          SolanaOnlyFans - Where Fan Creators Build Their Empire
        </p>
      </div>
    </div>
  );
}