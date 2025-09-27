"use client";

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram } from '@/contexts/ProgramProvider';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from '@metaplex-foundation/umi';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import { Eye, Edit3, Trash2, DollarSign, Tag, Calendar, TrendingUp, Package, Grid, List } from 'lucide-react';

// Helper function to fetch all NFTs owned by the user (not just listed ones)
const fetchOwnedNFTs = async (connection, walletPublicKey) => {
  try {
    // Get all token accounts owned by the user
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const nftMints = [];
    
    // Filter for NFTs (tokens with decimals = 0 and amount = 1)
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      if (parsedInfo.tokenAmount.decimals === 0 && parsedInfo.tokenAmount.uiAmount === 1) {
        nftMints.push({
          mint: new PublicKey(parsedInfo.mint),
          tokenAccount: account.pubkey
        });
      }
    }

    return nftMints;
  } catch (error) {
    console.error('Error fetching owned Fan NFTs:', error);
    return [];
  }
};

// Helper function to fetch NFT metadata
const fetchNFTMetadata = async (mintAddress, connection, wallet) => {
  try {
    const umi = createUmi(connection)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());

    const mint = publicKey(mintAddress);
    const asset = await fetchDigitalAsset(umi, mint);

    let metadata = {
      name: asset.metadata.name || 'Unknown Fan NFT',
      image: null,
      description: '',
    };

    if (asset.metadata.uri) {
      try {
        // Add timeout and better error handling for fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(asset.metadata.uri, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const jsonMetadata = await response.json();
          metadata = {
            name: asset.metadata.name || jsonMetadata.name || 'Unknown Fan NFT',
            image: jsonMetadata.image || null,
            description: jsonMetadata.description || '',
          };
        } else {
          console.warn(`Failed to fetch metadata from ${asset.metadata.uri}: ${response.status}`);
        }
      } catch (fetchError) {
        console.warn(`Error fetching metadata from ${asset.metadata.uri}:`, fetchError.message);
        // Fall back to on-chain metadata only
      }
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching Fan NFT metadata for mint:', mintAddress, error);
    return {
      name: 'Unknown Fan NFT',
      image: null,
      description: '',
    };
  }
};

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8UQs7LsrC');

const ContentCard = ({ 
  nft, 
  onList, 
  onUnlist, 
  onEditPrice, 
  isListing, 
  isUnlisting, 
  isUpdatingPrice,
  view = 'grid' 
}) => {
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const isOwned = true;
  
  // Safety check - if no mint address, don't render this NFT
  if (!nft || !nft.mint) {
    console.warn('Invalid Fan NFT object:', nft);
    return null;
  }
  
  const handleEditPrice = () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }
    onEditPrice(nft, parseFloat(newPrice));
    setShowPriceEdit(false);
    setNewPrice('');
  };

  if (view === 'list') {
    return (
      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '80px', flexShrink: 0 }}>
            {nft.metadata?.image ? (
              <img
                src={nft.metadata.image}
                alt={nft.metadata.name}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: '8px',
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
                borderRadius: '8px',
                fontSize: '32px',
                color: '#9945FF'
              }}>
                🪭
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nft.metadata?.name || 'Premium Fan NFT'}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>
                {'Owned'}
              </span>
              <span className="tag" style={{ 
                backgroundColor: '#14F195',
                color: 'white',
                fontSize: '12px',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {'Owned'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {isOwned && (
              <button
                className="button"
                onClick={() => onList(nft)}
                disabled={isListing}
                style={{ 
                  background: isListing ? '#6b7280' : 'linear-gradient(45deg, #9945FF, #14F195)',
                  border: 'none',
                  color: 'white',
                  fontSize: '14px',
                  padding: '6px 12px'
                }}
              >
                {isListing ? 'Listing...' : 'List'}
              </button>
            )}
            
          </div>
        </div>
        
        {showPriceEdit && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              className="input"
              type="number"
              step="0.001"
              placeholder="New price in SOL"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              style={{ flex: 1, margin: 0 }}
            />
            <button
              className="button"
              onClick={handleEditPrice}
              disabled={isUpdatingPrice}
              style={{ 
                background: 'linear-gradient(45deg, #9945FF, #14F195)',
                border: 'none',
                color: 'white',
                fontSize: '14px',
                padding: '6px 12px'
              }}
            >
              {isUpdatingPrice ? 'Updating...' : 'Update'}
            </button>
            <button
              className="button"
              onClick={() => setShowPriceEdit(false)}
              style={{ 
                backgroundColor: '#6b7280',
                fontSize: '14px',
                padding: '6px 12px'
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Grid view
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
              borderRadius: '8px',
              color: '#9945FF',
              fontSize: '64px'
            }}>
              🪭
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 8px 0',
            background: "linear-gradient(45deg, #9945FF, #14F195)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent",
            fontWeight: 'bold'
          }}>
            {nft.metadata?.name || 'Premium Fan NFT'}
          </h3>
          
          {nft.metadata?.description && (
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 12px 0' }}>
              {nft.metadata.description}
            </p>
          )}
          
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>Status:</strong>{' '}
              <span className="tag" style={{ 
                backgroundColor: '#14F195',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {'Owned'}
              </span>
            </div>
            
          </div>
          
          {showPriceEdit && (
            <div style={{ 
              marginBottom: '12px', 
              padding: '12px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px' 
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  placeholder="New price in SOL"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  style={{ flex: 1, margin: 0 }}
                />
                <button
                  className="button"
                  onClick={handleEditPrice}
                  disabled={isUpdatingPrice}
                  style={{ 
                    background: 'linear-gradient(45deg, #9945FF, #14F195)',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  {isUpdatingPrice ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="button"
                  onClick={() => setShowPriceEdit(false)}
                  style={{ backgroundColor: '#6b7280' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isOwned && (
              <button
                className="button"
                onClick={() => onList(nft)}
                style={{ 
                  background: isListing ? '#6b7280' : 'linear-gradient(45deg, #9945FF, #14F195)',
                  border: 'none',
                  color: 'white'
                }}
              >
                {isListing ? 'Listing Fan...' : 'List Fan for Sale'}
              </button>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

const ListForSaleModal = ({ isOpen, onClose, onConfirm, nft, isListing }) => {
  const [price, setPrice] = useState('');
  
  const handleConfirm = () => {
    if (!price || parseFloat(price) <= 0) {
      alert('Please enter a valid price');
      return;
    }
    onConfirm(nft, parseFloat(price));
    setPrice('');
  };

  if (!isOpen || !nft) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        padding: '24px' 
      }}>
        <h2 style={{ 
          marginTop: 0,
          background: "linear-gradient(45deg, #9945FF, #14F195)", 
          WebkitBackgroundClip: "text", 
          WebkitTextFillColor: "transparent"
        }}>
          List Fan NFT for Sale
        </h2>
        
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          {nft.metadata?.image ? (
            <img
              src={nft.metadata.image}
              alt={nft.metadata.name}
              style={{ 
                width: '120px', 
                height: '120px', 
                objectFit: 'cover', 
                borderRadius: '8px',
                marginBottom: '8px'
              }}
            />
          ) : (
            <div style={{ 
              width: '120px', 
              height: '120px', 
              backgroundColor: '#f8fafc',
              margin: '0 auto 8px auto',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '8px',
              color: '#9945FF',
              fontSize: '48px'
            }}>
              🪭
            </div>
          )}
          <h3 style={{ margin: '8px 0' }}>{nft.metadata?.name || 'Premium Fan NFT'}</h3>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Price (SOL) *</label>
          <input
            className="input"
            type="number"
            step="0.001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.1"
            required
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            className="button"
            onClick={onClose}
            style={{ backgroundColor: '#6b7280' }}
          >
            Cancel
          </button>
          <button
            className="button"
            onClick={handleConfirm}
            disabled={isListing}
            style={{ 
              background: isListing ? '#6b7280' : 'linear-gradient(45deg, #9945FF, #14F195)',
              border: 'none',
              color: 'white'
            }}
          >
            {isListing ? 'Listing Fan...' : 'List Fan NFT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MyContent() {
  const { publicKey: walletPublicKey, connected, wallet } = useWallet();
  const { program, error: programError } = useProgram();
  const [nfts, setNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [listing, setListing] = useState(null);
  const [unlisting, setUnlisting] = useState(null);
  const [updatingPrice, setUpdatingPrice] = useState(null);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [showListModal, setShowListModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);

  const fetchNFTs = async () => {
    if (!program || !walletPublicKey) return;
    try {
      setLoading(true);
      setFetchError(null);
      
      // Get all NFTs owned by the user
      const ownedNFTs = await fetchOwnedNFTs(program.provider.connection, walletPublicKey);
      console.log(`Found ${ownedNFTs.length} owned Fan NFTs`);
      
      // Get all listings to check which NFTs are listed/sold
      let allListings = [];
      if (program.account?.listing) {
        allListings = await program.account.listing.all();
      }
      
      // Create a map of mint addresses to listing info
      const listingMap = new Map();
      allListings.forEach(listing => {
        listingMap.set(listing.account.mint.toString(), {
          publicKey: listing.publicKey,
          account: listing.account
        });
      });

      const nftsWithMetadata = await Promise.allSettled(
        ownedNFTs.map(async (nft) => {
          try {
            const metadata = await fetchNFTMetadata(
              nft.mint.toString(),
              program.provider.connection,
              wallet
            );
            
            // Check if this NFT has a listing
            const listingInfo = listingMap.get(nft.mint.toString());
            
            return {
              mint: nft.mint,
              tokenAccount: nft.tokenAccount,
              metadata,
              // Include listing info if it exists
              ...(listingInfo && { 
                publicKey: listingInfo.publicKey,
                account: listingInfo.account 
              })
            };
          } catch (error) {
            console.error('Error processing Fan NFT:', nft.mint.toString(), error);
            // Return basic NFT info even if metadata fails
            return {
              mint: nft.mint,
              tokenAccount: nft.tokenAccount,
              metadata: { name: 'Unknown Fan NFT', image: null, description: 'Failed to load metadata' }
            };
          }
        })
      );
      
      // Filter out failed promises and extract successful results
      const validNFTs = nftsWithMetadata
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(nft => nft && nft.mint);
        
      const failedCount = nftsWithMetadata.filter(result => result.status === 'rejected').length;
      
      if (failedCount > 0) {
        console.warn(`Failed to process ${failedCount} Fan NFTs`);
      }
      
      console.log(`Processed ${validNFTs.length} valid Fan NFTs out of ${ownedNFTs.length} total`);
      setNFTs(validNFTs);
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

  const handleListNFT = async (nft, price) => {
    if (!program || !walletPublicKey) return;
    try {
      setListing(nft.mint?.toString() || 'listing');
      
      const mintAddress = nft.mint;
      const mintPublicKey = new PublicKey(mintAddress);
      
      if (!mintAddress) {
        alert('Cannot find mint address for this Fan NFT');
        return;
      }
      
      const priceInLamports = new anchor.BN(price * 1_000_000_000);
      
      const [listingAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mintAddress.toBuffer()],
        program.programId
      );
      
      // Step 1: Check if the listing account already exists
      const listingAccountInfo = await program.provider.connection.getAccountInfo(listingAccount);
      
      if (listingAccountInfo) {
        // If it exists, the NFT is already listed. Throw an error.
        throw new Error('This NFT is already listed for sale.');
      }
      
      const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), mintAddress.toBuffer()],
        program.programId
      );
      
      const sellerTokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        walletPublicKey
      );
      
      const tx = await program.methods
        .listNft(priceInLamports)
        .accounts({
          listing: listingAccount,
          escrowTokenAccount: escrowTokenAccount,
          seller: walletPublicKey,
          sellerTokenAccount: sellerTokenAccount,
          mint: mintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .rpc();
      
      console.log('List transaction successful:', tx);
      await fetchNFTs();
      alert('Fan NFT listed successfully!');
      setShowListModal(false);
      setSelectedNFT(null);

    } catch (err) {
      console.error("Error listing Fan NFT:", err);
      alert(`Failed to list Fan NFT: ${err.message}`);
    } finally {
      setListing(null);
    }
};

  const handleUnlistNFT = async (listing) => {
    if (!program || !walletPublicKey) return;
    try {
      setUnlisting(listing.publicKey?.toString() || 'unlisting');
      
      const mintAddress = listing.account?.mint;
      
      if (!mintAddress) {
        alert('Cannot find mint address for this Fan NFT');
        return;
      }
      
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
      
      await fetchNFTs();
      alert('Fan NFT unlisted successfully!');

    } catch (err) {
      console.error("Error unlisting Fan NFT:", err);
      alert(`Failed to unlist Fan NFT: ${err.message}`);
    } finally {
      setUnlisting(null);
    }
  };

  const handleEditPrice = async (nft, newPrice) => {
    // Note: This would require implementing an updatePrice method in your Solana program
    // For now, we'll show a placeholder message
    alert('Price editing functionality would be implemented with a Solana program update method. For now, you can unlist and relist at a new price.');
  };

  const openListModal = (nft) => {
    setSelectedNFT(nft);
    setShowListModal(true);
  };

  const filteredNFTs = nfts.filter(nft => {
    const isOwned = true;
    
    if (filter === 'owned') return isOwned;
    return true;
  });

  const ownedCount = nfts.filter(nft => !nft.account || !nft.publicKey).length;
  const listedCount = nfts.filter(nft => nft.account && nft.publicKey && !nft.account.closed).length;
  const soldCount = nfts.filter(nft => nft.account && nft.account.closed).length;

  const renderContent = () => {
    if (programError) {
      return <p style={{ color: 'red' }}>Program error: {programError}</p>;
    }
    if (!program) {
      return <p>Loading SolanaOnlyFans program...</p>;
    }
    if (!connected) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪭</div>
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view your fan collection.</p>
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
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                Fetching your Fan NFTs...
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                This may take a moment depending on network congestion.
              </p>
            </div>
          </div>
        </div>
      );
    }
    if (fetchError) {
      return (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <p style={{ color: 'red' }}>Error fetching NFTs: {fetchError}</p>
          <button className="button" onClick={fetchNFTs}>
            Try Again
          </button>
        </div>
      );
    }
    if (filteredNFTs.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {filter === 'all' && '👀'}
            {filter === 'owned' && '📦'}
            {filter === 'listed' && '💰'}
            {filter === 'sold' && '✅'}
          </div>
          <h3 style={{ margin: 0 }}>
            No Fan NFTs {
              filter === 'all' ? 'found' :
              filter === 'owned' ? 'in your wallet' :
              filter === 'listed' ? 'listed for sale' :
              'sold'
            }.
          </h3>
          {filter === 'all' && (
            <p style={{ color: '#6b7280' }}>
              Looks like your collection is empty.
            </p>
          )}
        </div>
      );
    }
    return (
      <div style={{ 
        display: view === 'grid' ? 'grid' : 'block',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {filteredNFTs.map(nft => (
          <ContentCard
            key={nft.mint.toString()}
            nft={nft}
            onList={() => openListModal(nft)}
            onUnlist={handleUnlistNFT}
            onEditPrice={handleEditPrice}
            isListing={listing === nft.mint.toString()}
            isUnlisting={unlisting === (nft.publicKey?.toString() || '')}
            isUpdatingPrice={updatingPrice === nft.mint.toString()}
            view={view}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ 
          background: "linear-gradient(45deg, #9945FF, #14F195)", 
          WebkitBackgroundClip: "text", 
          WebkitTextFillColor: "transparent",
          margin: 0,
          fontSize: '32px'
        }}>
          My Fan NFTs
        </h1>
        <WalletMultiButton />
      </header>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button
          onClick={() => setFilter('all')}
          className="button"
          style={{ backgroundColor: filter === 'all' ? '#9945FF' : '#4b5563' }}
        >
          All ({nfts.length})
        </button>
        <button
          onClick={() => setFilter('owned')}
          className="button"
          style={{ backgroundColor: filter === 'owned' ? '#9945FF' : '#4b5563' }}
        >
          Owned ({ownedCount})
        </button>
        <button
          onClick={() => setFilter('listed')}
          className="button"
          style={{ backgroundColor: filter === 'listed' ? '#9945FF' : '#4b5563' }}
        >
          Listed ({listedCount})
        </button>
        <button
          onClick={() => setFilter('sold')}
          className="button"
          style={{ backgroundColor: filter === 'sold' ? '#9945FF' : '#4b5563' }}
        >
          Sold ({soldCount})
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => setView('grid')}
            className="icon-button"
            disabled={view === 'grid'}
          >
            <Grid color={view === 'grid' ? '#9945FF' : '#6b7280'} size={20} />
          </button>
          <button
            onClick={() => setView('list')}
            className="icon-button"
            disabled={view === 'list'}
          >
            <List color={view === 'list' ? '#9945FF' : '#6b7280'} size={20} />
          </button>
        </div>
      </div>
      
      {renderContent()}

      <ListForSaleModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        onConfirm={handleListNFT}
        nft={selectedNFT}
        isListing={listing === (selectedNFT?.mint?.toString() || 'listing')}
      />

      <style jsx>{`
        .card {
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }

        .button {
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
          border: none;
        }

        .button:disabled {
          background-color: #6b7280 !important;
          cursor: not-allowed;
        }

        .input {
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          width: 100%;
          transition: border-color 0.2s;
        }

        .input:focus {
          outline: none;
          border-color: #9945FF;
        }

        .icon-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background-color 0.2s;
        }

        .icon-button:hover {
          background-color: #f3f4f6;
        }

        .icon-button:disabled {
          cursor: default;
          background-color: transparent;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}