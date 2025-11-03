/**
 * Base AI Agent class with x402 payment support
 */

// Load environment variables
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import SolanaX402Handler from './x402-handler.js';

export class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || 'Agent';
    this.maxDailySpend = config.maxDailySpend || 1;
    this.currentSpend = 0;
    
    // Initialize AI provider
    this.aiProvider = config.aiProvider || (process.env.OPENAI_API_KEY ? 'openai' : 'anthropic');
    
    if (this.aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
      this.ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.model = config.model || 'gpt-4o-mini';
    } else if (this.aiProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.model = config.model || 'claude-3-5-sonnet-20241022';
    } else {
      console.warn('[BaseAgent] No AI API key found, will use mock responses');
      this.ai = null;
    }

    // Initialize x402 handler for payments
    try {
      this.x402 = new SolanaX402Handler({
        network: process.env.SOLANA_NETWORK || 'solana-devnet',
        treasuryAddress: process.env.X402_TREASURY_ADDRESS,
        facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network',
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        privateKey: process.env.AGENT_WALLET_PRIVATE_KEY,
      });

      // Get wallet info
      this.walletInfo = { address: this.x402.agentWallet.publicKey.toString() };
      this.log(`Initialized with wallet: ${this.walletInfo.address}`);
    } catch (error) {
      console.error('[BaseAgent] Failed to initialize x402 handler:', error.message);
      this.x402 = null;
      this.walletInfo = null;
    }

    // Agent metrics
    this.metrics = {
      nftsMinted: 0,
      nftsPurchased: 0,
      totalSpent: 0,
      totalEarned: 0,
    };

    // Marketplace API endpoint
    this.apiEndpoint = config.apiEndpoint || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:3000';
  }

  /**
   * Make an AI decision
   */
  async makeDecision(prompt, options = {}) {
    if (!this.ai) {
      return this.mockDecision(prompt);
    }

    const systemPrompt = this.getSystemPrompt();

    try {
      if (this.aiProvider === 'openai') {
        const response = await this.ai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
        });
        return response.choices[0].message.content;
      } else if (this.aiProvider === 'anthropic') {
        const response = await this.ai.messages.create({
          model: this.model,
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
          system: systemPrompt,
          messages: [
            { role: 'user', content: prompt }
          ],
        });
        return response.content[0].text;
      }
    } catch (error) {
      console.error(`[${this.name}] AI error:`, error.message);
      return this.mockDecision(prompt);
    }
  }

  mockDecision(prompt) {
    if (prompt.includes('art prompt') || prompt.includes('generate')) {
      return 'A futuristic electric fan with neon lights and holographic blades';
    }
    if (prompt.includes('price') || prompt.includes('worth')) {
      return '2.5';
    }
    if (prompt.includes('buy') || prompt.includes('purchase')) {
      return 'yes';
    }
    return 'A futuristic electric fan with neon lights and holographic blades';
  }

  getSystemPrompt() {
    return `You are ${this.name}, an AI agent in an NFT marketplace.
You make decisions about creating and trading NFTs.
Be concise and respond with actionable answers.
Budget: ${this.maxDailySpend} SOL per day.`;
  }

  canSpend(amount) {
    const remaining = this.maxDailySpend - this.currentSpend;
    if (remaining < amount) {
      this.log(`Budget exhausted. Spent: ${this.currentSpend}/${this.maxDailySpend} SOL`, 'WARN');
      return false;
    }
    return true;
  }

  trackSpending(amount, type) {
    this.currentSpend += amount;
    this.metrics.totalSpent += amount;
    
    if (type === 'mint') this.metrics.nftsMinted++;
    if (type === 'buy') this.metrics.nftsPurchased++;
    
    this.log(`Spent ${amount} SOL on ${type}. Total: ${this.currentSpend}/${this.maxDailySpend}`);
  }


/**
 * Call marketplace API with x402 payment
 */
async callAPIWithPayment(endpoint, priceSol, options = {}) {
  if (!this.x402) {
    throw new Error('x402 handler not initialized - check AGENT_WALLET_PRIVATE_KEY');
  }

  const url = `${this.apiEndpoint}${endpoint}`;
  
  this.log(`Calling ${endpoint} with ${priceSol} SOL payment...`);

  try {
    // Step 1: Call API without payment to get 402 response with payment requirements
    const initialResponse = await fetch(url, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const initialData = await initialResponse.json();

    // If not 402, something else happened
    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        return initialData; // Unexpected success without payment
      }
      throw new Error(initialData.error || `API error: ${initialResponse.status}`);
    }

    this.log('Received 402 Payment Required');

    // Step 2: Extract payment requirements from 402 response
    const paymentRequirements = initialData.paymentRequirements || initialData;

    // Step 3: Create payment (server-side)
    const payment = await this.x402.createAgentPayment(paymentRequirements);

    this.log('Payment created: ' + JSON.stringify(payment));

    // Step 4: Make request again with payment header as STRING
    const paidResponse = await fetch(url, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': typeof payment === 'string' ? payment : JSON.stringify(payment),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const paidData = await paidResponse.json();

    if (!paidResponse.ok) {
      throw new Error(paidData.error || `Payment failed: ${paidResponse.status}`);
    }

    this.log(`✅ Payment successful! Response received.`);
    return paidData;

  } catch (error) {
    this.log(`API call failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

  /**
   * Call API without payment (for GET requests, etc.)
   */
  async callAPI(endpoint, options = {}) {
    const url = `${this.apiEndpoint}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      this.log(`API call failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] ${level}: ${message}`);
  }

  getSummary() {
    return {
      name: this.name,
      wallet: this.walletInfo?.address || 'not configured',
      budget: {
        max: this.maxDailySpend,
        spent: this.currentSpend,
        remaining: this.maxDailySpend - this.currentSpend,
      },
      metrics: this.metrics,
    };
  }
}

export default BaseAgent;