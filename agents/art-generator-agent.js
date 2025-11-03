/**
 * Art Generator Agent with x402 Payment Support
 * Now with REAL AI image generation and IPFS uploading!
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';

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
    
    // Initialize OpenAI for image generation
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Pinata configuration for IPFS
    this.pinataApiKey = process.env.PINATA_API_KEY;
    this.pinataSecretKey = process.env.PINATA_SECRET_API_KEY;
  }

  async generateArtPrompt() {
  // Try OpenAI first if available
  if (process.env.OPENAI_API_KEY) {
    try {
      this.log('Generating art prompt with AI...');
      const prompt = `Generate a creative and unique prompt for an electric fan NFT artwork. ONE sentence only:`;
      const artPrompt = await this.makeDecision(prompt);
      this.log(`Generated prompt: ${artPrompt}`);
      return artPrompt.trim();
    } catch (error) {
      this.log('⚠️  AI prompt failed, using random prompt', 'WARN');
    }
  }

  // Fallback to random prompts
  const prompts = [
    "A vintage brass desk fan from the 1920s with ornate Art Deco engravings",
    "A holographic cyberpunk cooling device with neon blue LED blades",
    "An ancient Japanese uchiwa fan painted with cherry blossoms",
    "A steampunk industrial fan with exposed brass gears",
    "A retro-futuristic atomic age fan with chrome finish"
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  this.log(`Using prompt: ${randomPrompt}`);
  return randomPrompt;
}

  /**
   * Generate an AI image using OpenAI's DALL-E
   */
  async generateAIImage(artPrompt) {
  // Try DALL-E first if available
  if (this.openai && process.env.OPENAI_API_KEY) {
    try {
      this.log('Generating AI image with DALL-E...');
      
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: artPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const imageUrl = response.data[0].url;
      this.log(`✅ Image generated with DALL-E`);
      
      const imageBuffer = await this.downloadImage(imageUrl);
      return { imageUrl, imageBuffer };
    } catch (error) {
      this.log(`⚠️  DALL-E failed, using free API...`, 'WARN');
    }
  }

  // Use free Pollinations.ai
  this.log('Using free Pollinations.ai...');
  const encodedPrompt = encodeURIComponent(artPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${Date.now()}`;
  
  const imageBuffer = await this.downloadImage(imageUrl);
  this.log(`✅ Image generated (free)`);
  
  return { imageUrl, imageBuffer };
}

  /**
   * Download image from URL to buffer
   */
  async downloadImage(url) {
  this.log('Downloading image...');
  
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      this.log(`Download attempt ${attempt}/${maxRetries}...`);
      
      const response = await fetch(url, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ArtGeneratorAgent/1.0)',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      this.log(`✅ Downloaded ${buffer.length} bytes`);
      return buffer;
      
    } catch (error) {
      lastError = error;
      this.log(`⚠️  Download attempt ${attempt} failed: ${error.message}`, 'WARN');
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // 2s, 4s, 6s
        this.log(`Retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to download image after ${maxRetries} attempts: ${lastError.message}`);
}

  /**
 * Upload image to IPFS using your /api/upload endpoint
 * This handles both image upload AND metadata creation automatically
 */
async uploadToIPFS(imageBuffer, filename, nftMetadata) {
  this.log('Uploading to IPFS via API endpoint...');
  
  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Add the image file
    formData.append('file', imageBuffer, {
      filename: filename,
      contentType: 'image/png',
    });
    
    // Add metadata (your API will use this to build the final metadata JSON)
    formData.append('metadata', JSON.stringify({
      name: nftMetadata.name,
      description: nftMetadata.description,
      type: 'image/png',
      attributes: nftMetadata.attributes || [],
    }));

    // Call your API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    const metadataUrl = data.url;
    
    this.log(`✅ Uploaded to IPFS: ${metadataUrl}`);
    
    return metadataUrl;
  } catch (error) {
    this.log(`❌ IPFS upload failed: ${error.message}`, 'ERROR');
    throw error;
  }
}


  async mintNFT(metadataUri, name, description) {
    this.log(`Minting NFT with x402 payment: ${name}`);

    const mintCost = 0.01;

    if (!this.canSpend(mintCost)) {
      throw new Error('Budget exhausted');
    }

    try {
      const result = await this.callAPIWithPayment('/api/agent/mint', mintCost, {
        method: 'POST',
        body: {
          uri: metadataUri,
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
      // Step 1: Generate art prompt
      const artPrompt = await this.generateArtPrompt();
      
      // Step 2: Generate AI image using DALL-E
      const { imageBuffer } = await this.generateAIImage(artPrompt);

// Step 3: Create metadata structure
const nftNumber = this.metrics.nftsMinted + 1;
const metadata = {
  name: `Fan #${nftNumber}`,
  description: artPrompt,
  attributes: [
    { trait_type: 'Type', value: 'Electric Fan' },
    { trait_type: 'Generation', value: 'AI' },
    { trait_type: 'Agent', value: this.name },
    { trait_type: 'Created', value: new Date().toISOString() },
  ],
};

// Step 4: Upload to IPFS (image + metadata in one call)
const imageFilename = `fan-nft-${Date.now()}.png`;
const metadataUri = await this.uploadToIPFS(imageBuffer, imageFilename, metadata);
      
      
      // Step 6: Mint NFT with metadata URI
      const mintResult = await this.mintNFT(
        metadataUri,
        metadata.name,
        metadata.description
      );

      // Step 7: Determine price
      const suggestedPrice = await this.determinePrice(artPrompt);
      
      // Step 8: List the NFT for sale
      const listingResult = await this.listNFT(mintResult.mintAddress, suggestedPrice);

      this.log(`\n✅ Iteration ${iteration} completed!`);
this.log(`   NFT: ${metadata.name}`);
this.log(`   Mint: ${mintResult.mintAddress}`);
this.log(`   Metadata URI: ${metadataUri}`);

      return {
        success: true,
        mintAddress: mintResult.mintAddress,
        name: metadata.name,
        metadataUri,
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

    if (!process.env.OPENAI_API_KEY) {
      this.log('❌ OPENAI_API_KEY not configured! Add it to .env.local', 'ERROR');
      return [];
    }

    if (!this.pinataApiKey || !this.pinataSecretKey) {
      this.log('⚠️  Pinata credentials not configured - will use mock IPFS URIs', 'WARN');
      this.log('For real IPFS uploads, add to .env.local:', 'WARN');
      this.log('  - PINATA_JWT=your-jwt-token (recommended)', 'WARN');
      this.log('  OR', 'WARN');
      this.log('  - PINATA_API_KEY=your-api-key', 'WARN');
      this.log('  - PINATA_SECRET_KEY=your-secret-key\n', 'WARN');
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
  console.log('PINATA_JWT loaded:', process.env.PINATA_JWT ? '✅' : '❌');
  console.log('PINATA_API_KEY loaded:', process.env.PINATA_API_KEY ? '✅' : '❌');
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