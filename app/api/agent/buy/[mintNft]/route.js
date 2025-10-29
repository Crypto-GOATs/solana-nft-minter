import { NextResponse } from 'next/server';
import SolanaX402Handler from '../../../../../lib/x402-handler';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { base64 } from '@metaplex-foundation/umi/serializers';

// Your Anchor program ID (update this to match your deployed program)
const PROGRAM_ID = new PublicKey('5Hixra6LUDzgLfE3C3S11H4h3f2Psnq6LkcxuEaKP8sb');

export async function POST(request, { params }) {
  const { nftMint } = params;

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
    
    const wallet = new anchor.Wallet(agentKeypair);
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
    
    if (!listingAccountInfo) {
      return NextResponse.json(
        { error: 'NFT not found or not listed for sale' },
        { status: 404 }
      );
    }

    // Decode listing account (simplified - adjust based on your actual account structure)
    // You'll need to properly deserialize based on your Anchor IDL
    // For now, assuming price is stored as u64 (8 bytes) at offset 8
    const data = listingAccountInfo.data;
    const priceBuffer = data.slice(8, 16); // Adjust offsets based on your struct
    const price = new anchor.BN(priceBuffer, 'le');
    const priceInSol = price.toNumber() / 1_000_000_000;

    // Extract payment from headers
    const headers = Object.fromEntries(request.headers.entries());
    const paymentHeader = x402.extractPayment(headers);

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

    // Execute buy transaction using your Anchor program
    // Load the program with IDL (you'll need to provide this)
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
    const program = new anchor.Program(idl, PROGRAM_ID, provider);

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

    // Get seller from listing account (you'll need to properly decode this)
    const sellerPublicKey = new PublicKey(data.slice(40, 72)); // Adjust offset based on your struct

    const feeRecipient = new PublicKey(process.env.FEE_RECIPIENT || "5GrJ4aUiQRc1frnxyv89ws27wPu2fxsgJvxHgLmEjBBq");

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
        rentRecipient: sellerPublicKey,
        tokenProgram: anchor.web3.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.web3.ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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
  const { nftMint } = params;

  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );

    const mintPublicKey = new PublicKey(nftMint);
    const [listingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mintPublicKey.toBuffer()],
      PROGRAM_ID
    );

    const listingAccountInfo = await connection.getAccountInfo(listingPDA);
    
    if (!listingAccountInfo) {
      return NextResponse.json(
        { error: 'NFT not found or not listed' },
        { status: 404 }
      );
    }

    // Decode listing (adjust based on your actual structure)
    const data = listingAccountInfo.data;
    const priceBuffer = data.slice(8, 16);
    const price = new anchor.BN(priceBuffer, 'le');
    const priceInSol = price.toNumber() / 1_000_000_000;

    return NextResponse.json({
      nftMint,
      price: priceInSol,
      priceUsdc: priceInSol, // Simplified conversion
      listingPda: listingPDA.toString(),
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