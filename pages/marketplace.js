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

const NFTCard = ({ listing, onBuy, isPurchasing }) => {
  const sellerAddressShort = listing.account.seller.toString().slice(0, 4) + '...' + listing.account.seller.toString().slice(-4);
  const priceInSOL = (listing.account.price.toNumber() / 1_000_000_000).toFixed(2);

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '200px', height: '200px', flexShrink: 0 }}>
          {listing.metadata?.image ? (
            <img
              src={listing.metadata.image}
              alt={listing.metadata.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
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
            {listing.metadata?.name || 'Unknown NFT'}
          </h3>
          
          {listing.metadata?.description && (
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 12px 0' }}>
              {listing.metadata.description}
            </p>
          )}
          
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>Price:</strong> {priceInSOL} SOL
            </div>
            <div>
              <strong>Seller:</strong> {sellerAddressShort}
            </div>
          </div>
          
          <button
            className="button"
            onClick={() => onBuy(listing)}
            disabled={isPurchasing}
            style={{ backgroundColor: isPurchasing ? '#6b7280' : '#3b82f6' }}
          >
            {isPurchasing ? 'Purchasing...' : 'Buy NFT'}
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
      console.error("Error fetching listings:", err);
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
      alert("Purchase successful! The NFT is now yours.");
      fetchListings();
    } catch (err) {
      console.error("Error buying NFT:", err);
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
      return <p>Loading program...</p>;
    }
    if (!connected) {
      return <p>Please connect your wallet to view the marketplace.</p>;
    }
    if (loading) {
      return <p>Loading marketplace...</p>;
    }
    if (fetchError) {
      return <p style={{ color: 'red' }}>Error: {fetchError}</p>;
    }
    if (listings.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No NFTs for Sale</h3>
          <p>Be the first to list an NFT on this marketplace!</p>
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1>NFT Marketplace</h1>
        <WalletMultiButton />
      </div>
      
      <div>
        <p style={{ marginBottom: '20px', color: '#6b7280' }}>
          Discover and collect unique digital assets.
        </p>
        {renderContent()}
      </div>
      
      <p className="footer">Browse and purchase NFTs from other creators.</p>
    </div>
  );
}