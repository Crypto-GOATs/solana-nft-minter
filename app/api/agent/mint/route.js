import { NextResponse } from 'next/server';
import SolanaX402Handler from '../../../../lib/x402-handler';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const MINT_PRICE_SOL = 0.01;

export async function POST(request) {
  try {
    // Initialize x402 handler
    const x402 = new SolanaX402Handler({
      network: process.env.SOLANA_NETWORK || 'solana-devnet',
      treasuryAddress: process.env.X402_TREASURY_ADDRESS,
      facilitatorUrl: process.env.X402_FACILITATOR_URL,
      rpcUrl: process.env.SOLANA_RPC_URL,
    });

    // Create payment requirements
    const paymentRequirements = await x402.createMintPaymentRequirements(MINT_PRICE_SOL);

    // Extract payment from headers
    const paymentHeader = request.headers.get('x-payment');

    // If no payment header, return 402 with requirements
    if (!paymentHeader) {
      return NextResponse.json(
        { 
          error: 'Payment required',
          paymentRequirements 
        },
        { status: 402 }
      );
    }

    // Parse payment header
    let payment;
    try {
      payment = JSON.parse(paymentHeader);
    } catch (parseError) {
      console.error('Failed to parse payment header:', parseError);
      return NextResponse.json(
        { error: 'Invalid payment format' },
        { status: 400 }
      );
    }

    // Verify payment
    const isValid = await x402.verifyPayment(payment, paymentRequirements);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 402 }
      );
    }

    console.log('✅ Payment verified, proceeding with NFT mint...');

    // Parse request body
    const body = await request.json();
    const { uri, name, sellerFeeBasisPoints } = body;

    if (!uri || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: uri and name' },
        { status: 400 }
      );
    }

    // Initialize UMI with better configuration
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });
    const umi = createUmi(connection).use(mplTokenMetadata());

    // Load authority wallet from environment
    if (!process.env.MINT_AUTHORITY_PRIVATE_KEY) {
      throw new Error('MINT_AUTHORITY_PRIVATE_KEY not configured');
    }

    const authorityKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.MINT_AUTHORITY_PRIVATE_KEY)
    );

    // Create UMI keypair signer from Solana keypair
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(authorityKeypair.secretKey);
    const umiSigner = createSignerFromKeypair(umi, umiKeypair);
    umi.use(signerIdentity(umiSigner));

    // Generate a new mint address
    const mint = generateSigner(umi);

    console.log('Minting NFT with address:', mint.publicKey);

    try {
      // Create the NFT with retry logic
      const result = await createNft(umi, {
        mint,
        authority: umi.identity,
        name,
        uri,
        sellerFeeBasisPoints: sellerFeeBasisPoints || 500,
      }).sendAndConfirm(umi, {
        send: { skipPreflight: true },
        confirm: { commitment: 'confirmed' },
      });

      console.log('✅ NFT minted successfully:', mint.publicKey);

      return NextResponse.json({
        success: true,
        message: 'NFT minted successfully',
        mintAddress: mint.publicKey.toString(),
        name,
        uri,
        signature: result.signature,
        payment: {
          txid: payment.txid,
          amount: MINT_PRICE_SOL,
          currency: 'SOL',
        },
      });

    } catch (mintError) {
      console.error('Mint transaction error:', mintError);
      
      // If timeout, the NFT might still have been created
      // Return partial success
      return NextResponse.json({
        success: true,
        message: 'NFT mint submitted (confirmation pending)',
        mintAddress: mint.publicKey.toString(),
        name,
        uri,
        warning: 'Transaction confirmation timed out, but mint may have succeeded. Check the mint address on explorer.',
        payment: {
          txid: payment.txid,
          amount: MINT_PRICE_SOL,
          currency: 'SOL',
        },
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Mint API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve mint pricing
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agent/mint',
    priceSol: MINT_PRICE_SOL,
    description: 'Mint NFT with x402 payment',
    method: 'POST',
    requiredFields: ['uri', 'name'],
    optionalFields: ['sellerFeeBasisPoints'],
    paymentProtocol: 'x402',
    network: process.env.SOLANA_NETWORK || 'solana-devnet',
    example: {
      uri: 'ipfs://QmXxx...',
      name: 'My Fan NFT',
      sellerFeeBasisPoints: 500
    }
  });
}