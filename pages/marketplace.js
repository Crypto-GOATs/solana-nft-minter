"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram } from "@/contexts/ProgramProvider";
import * as anchor from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from '@metaplex-foundation/umi';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

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
    console.error('Error fetching Fan NFT metadata:', error);
    return {
      name: 'Unknown Fan NFT',
      image: null,
      description: '',
    };
  }
};

const NFTCard = ({ listing, onBuy, isPurchasing }) => {
  const sellerAddressShort = listing.account.seller.toString().slice(0, 4) + '...' + listing.account.seller.toString().slice(-4);
  const priceInSOL = (listing.account.price.toNumber() / 1_000_000_000).toFixed(2);

  return (
    <div className="card" style={{ 
      padding: '20px', 
      marginBottom: '20px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ width: '220px', height: '220px', flexShrink: 0 }}>
          {listing.metadata?.image ? (
            <img
              src={listing.metadata.image}
              alt={listing.metadata.name}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                borderRadius: '12px',
                border: '2px solid #e2e8f0'
              }}
              onError={(e) => e.target.src = '/placeholder-image.svg'}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              backgroundColor: '#f8fafc', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '12px',
              color: '#9945FF',
              fontSize: '64px',
              border: '2px dashed #e2e8f0'
            }}>
              🪭
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 12px 0',
            fontSize: '24px',
            background: "linear-gradient(45deg, #9945FF, #14F195)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent",
            fontWeight: 'bold'
          }}>
            {listing.metadata?.name || 'Premium Fan NFT'}
          </h3>
          
          {listing.metadata?.description && (
            <p style={{ 
              color: '#6b7280', 
              fontSize: '16px', 
              margin: '0 0 16px 0',
              lineHeight: '1.5'
            }}>
              {listing.metadata.description}
            </p>
          )}
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              marginBottom: '8px',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <strong style={{ color: '#14F195' }}>Price:</strong>{' '}
              <span style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: '#9945FF'
              }}>
                {priceInSOL} SOL
              </span>
            </div>
            <div style={{ 
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <strong style={{ color: '#6b7280' }}>Creator:</strong>{' '}
              <code style={{ 
                backgroundColor: '#e2e8f0',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {sellerAddressShort}
              </code>
            </div>
          </div>
          
          <button
            className="button"
            onClick={() => onBuy(listing)}
            disabled={isPurchasing}
            style={{ 
              background: isPurchasing 
                ? '#6b7280' 
                : 'linear-gradient(45deg, #9945FF, #14F195)',
              border: 'none',
              color: 'white',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '8px',
              cursor: isPurchasing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {isPurchasing ? 'Purchasing Fan...' : 'Buy This Fan NFT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Marketplace() {
  const { publicKey: walletPublicKey, connected } = useWallet();
  const wallet = useWallet();
  const { program, error: programError } = useProgram();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [purchasing, setPurchasing] = useState(null);

  const fetchListings = async () => {
    if (!program) return;
    try {
      setLoading(true);
      setFetchError(null);
      
      if (!program.account?.listing) {
        setFetchError("Listing account not found in program");
        return;
      }
      const allListings = await program.account.listing.all();
      const activeListings = allListings.filter((l) => 
        !l.account.closed && 
        (!walletPublicKey || !l.account.seller.equals(walletPublicKey))
      );
      const listingsWithMetadata = await Promise.all(
        activeListings.map(async (listing) => {
          const metadata = await fetchNFTMetadata(
            listing.account.mint.toString(),
            program.provider.connection,
            wallet
          );
          return { ...listing, metadata };
        })
      );
      setListings(listingsWithMetadata);
    } catch (err) {
      console.error("Error fetching Fan NFT listings:", err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected && program) {
      fetchListings();
    } else {
      setListings([]);
    }
  }, [program, connected, walletPublicKey, wallet]);

  const buyNFT = async (listing) => {
    if (!program || !walletPublicKey) {
      alert("Program or wallet not available");
      return;
    }
    try {
      setPurchasing(listing.publicKey.toString());

      const mint = listing.account.mint;
      const [listingPDA, _bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.toBuffer()],
        program.programId
      );
      const [escrowTokenAccount, _escrowBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), mint.toBuffer()],
        program.programId
      );
      const buyerTokenAccount = getAssociatedTokenAddressSync(mint, walletPublicKey);

      const connection = program.provider.connection;
      const buyerTokenAccountInfo = await connection.getAccountInfo(buyerTokenAccount);
      
      let preInstructions = [];
      if (!buyerTokenAccountInfo) {
        console.log('Creating buyer token account...');
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            walletPublicKey,
            buyerTokenAccount,
            walletPublicKey,
            mint
          )
        );
      }

      const methodToCall = program.methods?.buyNft || program.rpc?.buyNft;
      if (!methodToCall) throw new Error("buyNft method not found on program");

      let txBuilder = methodToCall()
        .accounts({
          listing: listing.publicKey,
          buyer: walletPublicKey,
          seller: listing.account.seller,
          escrowTokenAccount: escrowTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          mint: mint,
          tokenProgram: anchor.web3.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        });

      if (preInstructions.length > 0) {
        txBuilder = txBuilder.preInstructions(preInstructions);
      }

      await txBuilder.rpc();
      alert("Purchase successful! This premium fan NFT is now yours.");
      fetchListings();
    } catch (err) {
      console.error("Error buying Fan NFT:", err);
      alert(`Purchase failed: ${err.message}`);
    } finally {
      setPurchasing(null);
    }
  };

  const renderContent = () => {
    if (programError) {
      return <p style={{ color: 'red' }}>Program error: {programError}</p>;
    }
    if (!program) {
      return <p>Loading OnlyFans marketplace...</p>;
    }
    if (!connected) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪭</div>
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to browse premium fan NFTs.</p>
        </div>
      );
    }
    if (loading) {
      return (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '20px',
              height: '20px',
              border: '2px solid #e2e8f0',
              borderTop: '2px solid #9945FF',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div>
              <div style={{ fontWeight: 'bold' }}>Loading premium fan marketplace...</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Discovering the finest electric fan NFTs for you.
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
    if (listings.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🪭</div>
          <h3 style={{ 
            fontSize: '24px',
            background: "linear-gradient(45deg, #9945FF, #14F195)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent",
            marginBottom: '12px'
          }}>
            No Premium Fans Available
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Be the first to list your electric fan NFT on this exclusive marketplace!
          </p>
          <button 
            className="button"
            onClick={() => window.location.href = '/'}
            style={{ 
              background: 'linear-gradient(45deg, #9945FF, #14F195)',
              border: 'none',
              color: 'white',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '8px'
            }}
          >
            Create Your First Fan NFT
          </button>
        </div>
      );
    }
    return (
      <div>
        {listings.map((listing) => (
          <NFTCard 
            key={listing.publicKey.toString()} 
            listing={listing} 
            onBuy={buyNFT} 
            isPurchasing={purchasing === listing.publicKey.toString()} 
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
                OnlyFans
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
              Fan Marketplace
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: "14px", 
              color: "#64748b", 
              fontStyle: "italic" 
            }}>
              Discover Premium Electric Fan NFTs
            </p>
          </div>
        </div>
        <WalletMultiButton />
      </div>
      
      {/* Hero Section */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '40px', 
        padding: '30px 20px',
        background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.1), rgba(20, 241, 149, 0.1))',
        borderRadius: '16px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ 
          fontSize: '28px', 
          margin: '0 0 12px 0',
          background: "linear-gradient(45deg, #9945FF, #14F195)", 
          WebkitBackgroundClip: "text", 
          WebkitTextFillColor: "transparent",
          fontWeight: 'bold'
        }}>
          The World's Most Exclusive Fan Collection
        </h2>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280', 
          maxWidth: '600px', 
          margin: '0 auto',
          lineHeight: '1.6'
        }}>
          Each electric fan NFT is AI-verified for authenticity and exclusively minted on Solana. 
          Join the premium fan collector community today.
        </p>
        
        {/* Stats */}
        <div style={{ 
          marginTop: '24px', 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '32px',
          flexWrap: 'wrap'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#9945FF',
              marginBottom: '4px'
            }}>
              {listings.length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Available Fans
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#14F195',
              marginBottom: '4px'
            }}>
              100%
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              AI Verified
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#9945FF',
              marginBottom: '4px'
            }}>
              Solana
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Powered
            </div>
          </div>
        </div>
      </div>
      
      <div>
        {renderContent()}
      </div>
      
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
          Browse, discover, and collect the world's finest electric fan NFTs
        </p>
        <p style={{ 
          color: '#9945FF', 
          fontSize: '12px',
          margin: 0,
          fontWeight: '500'
        }}>
          OnlyFans - Where Every Fan Finds Their Perfect Match™
        </p>
      </div>
    </div>
  );
}