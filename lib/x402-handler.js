/**
 * Core x402 utilities for Solana NFT marketplace
 * Handles payment protocol integration with Metaplex and SPL tokens
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { X402PaymentHandler } from '@payai/x402-solana/server';
import { createX402Client } from '@payai/x402-solana/client';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

export class SolanaX402Handler {
  constructor(config) {
  this.network = config.network || 'solana-devnet';
  this.connection = new Connection(
    config.rpcUrl || 'https://api.devnet.solana.com',
    'confirmed'
  );
  
  this.x402Handler = new X402PaymentHandler({
    network: this.network,
    treasuryAddress: config.treasuryAddress,
    facilitatorUrl: config.facilitatorUrl || 'https://facilitator.payai.network',
  });

  // Load agent wallet
  if (config.privateKey) {
    const decoded = Buffer.from(config.privateKey, 'base64');
    this.agentWallet = Keypair.fromSecretKey(decoded);
  }
}

/**
 * Create payment transaction for agent (server-side)
 */
async createAgentPayment(paymentReqs) {
  if (!this.agentWallet) {
    throw new Error('Agent wallet not initialized');
  }

  // Handle both formats: {accepts: [...]} OR direct accept option
  let acceptOption;
  
  if (paymentReqs.accepts && Array.isArray(paymentReqs.accepts)) {
    // Format 1: {accepts: [{scheme: 'exact', ...}]}
    acceptOption = paymentReqs.accepts[0];
  } else if (paymentReqs.scheme) {
    // Format 2: Direct accept option {scheme: 'exact', ...}
    acceptOption = paymentReqs;
  } else {
    throw new Error('Invalid payment requirements format: ' + JSON.stringify(paymentReqs));
  }

  if (!acceptOption) {
    throw new Error('No payment options in requirements');
  }

  const priceAmount = BigInt(acceptOption.maxAmountRequired);
  const recipientAddress = new PublicKey(acceptOption.payTo);

  console.log(`Creating SOL payment: ${Number(priceAmount) / 1e9} SOL to ${recipientAddress.toString()}`);

  // Check agent's SOL balance
  const balance = await this.connection.getBalance(this.agentWallet.publicKey);
  console.log(`Agent SOL balance: ${balance / 1e9} SOL`);
  
  if (balance < priceAmount) {
    throw new Error(`Insufficient SOL balance. Need ${Number(priceAmount) / 1e9} SOL, have ${balance / 1e9} SOL`);
  }

  // Create SOL transfer transaction
  const { SystemProgram } = await import('@solana/web3.js');
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: this.agentWallet.publicKey,
      toPubkey: recipientAddress,
      lamports: priceAmount,
    })
  );

  // Set fee payer and recent blockhash
  transaction.feePayer = this.agentWallet.publicKey;
  
  const { blockhash } = await this.connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // Sign transaction
  transaction.sign(this.agentWallet);

  // Send transaction and get signature
  try {
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    // Wait for confirmation
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log(`✅ SOL payment transaction confirmed: ${signature}`);

    // Return payment proof in x402 format
    return {
      network: acceptOption.network,
      txid: signature,
      asset: 'SOL',
      amount: acceptOption.maxAmountRequired,
      recipient: acceptOption.payTo,
      sender: this.agentWallet.publicKey.toString(),
    };
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    throw error;
  }
}

  /**
 * Create x402 payment requirements for NFT minting (SOL)
 */
async createMintPaymentRequirements(priceSol) {
  const priceInLamports = (priceSol * 1_000_000_000).toString(); // Convert SOL to lamports
  
  return await this.x402Handler.createPaymentRequirements({
    price: {
      amount: priceInLamports,
      asset: {
        address: 'So11111111111111111111111111111111111111112' // SOL mint address
      }
    },
    network: this.network,
    config: {
      description: 'NFT Minting Fee',
      resource: `${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/mint`,
    }
  });
}

/**
 * Create x402 payment requirements for NFT purchase (SOL)
 */
async createBuyPaymentRequirements(nftMint, priceSol) {
  const priceInLamports = (priceSol * 1_000_000_000).toString();
  
  return await this.x402Handler.createPaymentRequirements({
    price: {
      amount: priceInLamports,
      asset: {
        address: 'So11111111111111111111111111111111111111112' // SOL mint address
      }
    },
    network: this.network,
    config: {
      description: `Purchase NFT ${nftMint}`,
      resource: `${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/buy/${nftMint}`,
    }
  });
}


 /**
 * Verify x402 payment from request headers
 */
async verifyPayment(payment, paymentRequirements) {
  // If payment is our custom SOL format, verify the transaction
  if (payment.txid && payment.network) {
    try {
      // Verify the transaction exists and was confirmed
      const tx = await this.connection.getTransaction(payment.txid, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        console.error('Transaction not found:', payment.txid);
        return false;
      }

      // Extract expected payment details - handle both formats
      let acceptOption;
      if (paymentRequirements.accepts && Array.isArray(paymentRequirements.accepts)) {
        acceptOption = paymentRequirements.accepts[0];
      } else if (paymentRequirements.scheme) {
        acceptOption = paymentRequirements;
      } else {
        console.error('Invalid payment requirements format');
        return false;
      }

      const expectedAmount = BigInt(acceptOption.maxAmountRequired);
      const expectedRecipient = acceptOption.payTo;

      // Verify the transaction transferred the correct amount to the correct recipient
      const recipientPubkey = new PublicKey(expectedRecipient);
      
      // Find recipient in account keys
      const recipientIndex = tx.transaction.message.accountKeys.findIndex(
        key => key.toBase58() === recipientPubkey.toBase58()
      );

      if (recipientIndex === -1) {
        console.error('Recipient not found in transaction');
        return false;
      }

      // Check post balances
      const preBalance = tx.meta.preBalances[recipientIndex];
      const postBalance = tx.meta.postBalances[recipientIndex];

      const actualAmount = BigInt(postBalance - preBalance);

      if (actualAmount < expectedAmount) {
        console.error(`Insufficient payment: expected ${expectedAmount}, got ${actualAmount}`);
        return false;
      }

      console.log('✅ Payment verified:', payment.txid);
      return true;

    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  // Otherwise, use the x402Handler's built-in verification
  return await this.x402Handler.verifyPayment(payment, paymentRequirements);
}

  /**
   * Extract payment from request headers
   */
  extractPayment(headers) {
    return this.x402Handler.extractPayment(headers);
  }

  /**
   * Create HTTP 402 response
   */
  create402Response(paymentRequirements) {
    return this.x402Handler.create402Response(paymentRequirements);
  }

  /**
   * Agent wallet info
   */
  getAgentWalletInfo() {
    if (!this.agentWallet) {
      throw new Error('Agent wallet not initialized');
    }
    
    return {
      publicKey: this.agentWallet.publicKey.toString(),
      network: this.network,
    };
  }

  /**
   * Get agent's USDC balance
   */
  async getAgentUsdcBalance() {
    if (!this.agentWallet) {
      throw new Error('Agent wallet not initialized');
    }

    const tokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      this.agentWallet.publicKey
    );

    try {
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmount || 0);
    } catch (error) {
      console.log('No USDC account found, balance is 0');
      return 0;
    }
  }

  /**
   * Check if agent can afford a payment
   */
  async canAffordPayment(amountUsdc) {
    const balance = await this.getAgentUsdcBalance();
    return balance >= amountUsdc;
  }

  /**
   * Airdrop SOL to agent wallet (devnet only)
   */
  async airdropSol(amount = 2) {
    if (this.network !== 'solana-devnet') {
      throw new Error('Airdrops only available on devnet');
    }

    const signature = await this.connection.requestAirdrop(
      this.agentWallet.publicKey,
      amount * 1e9 // Convert to lamports
    );

    await this.connection.confirmTransaction(signature);
    console.log(`Airdropped ${amount} SOL to agent wallet`);
    
    return signature;
  }
}

/**
 * Helper to create x402 client for making paid requests
 */
export function createAgentX402Client(wallet, network = 'solana-devnet') {
  return createX402Client({
    wallet,
    network,
    maxPaymentAmount: BigInt(100_000_000), // 100 USDC max
  });
}

/**
 * Utility functions for USDC conversion
 */
export const usdcUtils = {
  toMicroUsdc: (usd) => (usd * 1_000_000).toString(),
  fromMicroUsdc: (microUsdc) => parseFloat(microUsdc) / 1_000_000,
  formatUsdc: (amount) => `$${amount.toFixed(2)} USDC`,
};

/**
 * Payment verification middleware for Next.js API routes
 */
export async function withX402Payment(handler, priceUsdc, description) {
  return async (req, res) => {
    const x402 = new SolanaX402Handler({
      network: process.env.SOLANA_NETWORK,
      treasuryAddress: process.env.X402_TREASURY_ADDRESS,
      facilitatorUrl: process.env.X402_FACILITATOR_URL,
      rpcUrl: process.env.SOLANA_RPC_URL,
    });

    // Extract payment from headers
    const paymentHeader = x402.extractPayment(req.headers);

    // Create payment requirements
    const paymentRequirements = await x402.x402Handler.createPaymentRequirements({
      price: {
        amount: usdcUtils.toMicroUsdc(priceUsdc),
        asset: { address: x402.usdcMint.toString() }
      },
      network: x402.network,
      config: {
        description,
        resource: `${process.env.NEXT_PUBLIC_BASE_URL}${req.url}`,
      }
    });

    // If no payment, return 402
    if (!paymentHeader) {
      const response = x402.create402Response(paymentRequirements);
      return res.status(response.status).json(response.body);
    }

    // Verify payment
    const verified = await x402.verifyPayment(paymentHeader, paymentRequirements);
    
    if (!verified) {
      return res.status(402).json({ 
        error: 'Payment verification failed',
        message: 'Invalid or insufficient payment provided'
      });
    }

    // Payment verified, proceed with handler
    req.x402Payment = {
      verified: true,
      amount: priceUsdc,
      paymentHeader,
    };

    return handler(req, res);
  };
}

export default SolanaX402Handler;
