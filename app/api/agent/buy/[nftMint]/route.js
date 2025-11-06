// At the top, update imports:
import { NextResponse } from 'next/server';
import SolanaX402Handler from '../../../../../lib/x402-handler';
import { 
  Connection, 
  PublicKey, 
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import idlJson from '../../../../../target/idl/solana_marketplace.json' assert { type: 'json' };

// Your Anchor program ID (update this to match your deployed program)
const PROGRAM_ID = new PublicKey('5Hixra6LUDzgLfE3C3S11H4h3f2Psnq6LkcxuEaKP8sb');

// Create a proper wallet implementation for Node.js
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

export async function POST(request, { params }) {
  const { nftMint } = await params;

  const x402 = new SolanaX402Handler({
    network: process.env.SOLANA_NETWORK || 'solana-devnet',
    treasuryAddress: process.env.X402_TREASURY_ADDRESS,
    facilitatorUrl: process.env.X402_FACILITATOR_URL,
    rpcUrl: process.env.SOLANA_RPC_URL,
  });

  try {
    // Get body first to extract buyer wallet
    const body = await request.json();
    const { buyerWallet } = body;

    if (!buyerWallet) {
      return NextResponse.json(
        { error: 'Missing required field: buyerWallet' },
        { status: 400 }
      );
    }

    // Get listing details from your Anchor program
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );

    // Initialize Anchor provider with agent wallet
    const agentKeyBytes = Buffer.from(process.env.AGENT_WALLET_PRIVATE_KEY, 'base64');
    const agentKeypair = Keypair.fromSecretKey(agentKeyBytes);
    
    // Use NodeWallet instead of anchor.Wallet
    const wallet = new NodeWallet(agentKeypair);
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    // Load your program (you'll need to provide the IDL)
    // For now, we'll fetch the listing PDA directly
    const mintPublicKey = new PublicKey(nftMint);
    const [listingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mintPublicKey.toBuffer()],
      PROGRAM_ID
    );

    // Fetch listing account
    const listingAccountInfo = await connection.getAccountInfo(listingPDA);
    
    // After checking listingAccountInfo exists:
if (!listingAccountInfo) {
  return NextResponse.json(
    { error: 'NFT not found or not listed for sale' },
    { status: 404 }
  );
}
    // Fetch and decode the listing properly using the program
    const program = new anchor.Program(
  idlJson, 
  provider
);

    // Fetch and decode the listing properly using the program
    const listing = await program.account.listing.fetch(listingPDA);
    const priceInSol = Number(listing.price.toString()) / 1_000_000_000;
    const sellerPublicKey = listing.seller;


    // Extract payment from headers
    const headers = Object.fromEntries(request.headers.entries());
let paymentHeader = x402.extractPayment(headers);

// Parse the payment if it's a string
if (paymentHeader && typeof paymentHeader === 'string') {
  try {
    paymentHeader = JSON.parse(paymentHeader);
    console.log('[x402-buy] Parsed payment header:', paymentHeader);
  } catch (e) {
    console.error('[x402-buy] Failed to parse payment header:', e);
    return NextResponse.json(
      { error: 'Invalid payment format' },
      { status: 400 }
    );
  }
}

    // Create payment requirements (price in USDC, assuming 1 USDC = 1 SOL for simplicity)
    // Adjust conversion rate as needed
    const priceInUsdc = priceInSol; // Simplified - you might want to fetch actual rates
    const paymentRequirements = await x402.createBuyPaymentRequirements(
      nftMint,
      priceInUsdc
    );

    // If no payment, return 402
    if (!paymentHeader) {
      const response = x402.create402Response(paymentRequirements);
      return NextResponse.json(
        {
          ...response.body,
          listing: {
            nftMint,
            price: priceInSol,
            priceUsdc: priceInUsdc,
          },
        },
        { 
          status: response.status,
          headers: {
            'X-Payment-Required': 'true',
            'X-NFT-Price': priceInUsdc.toString(),
          }
        }
      );
    }

    // Verify payment
    const verified = await x402.verifyPayment(paymentHeader, paymentRequirements);
    
    if (!verified) {
      return NextResponse.json(
        { 
          error: 'Payment verification failed',
          message: 'Payment does not match listing price'
        },
        { status: 402 }
      );
    }

    console.log('[x402-buy] Payment verified, executing purchase...');
  
    const buyerPublicKey = new PublicKey(buyerWallet);
    const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), mintPublicKey.toBuffer()],
      PROGRAM_ID
    );

    const buyerTokenAccount = getAssociatedTokenAddressSync(
      mintPublicKey,
      buyerPublicKey
    );

    // Check if buyer token account exists
    const buyerTokenAccountInfo = await connection.getAccountInfo(buyerTokenAccount);
    let preInstructions = [];
    
    if (!buyerTokenAccountInfo) {
      console.log('[x402-buy] Creating buyer token account...');
      preInstructions.push(
        createAssociatedTokenAccountInstruction(
          agentKeypair.publicKey, // Payer (agent)
          buyerTokenAccount,
          buyerPublicKey,
          mintPublicKey
        )
      );
    }

    const feeRecipient = new PublicKey(process.env.FEE_RECIPIENT || "5GrJ4aUiQRc1frnxyv89ws27wPu2fxsgJvxHgLmEjBBq");

    // Execute buy transaction
    // Execute buy transaction
let txBuilder = program.methods
  .buyNft()
  .accounts({
    listing: listingPDA,
    buyer: buyerPublicKey,
    seller: sellerPublicKey,
    escrowTokenAccount: escrowTokenAccount,
    buyerTokenAccount: buyerTokenAccount,
    mint: mintPublicKey,
    feeRecipient: feeRecipient,
    tokenProgram: TOKEN_PROGRAM_ID,  // Now imported correctly
    systemProgram: SystemProgram.programId,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,  // Now imported correctly
    rent: SYSVAR_RENT_PUBKEY,
  });

    if (preInstructions.length > 0) {
      txBuilder = txBuilder.preInstructions(preInstructions);
    }

    const signature = await txBuilder.rpc();

    console.log(`[x402-buy] NFT ${nftMint} purchased successfully by ${buyerWallet}`);

    return NextResponse.json({
      success: true,
      nftMint,
      buyer: buyerWallet,
      seller: sellerPublicKey.toString(),
      price: priceInSol,
      priceUsdc: priceInUsdc,
      txSignature: signature,
      paymentVerified: true,
      timestamp: new Date().toISOString(),
      message: 'NFT purchased successfully with x402 payment'
    });

  } catch (error) {
    console.error('[x402-buy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Purchase failed',
        message: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve listing details
export async function GET(request, { params }) {
  const { nftMint } = await params; // Add await here

  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );

    // Create provider for read-only access
    const dummyKeypair = Keypair.generate();
    const wallet = new NodeWallet(dummyKeypair);
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    const program = new anchor.Program(
  idlJson, 
  PROGRAM_ID, 
  provider
);

    const mintPublicKey = new PublicKey(nftMint);
    const [listingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mintPublicKey.toBuffer()],
      PROGRAM_ID
    );

    // Use program to decode
    const listing = await program.account.listing.fetch(listingPDA);
    const priceInSol = Number(listing.price.toString()) / 1_000_000_000;

    return NextResponse.json({
      nftMint,
      price: priceInSol,
      priceUsdc: priceInSol,
      listingPda: listingPDA.toString(),
      seller: listing.seller.toString(),
      purchaseEndpoint: `/api/agent/buy/${nftMint}`,
      paymentProtocol: 'x402',
      network: process.env.SOLANA_NETWORK || 'solana-devnet',
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}