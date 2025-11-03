import { NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import idlJson from '../../../../target/idl/solana_marketplace.json';
import bs58 from 'bs58';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PROGRAM_ID = new PublicKey('5Hixra6LUDzgLfE3C3S11H4h3f2Psnq6LkcxuEaKP8sb');

// Create a proper wallet implementation for the agent
class NodeWallet {
  constructor(payer) {
    this.payer = payer;
  }

  async signTransaction(tx) {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nftMint, price } = body;

    if (!nftMint || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: nftMint, price' },
        { status: 400 }
      );
    }

    if (!process.env.AGENT_WALLET_PRIVATE_KEY) {
      throw new Error('AGENT_WALLET_PRIVATE_KEY not configured');
    }

    const agentKeypair = Keypair.fromSecretKey(
      Buffer.from(process.env.AGENT_WALLET_PRIVATE_KEY, 'base64')
    );

    // Initialize connection and provider with proper wallet
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const wallet = new NodeWallet(agentKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

    // Initialize program
    const program = new Program(idlJson, provider);

    console.log('Listing NFT:', nftMint, 'for', price, 'SOL');

    const mintAddress = new PublicKey(nftMint);
    const priceInLamports = new BN(price * 1_000_000_000);

    // Derive PDAs
    const [listingAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mintAddress.toBuffer()],
      PROGRAM_ID
    );

    // Check if already listed
    const listingAccountInfo = await connection.getAccountInfo(listingAccount);
    if (listingAccountInfo) {
      return NextResponse.json(
        { error: 'This NFT is already listed for sale' },
        { status: 400 }
      );
    }

    const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), mintAddress.toBuffer()],
      PROGRAM_ID
    );

    const sellerTokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      agentKeypair.publicKey
    );

    console.log('Listing account:', listingAccount.toString());
    console.log('Escrow account:', escrowTokenAccount.toString());
    console.log('Seller token account:', sellerTokenAccount.toString());

    // Execute listing transaction
    const tx = await program.methods
      .listNft(priceInLamports)
      .accounts({
        listing: listingAccount,
        escrowTokenAccount: escrowTokenAccount,
        seller: agentKeypair.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        mint: mintAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,  // ← FIXED: Use the correct rent sysvar
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ List transaction successful:', tx);

    return NextResponse.json({
      success: true,
      message: 'NFT listed successfully',
      transaction: tx,
      listing: listingAccount.toString(),
      nftMint: nftMint,
      price: price,
    });

  } catch (error) {
    console.error('List API error:', error);
    console.error('Full error details:', error.logs || error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.logs },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve listing info
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agent/list',
    description: 'List NFT for sale on marketplace',
    method: 'POST',
    requiredFields: ['nftMint', 'price'],
    network: process.env.SOLANA_NETWORK || 'solana-devnet',
    programId: PROGRAM_ID.toString(),
    example: {
      nftMint: 'Gz7V...',
      price: 2.5
    }
  });
}