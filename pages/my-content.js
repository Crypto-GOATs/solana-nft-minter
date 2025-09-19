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
    console.error('Error fetching owned NFTs:', error);
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
      name: asset.metadata.name || 'Unknown NFT',
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
            name: asset.metadata.name || jsonMetadata.name || 'Unknown NFT',
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
    console.error('Error fetching NFT metadata for mint:', mintAddress, error);
    return {
      name: 'Unknown NFT',
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
  
  // Safety check - if no mint address, don't render this NFT
  if (!nft || !nft.mint) {
    console.warn('Invalid NFT object:', nft);
    return null;
  }
  
  // Check if NFT has listing info (account property exists when listed/sold)
  const hasListing = nft.account && nft.publicKey;
  const priceInSOL = hasListing && nft.account.price ? 
    (nft.account.price.toNumber() / 1_000_000_000).toFixed(3) : 'N/A';
  const isSold = hasListing ? (nft.account.closed || false) : false;
  const isListed = hasListing && !isSold;
  const isOwned = !hasListing; // Not listed and not sold = just owned
  
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
                fontSize: '10px',
                color: '#6b7280'
              }}>
                No Image
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nft.metadata?.name || 'Unknown NFT'}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>
                {isListed ? `${priceInSOL} SOL` : isSold ? 'Sold' : 'Owned'}
              </span>
              <span className="tag" style={{ 
                backgroundColor: isSold ? '#10b981' : isListed ? '#f59e0b' : '#6b7280',
                color: 'white',
                fontSize: '12px'
              }}>
                {isSold ? 'Sold' : isListed ? 'Listed' : 'Owned'}
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
                  backgroundColor: isListing ? '#6b7280' : '#10b981',
                  fontSize: '14px',
                  padding: '6px 12px'
                }}
              >
                {isListing ? 'Listing...' : 'List'}
              </button>
            )}
            
            {isListed && (
              <>
                <button
                  className="button"
                  onClick={() => setShowPriceEdit(!showPriceEdit)}
                  style={{ 
                    backgroundColor: '#3b82f6',
                    fontSize: '14px',
                    padding: '6px 12px'
                  }}
                >
                  Edit Price
                </button>
                <button
                  className="button"
                  onClick={() => onUnlist(nft)}
                  disabled={isUnlisting}
                  style={{ 
                    backgroundColor: isUnlisting ? '#6b7280' : '#ef4444',
                    fontSize: '14px',
                    padding: '6px 12px'
                  }}
                >
                  {isUnlisting ? 'Unlisting...' : 'Unlist'}
                </button>
              </>
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
                backgroundColor: '#10b981',
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
              <strong>Status:</strong>{' '}
              <span className="tag" style={{ 
                backgroundColor: isSold ? '#10b981' : isListed ? '#f59e0b' : '#6b7280',
                color: 'white'
              }}>
                {isSold ? 'Sold' : isListed ? 'Listed' : 'Owned'}
              </span>
            </div>
            
            {isListed && (
              <div style={{ marginBottom: '4px' }}>
                <strong>Price:</strong> {priceInSOL} SOL
              </div>
            )}
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
                  style={{ backgroundColor: '#10b981' }}
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
                disabled={isListing}
                style={{ backgroundColor: isListing ? '#6b7280' : '#10b981' }}
              >
                {isListing ? 'Listing...' : 'List for Sale'}
              </button>
            )}
            
            {isListed && (
              <>
                <button
                  className="button"
                  onClick={() => setShowPriceEdit(!showPriceEdit)}
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  Edit Price
                </button>
                <button
                  className="button"
                  onClick={() => onUnlist(nft)}
                  disabled={isUnlisting}
                  style={{ backgroundColor: isUnlisting ? '#6b7280' : '#ef4444' }}
                >
                  {isUnlisting ? 'Unlisting...' : 'Unlist NFT'}
                </button>
              </>
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
        <h2 style={{ marginTop: 0 }}>List NFT for Sale</h2>
        
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          {nft.metadata?.image && (
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
          )}
          <h3 style={{ margin: '8px 0' }}>{nft.metadata?.name || 'Unknown NFT'}</h3>
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
            style={{ backgroundColor: '#10b981' }}
          >
            {isListing ? 'Listing...' : 'List NFT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MyContent() {
  const { publicKey: walletPublicKey, connected } = useWallet();
  const wallet = useWallet();
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
      console.log(`Found ${ownedNFTs.length} owned NFTs`);
      
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
            console.error('Error processing NFT:', nft.mint.toString(), error);
            // Return basic NFT info even if metadata fails
            return {
              mint: nft.mint,
              tokenAccount: nft.tokenAccount,
              metadata: { name: 'Unknown NFT', image: null, description: 'Failed to load metadata' }
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
        console.warn(`Failed to process ${failedCount} NFTs`);
      }
      
      console.log(`Processed ${validNFTs.length} valid NFTs out of ${ownedNFTs.length} total`);
      setNFTs(validNFTs);
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

  const handleListNFT = async (nft, price) => {
    if (!program || !walletPublicKey) return;
    try {
      setListing(nft.mint?.toString() || 'listing');
      
      const mintAddress = nft.mint;
      
      if (!mintAddress) {
        alert('Cannot find mint address for this NFT');
        return;
      }
      
      const priceInLamports = new anchor.BN(price * 1_000_000_000);
      
      const [listingAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mintAddress.toBuffer()],
        program.programId
      );
      
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
          mint: mintAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .rpc();
      
      console.log('List transaction successful:', tx);
      await fetchNFTs();
      alert('NFT listed successfully!');
      setShowListModal(false);
      setSelectedNFT(null);

    } catch (err) {
      console.error("Error listing NFT:", err);
      alert(`Failed to list NFT: ${err.message}`);
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
        alert('Cannot find mint address for this NFT');
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
      alert('NFT unlisted successfully!');

    } catch (err) {
      console.error("Error unlisting NFT:", err);
      alert(`Failed to unlist NFT: ${err.message}`);
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
    const hasListing = nft.account && nft.publicKey;
    const isListed = hasListing && !nft.account.closed;
    const isSold = hasListing && nft.account.closed;
    const isOwned = !hasListing;
    
    if (filter === 'listed') return isListed;
    if (filter === 'sold') return isSold;
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
      return <p>Loading program...</p>;
    }
    if (!connected) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Package size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view your content.</p>
        </div>
      );
    }
    if (loading) {
      return <p>Loading your content...</p>;
    }
    if (fetchError) {
      return <p style={{ color: 'red' }}>Error: {fetchError}</p>;
    }
    if (filteredNFTs.length === 0 && nfts.length > 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No Content Matches Filter</h3>
          <p>Try selecting a different filter to see your content.</p>
        </div>
      );
    }
    if (nfts.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Package size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
          <h3>No Content Yet</h3>
          <p>You haven't created any NFTs yet. Start by minting your first piece of content!</p>
          <button 
            className="button"
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '16px', backgroundColor: '#10b981' }}
          >
            Create Your First NFT
          </button>
        </div>
      );
    }
    return (
      <div>
        {filteredNFTs.map((nft, index) => (
          <ContentCard 
            key={nft.mint?.toString() || index}
            nft={nft} 
            onList={openListModal}
            onUnlist={handleUnlistNFT}
            onEditPrice={handleEditPrice}
            isListing={listing === nft.mint?.toString()}
            isUnlisting={unlisting === nft.publicKey?.toString()}
            isUpdatingPrice={updatingPrice === nft.publicKey?.toString()}
            view={view}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1>My Content</h1>
        <WalletMultiButton />
      </div>
      
      <div>
        {/* Statistics */}
        {nfts.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <Package size={20} style={{ color: '#6b7280', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{nfts.length}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <Eye size={20} style={{ color: '#6b7280', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{ownedCount}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Owned</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <Tag size={20} style={{ color: '#f59e0b', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{listedCount}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Listed</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <TrendingUp size={20} style={{ color: '#10b981', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{soldCount}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Sold</div>
            </div>
          </div>
        )}
        
        {/* Controls */}
        {nfts.length > 0 && (
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
                All ({nfts.length})
              </button>
              <button
                className="button"
                onClick={() => setFilter('owned')}
                style={{ 
                  backgroundColor: filter === 'owned' ? '#3b82f6' : '#6b7280',
                  fontSize: '14px',
                  padding: '6px 12px'
                }}
              >
                Owned ({ownedCount})
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
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button"
                onClick={() => setView('grid')}
                style={{ 
                  backgroundColor: view === 'grid' ? '#3b82f6' : '#6b7280',
                  fontSize: '14px',
                  padding: '6px 12px'
                }}
              >
                <Grid size={16} style={{ marginRight: '4px' }} />
                Grid
              </button>
              <button
                className="button"
                onClick={() => setView('list')}
                style={{ 
                  backgroundColor: view === 'list' ? '#3b82f6' : '#6b7280',
                  fontSize: '14px',
                  padding: '6px 12px'
                }}
              >
                <List size={16} style={{ marginRight: '4px' }} />
                List
              </button>
            </div>
          </div>
        )}
        
        {renderContent()}
      </div>
      
      <ListForSaleModal
        isOpen={showListModal}
        onClose={() => {
          setShowListModal(false);
          setSelectedNFT(null);
        }}
        onConfirm={handleListNFT}
        nft={selectedNFT}
        isListing={listing === selectedNFT?.publicKey?.toString()}
      />
      
      <p className="footer">Manage your NFT content, list items for sale, and track your creative portfolio.</p>
    </div>
  );
}