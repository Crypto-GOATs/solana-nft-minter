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

  /**
   * SMART: Generate art prompt with feedback loop and memory
   */
  async generateArtPrompt() {
    if (!process.env.OPENAI_API_KEY) {
      return this.generateFallbackPrompt();
    }

    try {
      this.log('🧠 Generating smart art prompt with feedback loop...');

      // Get memory context from past successes
      const memoryContext = this.getMemoryContext();

      // Step 1: Generate multiple candidate prompts
      const candidatePrompts = await this.generateCandidatePrompts(memoryContext);

      // Step 2: Evaluate and select best prompt
      const bestPrompt = await this.evaluateAndSelectBest(candidatePrompts);

      this.log(`✅ Selected prompt: ${bestPrompt}`);
      return bestPrompt.trim();
    } catch (error) {
      this.log('⚠️  Smart prompt generation failed, using fallback', 'WARN');
      return this.generateFallbackPrompt();
    }
  }

  async generateCandidatePrompts(memoryContext) {
    const basePrompt = `${memoryContext}
Generate 3 creative and unique prompts for electric fan NFT artworks.

Consider:
- Unique artistic styles (Art Deco, cyberpunk, steampunk, minimalist, baroque, etc.)
- Unusual materials or concepts
- What has worked well in the past (from memory above)
- Collector appeal and uniqueness

Format: Return ONLY 3 prompts, one per line, numbered 1-3.`;

    const response = await this.makeDecision(basePrompt, { maxTokens: 300 });

    // Parse the 3 prompts
    const prompts = response
      .split('\n')
      .filter(line => line.trim().match(/^[123][\.\)]/))
      .map(line => line.replace(/^[123][\.\)]\s*/, '').trim())
      .filter(p => p.length > 10);

    return prompts.length >= 2 ? prompts : [
      response.split('\n')[0],
      "A holographic cyberpunk cooling device with neon blue LED blades",
      "A vintage brass desk fan from the 1920s with ornate Art Deco engravings"
    ];
  }

  async evaluateAndSelectBest(prompts) {
    this.log(`Evaluating ${prompts.length} candidate prompts...`);

    const evaluationPrompt = `Rate these NFT art prompts for marketability and uniqueness (1-10 scale):

${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Consider:
- Uniqueness and creativity
- Appeal to collectors
- Visual potential
- Market demand for electric fan NFTs

Respond with ONLY the number (1-${prompts.length}) of the best prompt and a brief reason.
Format: "[number] - [reason]"`;

    const evaluation = await this.makeDecision(evaluationPrompt);

    // Extract the selected number
    const match = evaluation.match(/^(\d+)/);
    const selectedIndex = match ? parseInt(match[1]) - 1 : 0;

    const validIndex = Math.max(0, Math.min(selectedIndex, prompts.length - 1));
    const selectedPrompt = prompts[validIndex];

    this.log(`Selected option ${validIndex + 1}: ${evaluation}`);

    return selectedPrompt;
  }

  generateFallbackPrompt() {
    const prompts = [
      "A vintage brass desk fan from the 1920s with ornate Art Deco engravings",
      "A holographic cyberpunk cooling device with neon blue LED blades",
      "An ancient Japanese uchiwa fan painted with cherry blossoms",
      "A steampunk industrial fan with exposed brass gears",
      "A retro-futuristic atomic age fan with chrome finish"
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    this.log(`Using fallback prompt: ${randomPrompt}`);
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
      this.log(`✅ NFT minted with payment: ${result.mintAddress}`);
      
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

  /**
   * SMART: Determine price using multi-step reasoning
   */
  async determinePrice(artPrompt) {
    this.log('🧠 Using smart pricing analysis...');

    try {
      // Multi-step pricing reasoning
      const reasoningSteps = [
        {
          name: 'Rarity Assessment',
          prompt: `Analyze the rarity/uniqueness of this NFT concept: "${artPrompt}". Rate 1-10 and explain briefly.`
        },
        {
          name: 'Market Positioning',
          prompt: `For this NFT: "${artPrompt}". What market segment does it appeal to? (mass market/mid-tier/premium)`
        },
        {
          name: 'Price Recommendation',
          prompt: `Based on the rarity and market positioning, suggest a price between 0.5-5 SOL. Consider electric fan NFT market. Reply with ONLY the number.`
        }
      ];

      const reasoning = await this.reasonInSteps(reasoningSteps);

      // Extract price from final step
      const priceResult = reasoning[2].result;
      const price = parseFloat(priceResult.match(/[\d.]+/)?.[0] || '2.0');
      const finalPrice = Math.max(0.5, Math.min(5, price));

      this.log(`Smart pricing: ${finalPrice} SOL`);
      this.log(`  - ${reasoning[0].result.substring(0, 50)}...`);

      return finalPrice;
    } catch (error) {
      this.log('⚠️ Smart pricing failed, using simple method', 'WARN');
      return this.determineSimplePrice(artPrompt);
    }
  }

  async determineSimplePrice(artPrompt) {
    const prompt = `Price this NFT in SOL (0.5-5): "${artPrompt}". Reply with ONLY a number.`;
    const priceStr = await this.makeDecision(prompt);
    const price = parseFloat(priceStr.match(/[\d.]+/)?.[0] || '2.0');
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
      this.log('Waiting 10 seconds for NFT to propagate on-chain...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      const listingResult = await this.listNFT(mintResult.mintAddress, suggestedPrice);

      this.log(`\n✅ Iteration ${iteration} completed!`);
this.log(`   NFT: ${metadata.name}`);
this.log(`   Mint: ${mintResult.mintAddress}`);
this.log(`   Metadata URI: ${metadataUri}`);

      // Learn from success
      this.learnFromAction(`Created NFT: ${metadata.name}`, 'success', {
        reason: `Minted with prompt: ${artPrompt.substring(0, 80)}`,
        price: suggestedPrice,
        prompt: artPrompt
      });

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

      // Learn from failure
      this.learnFromAction(`Attempted NFT creation`, 'failure', {
        reason: error.message,
        iteration
      });

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