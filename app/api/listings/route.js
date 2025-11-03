// app/api/listings/route.js
import { NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from '@metaplex-foundation/umi';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import idlJson from '../../../target/idl/solana_marketplace.json';

const PROGRAM_ID = new PublicKey('5Hixra6LUDzgLfE3C3S11H4h3f2Psnq6LkcxuEaKP8sb');

const fetchNFTMetadata = async (mintAddress, rpcUrl) => {
  try {
    const umi = createUmi(rpcUrl).use(mplTokenMetadata());
    const mint = publicKey(mintAddress);
    const asset = await fetchDigitalAsset(umi, mint);

    if (asset.metadata.uri) {
      let metadataUri = asset.metadata.uri;
      
      // Convert IPFS URI to HTTP gateway
      if (metadataUri.startsWith('ipfs://')) {
        const ipfsHash = metadataUri.replace('ipfs://', '');
        
        // Validate hash length
        if (ipfsHash.length < 40) {
          console.warn(`[${mintAddress}] Invalid IPFS hash: ${ipfsHash}`);
          return {
            name: asset.metadata.name || 'Unknown Fan NFT',
            image: null,
            description: 'Metadata unavailable',
            attributes: [],
          };
        }
        
        // Use your Pinata gateway
        metadataUri = `https://beige-magnetic-sheep-465.mypinata.cloud/ipfs/${ipfsHash}`;
      }

      try {
        // Fetch metadata JSON - matching browser behavior
        const response = await fetch(metadataUri, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });
        
        if (response.ok) {
          const metadata = await response.json();
          
          return {
            name: asset.metadata.name || metadata.name || 'Unknown Fan NFT',
            image: metadata.image || null,
            description: metadata.description || '',
            attributes: metadata.attributes || [],
          };
        }
        
        // If fetch failed, log but don't crash
        console.warn(`[${mintAddress}] HTTP ${response.status}: ${metadataUri}`);
        
      } catch (fetchError) {
        console.warn(`[${mintAddress}] Fetch error:`, fetchError.message);
      }
    }

    // Fallback to on-chain metadata only
    return {
      name: asset.metadata.name || 'Unknown Fan NFT',
      image: null,
      description: '',
      attributes: [],
    };
    
  } catch (error) {
    console.error(`[${mintAddress}] Error:`, error.message);
    return {
      name: 'Unknown Fan NFT',
      image: null,
      description: '',
      attributes: [],
    };
  }
};

export async function GET() {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    };

    const provider = new AnchorProvider(connection, dummyWallet, { commitment: 'confirmed' });
    const program = new Program(idlJson, provider);

    console.log('Fetching all listings from program...');

    // Fetch all listing accounts
    const allListings = await program.account.listing.all();

    console.log(`Found ${allListings.length} total listings`);

    // Filter active (non-closed) listings
    const activeListings = allListings.filter((l) => !l.account.closed);

    console.log(`Found ${activeListings.length} active listings`);

    // Fetch metadata for each listing
    const listingsWithMetadata = await Promise.all(
      activeListings.map(async (listing) => {
        const metadata = await fetchNFTMetadata(
          listing.account.mint.toString(),
          rpcUrl
        );

        return {
          publicKey: listing.publicKey.toString(),
          nftMint: listing.account.mint.toString(),
          mint: listing.account.mint.toString(),
          seller: listing.account.seller.toString(),
          price: listing.account.price.toNumber() / 1_000_000_000, // Convert lamports to SOL
          closed: listing.account.closed,
          isActive: !listing.account.closed,
          isSold: listing.account.closed,
          listingAccount: listing.publicKey.toString(),
          metadata,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: listingsWithMetadata.length,
      listings: listingsWithMetadata,
    });

  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch listings',
        message: error.message,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}