/**
 * Art Generator Agent with x402 Payment Support
 * Now with .env.local loading!
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local file
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { BaseAgent } from '../lib/base-agent.js';

class ArtGeneratorAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'ArtGeneratorAgent',
      maxDailySpend: config.maxDailySpend || 0.5,
      ...config
    });

    this.iterations = config.iterations || 3;
  }

  async generateArtPrompt() {
    this.log('Generating art prompt with AI...');

    const prompt = `Generate a creative and unique prompt for an electric fan NFT artwork.
Make it interesting and collectible. Respond with ONLY the prompt, nothing else.
Examples:
- "A vintage brass desk fan from the 1920s with ornate engravings"
- "A holographic cyberpunk cooling device with neon blue LED blades"
- "An ancient Japanese uchiwa fan painted with cherry blossoms"

Generate ONE creative fan prompt now:`;

    const artPrompt = await this.makeDecision(prompt);
    this.log(`Generated prompt: ${artPrompt}`);
    return artPrompt.trim();
  }

  async generateMetadata(artPrompt) {
    this.log('Creating NFT metadata...');

    const name = `Fan #${this.metrics.nftsMinted + 1}`;
    const description = artPrompt;
    const imageUrl = `https://picsum.photos/seed/${Date.now()}/400/400`;

    const metadata = {
      name,
      description,
      image: imageUrl,
      attributes: [
        { trait_type: 'Type', value: 'Electric Fan' },
        { trait_type: 'Generation', value: 'AI' },
        { trait_type: 'Agent', value: this.name },
      ],
    };

    this.log(`Created metadata for: ${name}`);
    return { metadata, imageUrl };
  }

  async uploadToIPFS(metadata) {
    this.log('Uploading to IPFS...');
    
    const mockUri = `ipfs://Qm${Math.random().toString(36).substring(2, 15)}`;
    
    this.log(`Metadata uploaded: ${mockUri}`);
    return mockUri;
  }

  async mintNFT(metadataUri, name, description) {
    this.log(`Minting NFT with x402 payment: ${name}`);

    const mintCost = 0.01;

    if (!this.canSpend(mintCost)) {
      throw new Error('Budget exhausted');
    }

    try {
      const result = await this.callAPIWithPayment('/api/agent/mint', 0.01, {
        method: 'POST',
        body: {
          uri: metadataUri,  // Use 'uri' to match the API
          name: name,
          sellerFeeBasisPoints: 500,
        }
      });

      this.trackSpending(mintCost, 'mint');
      this.log(`✅ NFT minted with payment: ${result.nftMint}`);
      
      return result;
    } catch (error) {
      this.log(`❌ Mint failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async listNFT(mintAddress, price) {
  this.log(`Listing NFT ${mintAddress} for ${price} SOL`);

  try {
    const result = await this.callAPI('/api/agent/list', {
      method: 'POST',
      body: {
        nftMint: mintAddress,
        price: price,
      }
    });

    this.log(`✅ NFT listed for ${price} SOL`);
    return result;
  } catch (error) {
    this.log(`❌ Listing failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

  async determinePrice(artPrompt) {
    const prompt = `As an NFT pricing expert, determine a fair price in SOL for this NFT:
"${artPrompt}"

Consider:
- It's an AI-generated electric fan NFT
- Target collectors are fan enthusiasts
- Price should be between 0.5 and 5 SOL

Respond with ONLY a number (the price in SOL), nothing else.`;

    const priceStr = await this.makeDecision(prompt);
    const price = parseFloat(priceStr.match(/[\d.]+/)?.[0] || '2.0');
    
    this.log(`AI suggested price: ${price} SOL`);
    return Math.max(0.5, Math.min(5, price));
  }

  async runIteration(iteration) {
  this.log(`\n${'='.repeat(50)}`);
  this.log(`Starting Iteration ${iteration}/${this.iterations}`);
  this.log(`${'='.repeat(50)}\n`);

  try {
    const artPrompt = await this.generateArtPrompt();
    const { metadata, imageUrl } = await this.generateMetadata(artPrompt);
    const metadataUri = await this.uploadToIPFS(metadata);
    
    const mintResult = await this.mintNFT(
      metadataUri,
      metadata.name,
      metadata.description
    );

    const suggestedPrice = await this.determinePrice(artPrompt);
    
    // NEW: List the NFT for sale
    const listingResult = await this.listNFT(mintResult.mintAddress, suggestedPrice);

    this.log(`\n✅ Iteration ${iteration} completed!`);
    this.log(`   NFT: ${metadata.name}`);
    this.log(`   Mint: ${mintResult.mintAddress}`);
    this.log(`   Listed for: ${suggestedPrice} SOL`);
    this.log(`   Listing Account: ${listingResult.listing}`);
    this.log(`   Payment: ${mintResult.payment.amount} SOL sent`);

    return {
      success: true,
      mintAddress: mintResult.mintAddress,
      name: metadata.name,
      suggestedPrice,
      listingAccount: listingResult.listing,
      paid: mintResult.payment.amount,
    };

  } catch (error) {
    this.log(`❌ Iteration ${iteration} failed: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message,
    };
  }
}

  async run() {
    this.log(`\n🤖 ${this.name} starting with x402 payments...`);
    this.log(`   Wallet: ${this.walletInfo?.address || 'not configured'}`);
    this.log(`   Budget: ${this.maxDailySpend} USDC`);
    this.log(`   Iterations: ${this.iterations}`);
    this.log(`   AI Provider: ${this.aiProvider}`);
    this.log(`   Model: ${this.model || 'mock'}\n`);

    if (!this.x402) {
      this.log('❌ x402 not configured! Check AGENT_WALLET_PRIVATE_KEY', 'ERROR');
      this.log('Make sure .env.local is in the project root and contains:', 'ERROR');
      this.log('  - AGENT_WALLET_PRIVATE_KEY=your-base64-key', 'ERROR');
      this.log('  - SOLANA_NETWORK=solana-devnet', 'ERROR');
      this.log('  - X402_TREASURY_ADDRESS=your-wallet-address', 'ERROR');
      return [];
    }

    const results = [];

    for (let i = 1; i <= this.iterations; i++) {
      if (!this.canSpend(0.01)) {
        this.log('Budget exhausted, stopping...', 'WARN');
        break;
      }

      const result = await this.runIteration(i);
      results.push(result);

      if (i < this.iterations) {
        this.log('Waiting 3 seconds before next iteration...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.log(`\n${'='.repeat(50)}`);
    this.log('FINAL SUMMARY');
    this.log(`${'='.repeat(50)}`);
    const summary = this.getSummary();
    this.log(`NFTs Minted: ${summary.metrics.nftsMinted}`);
    this.log(`Total Spent: ${summary.metrics.totalSpent} USDC`);
    this.log(`Budget Remaining: ${summary.budget.remaining} USDC`);
    this.log(`Success Rate: ${results.filter(r => r.success).length}/${results.length}`);
    this.log(`${'='.repeat(50)}\n`);

    return results;
  }
}

// Run the agent
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Loading environment variables from .env.local...');
  console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? '✅' : '❌');
  console.log('AGENT_WALLET_PRIVATE_KEY loaded:', process.env.AGENT_WALLET_PRIVATE_KEY ? '✅' : '❌');
  console.log('SOLANA_NETWORK:', process.env.SOLANA_NETWORK || 'not set');
  console.log('');

  const agent = new ArtGeneratorAgent({
    maxDailySpend: 0.5,
    iterations: 3,
  });

  agent.run()
    .then(() => {
      console.log('\n✅ Agent completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Agent failed:', error);
      process.exit(1);
    });
}

export default ArtGeneratorAgent;