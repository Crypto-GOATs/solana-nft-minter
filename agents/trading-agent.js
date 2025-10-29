/**
 * Trading Agent - Autonomously buys and sells NFTs for profit
 */

import { BaseAgent } from '../lib/base-agent.js';

class TradingAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'TradingAgent',
      maxDailySpend: config.maxDailySpend || 10,
      ...config
    });

    this.iterations = config.iterations || 10;
    this.strategy = config.strategy || 'moderate'; // conservative, moderate, aggressive
  }

  /**
   * Fetch marketplace listings
   */
  async fetchMarketplace() {
    this.log('Scanning marketplace...');

    try {
      // In production, call your actual marketplace API
      // For now, return mock data
      const mockListings = [
        {
          nftMint: 'mock-nft-1',
          name: 'Vintage Fan #42',
          price: 1.5, // SOL
          seller: 'seller-wallet-1',
        },
        {
          nftMint: 'mock-nft-2',
          name: 'Cyberpunk Fan #17',
          price: 3.2,
          seller: 'seller-wallet-2',
        },
        {
          nftMint: 'mock-nft-3',
          name: 'Classic Fan #8',
          price: 0.8,
          seller: 'seller-wallet-3',
        },
      ];

      this.log(`Found ${mockListings.length} listings`);
      return mockListings;
    } catch (error) {
      this.log(`Failed to fetch marketplace: ${error.message}`, 'ERROR');
      return [];
    }
  }

  /**
   * Analyze if NFT is worth buying using AI
   */
  async analyzeNFT(listing) {
    const prompt = `Analyze this NFT listing:
Name: ${listing.name}
Price: ${listing.price} SOL

As an NFT trader with ${this.strategy} strategy, should we buy this?

Consider:
- Fair market value for electric fan NFTs
- Rarity and uniqueness
- Resale potential
- Our ${this.strategy} risk tolerance

Respond with ONLY "yes" or "no" and a brief reason (max 20 words).
Format: "yes - [reason]" or "no - [reason]"`;

    const decision = await this.makeDecision(prompt);
    const shouldBuy = decision.toLowerCase().includes('yes');
    
    this.log(`Analysis for ${listing.name}: ${decision}`);
    
    return {
      shouldBuy,
      reasoning: decision,
    };
  }

  /**
   * Buy an NFT
   */
  async buyNFT(listing) {
    this.log(`Attempting to buy: ${listing.name} for ${listing.price} SOL`);

    // Convert SOL to USDC (simplified 1:1 for now)
    const costUsdc = listing.price;

    if (!this.canSpend(costUsdc)) {
      throw new Error('Budget exhausted');
    }

    try {
      // Call your buy API
      const result = await this.callAPI(`/api/agent/buy/${listing.nftMint}`, {
        method: 'POST',
        body: {
          buyerWallet: 'agent-wallet-address', // Your agent's wallet
          maxPrice: listing.price,
        },
      });

      this.trackSpending(costUsdc, 'buy');
      this.log(`✅ Purchased: ${listing.name}`);
      
      return result;
    } catch (error) {
      this.log(`❌ Purchase failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Determine resale price using AI
   */
  async determineResalePrice(listing, purchasePrice) {
    const profitMargin = {
      conservative: 0.2, // 20%
      moderate: 0.35,     // 35%
      aggressive: 0.5,    // 50%
    }[this.strategy] || 0.35;

    const prompt = `We bought "${listing.name}" for ${purchasePrice} SOL.
Our strategy is ${this.strategy} (target ${profitMargin * 100}% profit).

What's a good resale price in SOL?

Respond with ONLY a number (the price), nothing else.`;

    const priceStr = await this.makeDecision(prompt);
    const price = parseFloat(priceStr.match(/[\d.]+/)?.[0] || (purchasePrice * (1 + profitMargin)).toString());
    
    const finalPrice = Math.max(purchasePrice * 1.1, price); // At least 10% profit
    
    this.log(`AI suggested resale price: ${finalPrice} SOL`);
    return finalPrice;
  }

  /**
   * Run one iteration of trading
   */
  async runIteration(iteration) {
    this.log(`\n${'='.repeat(50)}`);
    this.log(`Trading Iteration ${iteration}/${this.iterations}`);
    this.log(`${'='.repeat(50)}\n`);

    try {
      // Step 1: Fetch marketplace
      const listings = await this.fetchMarketplace();

      if (listings.length === 0) {
        this.log('No listings available', 'WARN');
        return { success: false, reason: 'no_listings' };
      }

      // Step 2: Analyze each listing
      for (const listing of listings) {
        // Check if we still have budget
        if (!this.canSpend(listing.price)) {
          this.log('Budget exhausted', 'WARN');
          break;
        }

        // Analyze NFT
        const analysis = await this.analyzeNFT(listing);

        if (analysis.shouldBuy) {
          // Step 3: Buy NFT
          try {
            const buyResult = await this.buyNFT(listing);
            
            // Step 4: Determine resale price
            const resalePrice = await this.determineResalePrice(listing, listing.price);

            this.log(`\n✅ Trade completed!`);
            this.log(`   Bought: ${listing.name}`);
            this.log(`   Purchase Price: ${listing.price} SOL`);
            this.log(`   Target Resale: ${resalePrice} SOL`);
            this.log(`   Expected Profit: ${(resalePrice - listing.price).toFixed(2)} SOL\n`);

            return {
              success: true,
              nftMint: listing.nftMint,
              purchasePrice: listing.price,
              resalePrice,
            };
          } catch (error) {
            this.log(`Failed to buy ${listing.name}: ${error.message}`, 'ERROR');
            continue; // Try next listing
          }
        } else {
          this.log(`Skipping ${listing.name}: ${analysis.reasoning}`);
        }

        // Wait 1 second between analyses
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return { success: false, reason: 'no_suitable_nfts' };

    } catch (error) {
      this.log(`❌ Iteration failed: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Main agent loop
   */
  async run() {
    this.log(`\n🤖 ${this.name} starting...`);
    this.log(`   Budget: ${this.maxDailySpend} USDC`);
    this.log(`   Strategy: ${this.strategy}`);
    this.log(`   Iterations: ${this.iterations}`);
    this.log(`   AI Provider: ${this.aiProvider}`);
    this.log(`   Model: ${this.model || 'mock'}\n`);

    const results = [];

    for (let i = 1; i <= this.iterations; i++) {
      if (!this.canSpend(0.5)) { // Min buy is 0.5 SOL
        this.log('Budget exhausted, stopping...', 'WARN');
        break;
      }

      const result = await this.runIteration(i);
      results.push(result);

      // Wait 3 seconds between iterations
      if (i < this.iterations) {
        this.log('Waiting 3 seconds before next scan...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Print summary
    this.log(`\n${'='.repeat(50)}`);
    this.log('FINAL SUMMARY');
    this.log(`${'='.repeat(50)}`);
    const summary = this.getSummary();
    this.log(`NFTs Purchased: ${summary.metrics.nftsPurchased}`);
    this.log(`Total Spent: ${summary.metrics.totalSpent} USDC`);
    this.log(`Budget Remaining: ${summary.budget.remaining} USDC`);
    this.log(`Success Rate: ${results.filter(r => r.success).length}/${results.length}`);
    this.log(`${'='.repeat(50)}\n`);

    return results;
  }
}

// Run the agent if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new TradingAgent({
    maxDailySpend: 10,
    iterations: 10,
    strategy: process.env.AGENT_TRADING_STRATEGY || 'moderate',
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

export default TradingAgent;