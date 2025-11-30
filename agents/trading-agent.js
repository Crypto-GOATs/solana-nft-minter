/**
 * Trading Agent - Autonomously buys and sells NFTs for profit
 * Enhanced with real marketplace integration and x402 payments
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
    this.portfolio = []; // Track owned NFTs
  }

  /**
   * Fetch marketplace listings from real API
   */
  async fetchMarketplace() {
    this.log('Scanning marketplace...');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/listings`);

      if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.statusText}`);
      }

      const data = await response.json();
      
      const listings = Array.isArray(data) ? data : (data.listings || []);

      // Filter and format active listings
      const formattedListings = listings
        .filter(listing => {
          if (listing.closed || listing.isSold) return false;
          if (this.walletInfo?.address && listing.seller === this.walletInfo.address) return false;
          return true;
        })
        .map(listing => ({
          nftMint: listing.nftMint || listing.mint,
          name: listing.metadata?.name || listing.name || 'Unknown NFT',
          description: listing.metadata?.description || listing.description || '',
          image: listing.metadata?.image || listing.image || '',
          price: typeof listing.price === 'number' ? listing.price : (listing.price?.toNumber?.() / 1_000_000_000 || 0),
          seller: listing.seller,
          listingAccount: listing.listingAccount || listing.publicKey,
          attributes: listing.metadata?.attributes || listing.attributes || [],
        }));

      this.log(`Found ${formattedListings.length} active listings`);
      return formattedListings;
    } catch (error) {
      this.log(`Failed to fetch marketplace: ${error.message}`, 'ERROR');
      return [];
    }
  }

  /**
   * SMART: Analyze NFT using multi-step reasoning and memory
   */
  async analyzeNFT(listing) {
    this.log(`🧠 Smart analysis for ${listing.name}...`);

    try {
      const attributesStr = listing.attributes
        ?.map(attr => `${attr.trait_type}: ${attr.value}`)
        .join(', ') || 'None';

      // Multi-step analysis
      const analysisSteps = [
        {
          name: 'Value Assessment',
          prompt: `Evaluate this NFT's value:
Name: ${listing.name}
Price: ${listing.price} SOL
Description: ${listing.description}
Attributes: ${attributesStr}

Electric fan NFTs typically range 0.5-5 SOL. Is this fairly priced, overpriced, or undervalued? Explain briefly.`
        },
        {
          name: 'Resale Potential',
          prompt: `For the NFT "${listing.name}" at ${listing.price} SOL, what's the resale potential? Consider collector appeal and uniqueness. Rate 1-10 and explain.`
        },
        {
          name: 'Risk Assessment',
          prompt: `With ${this.strategy} risk tolerance, assess the risk of buying "${listing.name}" at ${listing.price} SOL. Low/Medium/High risk? Why?`
        }
      ];

      const reasoning = await this.reasonInSteps(analysisSteps);

      // Final decision using smart decision with memory
      const finalPrompt = `Based on this analysis:
${reasoning.map(r => `${r.step}: ${r.result}`).join('\n')}

Strategy: ${this.strategy}
Budget remaining: ${(this.maxDailySpend - this.currentSpend).toFixed(2)} SOL

Should we buy "${listing.name}" for ${listing.price} SOL?
Respond with ONLY "yes - [reason]" or "no - [reason]" (max 15 words).`;

      const decision = await this.makeSmartDecision(finalPrompt);
      const shouldBuy = decision.toLowerCase().includes('yes');

      this.log(`Decision: ${decision}`);

      return {
        shouldBuy,
        reasoning: decision,
        detailedAnalysis: reasoning,
      };
    } catch (error) {
      this.log(`⚠️ Smart analysis failed, using simple method`, 'WARN');
      return this.analyzeNFTSimple(listing);
    }
  }

  async analyzeNFTSimple(listing) {
    const attributesStr = listing.attributes
      ?.map(attr => `${attr.trait_type}: ${attr.value}`)
      .join(', ') || 'None';

    const prompt = `Analyze this NFT listing:
Name: ${listing.name}
Price: ${listing.price} SOL
Description: ${listing.description}
Attributes: ${attributesStr}

As an NFT trader with ${this.strategy} strategy, should we buy this?

Consider:
- Fair market value for electric fan NFTs (typically 0.5-5 SOL)
- Rarity and uniqueness
- Resale potential
- Our ${this.strategy} risk tolerance

Respond with ONLY "yes" or "no" and a brief reason (max 20 words).
Format: "yes - [reason]" or "no - [reason]"`;

    const decision = await this.makeDecision(prompt);
    const shouldBuy = decision.toLowerCase().includes('yes');

    return {
      shouldBuy,
      reasoning: decision,
    };
  }

  /**
   * Buy an NFT using the marketplace API with x402 payment
   */
  async buyNFT(listing) {
    this.log(`Attempting to buy: ${listing.name} for ${listing.price} SOL`);

    const costUsdc = listing.price * 1;

    if (!this.canSpend(costUsdc)) {
      throw new Error('Budget exhausted');
    }

    try {
      const buyPath = `/api/agent/buy/${listing.nftMint}`;
      
      // Use callAPIWithPayment which handles x402 automatically
      const result = await this.callAPIWithPayment(buyPath, costUsdc, {
        method: 'POST',
        body: {
          buyerWallet: this.walletInfo?.address,
        }
      });

      this.trackSpending(costUsdc, 'buy');
      this.metrics.nftsPurchased = (this.metrics.nftsPurchased || 0) + 1;
      
      this.portfolio.push({
        nftMint: listing.nftMint,
        name: listing.name,
        purchasePrice: listing.price,
        purchaseDate: new Date().toISOString(),
      });

      this.log(`✅ Purchased: ${listing.name}`);
      if (result.txSignature) {
        this.log(`   Transaction: ${result.txSignature}`);
      }
      
      return result;
    } catch (error) {
      this.log(`❌ Purchase failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * List NFT for resale
   */
  async listForResale(nftMint, name, resalePrice) {
    this.log(`Listing ${name} for ${resalePrice} SOL`);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/agent/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nftMint: nftMint,
          price: resalePrice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Listing failed');
      }

      const result = await response.json();
      this.log(`✅ Listed for ${resalePrice} SOL`);
      
      return result;
    } catch (error) {
      this.log(`❌ Listing failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Determine resale price using AI
   */
  async determineResalePrice(listing, purchasePrice) {
    const profitMargin = {
      conservative: 0.15,
      moderate: 0.30,
      aggressive: 0.50,
    }[this.strategy] || 0.30;

    const prompt = `We bought "${listing.name}" for ${purchasePrice} SOL.
Our strategy is ${this.strategy} (target ${profitMargin * 100}% profit).

What's a competitive resale price in SOL?

Respond with ONLY a number (the price), nothing else.`;

    try {
      const priceStr = await this.makeDecision(prompt);
      const price = parseFloat(priceStr.match(/[\d.]+/)?.[0] || (purchasePrice * (1 + profitMargin)).toString());
      
      const minPrice = purchasePrice * 1.10;
      const maxPrice = purchasePrice * 2.0;
      const finalPrice = Math.min(Math.max(minPrice, price), maxPrice);
      
      this.log(`AI suggested resale price: ${finalPrice.toFixed(2)} SOL`);
      return parseFloat(finalPrice.toFixed(2));
    } catch (error) {
      const fallbackPrice = purchasePrice * (1 + profitMargin);
      this.log(`Using fallback price: ${fallbackPrice.toFixed(2)} SOL`, 'WARN');
      return parseFloat(fallbackPrice.toFixed(2));
    }
  }

  /**
   * SMART: Run one iteration with market analysis and learning
   */
  async runIteration(iteration) {
    this.log(`\n${'='.repeat(50)}`);
    this.log(`Trading Iteration ${iteration}/${this.iterations}`);
    this.log(`${'='.repeat(50)}\n`);

    try {
      const listings = await this.fetchMarketplace();

      if (listings.length === 0) {
        this.log('No listings available', 'WARN');
        return { success: false, reason: 'no_listings' };
      }

      // SMART: Analyze market trends first
      if (iteration === 1 || iteration % 3 === 0) {
        this.log('📊 Analyzing market trends...');
        const marketAnalysis = await this.analyzeMarketTrends(listings);
        this.log(`Market insight: ${marketAnalysis.substring(0, 100)}...`);
      }

      for (const listing of listings) {
        if (listing.seller === this.walletInfo?.address) {
          this.log(`Skipping our own listing: ${listing.name}`);
          continue;
        }

        if (!this.canSpend(listing.price)) {
          this.log('Budget exhausted for this iteration', 'WARN');
          break;
        }

        if (listing.price > this.maxDailySpend * 0.5) {
          this.log(`Skipping ${listing.name}: Price too high (${listing.price} SOL)`);
          continue;
        }

        const analysis = await this.analyzeNFT(listing);

        if (analysis.shouldBuy) {
          try {
            await this.buyNFT(listing);
            const resalePrice = await this.determineResalePrice(listing, listing.price);
            await this.listForResale(listing.nftMint, listing.name, resalePrice);

            const expectedProfit = resalePrice - listing.price;
            const profitPercent = ((expectedProfit / listing.price) * 100).toFixed(1);

            this.log(`\n✅ Trade completed!`);
            this.log(`   Bought: ${listing.name}`);
            this.log(`   Purchase Price: ${listing.price} SOL`);
            this.log(`   Listed at: ${resalePrice} SOL`);
            this.log(`   Expected Profit: ${expectedProfit.toFixed(2)} SOL (${profitPercent}%)\n`);

            // Learn from successful trade
            this.learnFromAction(`Bought ${listing.name}`, 'success', {
              reason: analysis.reasoning,
              price: listing.price,
              expectedProfit: expectedProfit.toFixed(2),
            });

            return {
              success: true,
              nftMint: listing.nftMint,
              name: listing.name,
              purchasePrice: listing.price,
              resalePrice,
              expectedProfit,
              profitPercent,
            };
          } catch (error) {
            this.log(`Failed to complete trade: ${error.message}`, 'ERROR');

            // Learn from failed trade
            this.learnFromAction(`Attempted to buy ${listing.name}`, 'failure', {
              reason: error.message,
              price: listing.price,
            });

            continue;
          }
        } else {
          this.log(`Skipping ${listing.name}: ${analysis.reasoning}`);
        }

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
   * SMART: Main agent loop with strategy adaptation
   */
  async run() {
    this.log(`\n🤖 ${this.name} starting...`);
    this.log(`   Wallet: ${this.walletInfo?.address || 'not configured'}`);
    this.log(`   Budget: ${this.maxDailySpend} USDC`);
    this.log(`   Strategy: ${this.strategy}`);
    this.log(`   Adaptive Strategy: ${this.adaptiveStrategy ? 'enabled' : 'disabled'}`);
    this.log(`   Iterations: ${this.iterations}\n`);

    if (!this.x402 && !this.walletInfo) {
      this.log('❌ Wallet not configured!', 'ERROR');
      return [];
    }

    const results = [];
    let totalProfit = 0;

    for (let i = 1; i <= this.iterations; i++) {
      if (!this.canSpend(0.5)) {
        this.log('Budget exhausted, stopping...', 'WARN');
        break;
      }

      const result = await this.runIteration(i);
      results.push(result);

      if (result.success && result.expectedProfit) {
        totalProfit += result.expectedProfit;
      }

      // SMART: Adapt strategy every 3 iterations
      if (i % 3 === 0 && this.adaptiveStrategy) {
        this.log('\n🔄 Evaluating strategy adaptation...');
        await this.adaptStrategy();
      }

      if (i < this.iterations) {
        this.log('Waiting 3 seconds before next scan...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.log(`\n${'='.repeat(50)}`);
    this.log('FINAL SUMMARY');
    this.log(`${'='.repeat(50)}`);
    const summary = this.getSummary();
    const successfulTrades = results.filter(r => r.success).length;
    
    this.log(`NFTs Purchased: ${this.metrics.nftsPurchased || 0}`);
    this.log(`Total Spent: ${summary.metrics.totalSpent} USDC`);
    this.log(`Budget Remaining: ${summary.budget.remaining} USDC`);
    this.log(`Success Rate: ${successfulTrades}/${results.length}`);
    this.log(`Expected Profit: ${totalProfit.toFixed(2)} SOL`);
    this.log(`\nPortfolio (${this.portfolio.length} NFTs):`);
    this.portfolio.forEach(nft => {
      this.log(`  - ${nft.name} (${nft.purchasePrice} SOL)`);
    });
    this.log(`${'='.repeat(50)}\n`);

    return results;
  }
}

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