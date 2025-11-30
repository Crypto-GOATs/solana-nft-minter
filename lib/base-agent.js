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
import { GoogleGenerativeAI } from '@google/generative-ai';
import SolanaX402Handler from './x402-handler.js';

export class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || 'Agent';
    this.maxDailySpend = config.maxDailySpend || 1;
    this.currentSpend = 0;

    // Initialize AI provider (prioritize Gemini as it's free)
    this.aiProvider = config.aiProvider || this.detectAvailableProvider();

    if (this.aiProvider === 'gemini' && process.env.GOOGLE_AI_API_KEY) {
      this.ai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      this.model = config.model || 'gemini-1.5-flash-latest'; // Free tier model
      this.geminiModel = this.ai.getGenerativeModel({ model: this.model });
    } else if (this.aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
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
    this.apiEndpoint = config.apiEndpoint || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // SMART AGENT FEATURES
    // Memory system for learning
    this.memory = {
      successfulActions: [],
      failedActions: [],
      marketObservations: [],
      insights: [],
      maxMemorySize: config.maxMemorySize || 50,
    };

    // Strategy settings
    this.strategy = config.strategy || 'moderate';
    this.adaptiveStrategy = config.adaptiveStrategy !== false;

    // Performance tracking for adaptation
    this.performanceWindow = [];
    this.performanceWindowSize = 10;
  }

  /**
   * Detect which AI provider is available (prioritize free options)
   */
  detectAvailableProvider() {
    if (process.env.GOOGLE_AI_API_KEY) return 'gemini';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    return null;
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
      if (this.aiProvider === 'gemini') {
        // Gemini combines system prompt with user prompt
        const fullPrompt = `${systemPrompt}\n\n${prompt}`;
        const result = await this.geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxTokens || 500,
          },
        });
        return result.response.text();
      } else if (this.aiProvider === 'openai') {
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

  /**
   * SMART AGENT FEATURES
   */

  /**
   * Multi-step reasoning - break complex decisions into steps
   */
  async reasonInSteps(steps) {
    this.log('Starting multi-step reasoning...');
    const results = [];
    let context = '';

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.log(`Step ${i + 1}/${steps.length}: ${step.name}`);

      const prompt = context
        ? `Previous analysis:\n${context}\n\nNow: ${step.prompt}`
        : step.prompt;

      const result = await this.makeDecision(prompt, step.options || {});
      results.push({ step: step.name, result });
      context += `\n${step.name}: ${result}`;
    }

    return results;
  }

  /**
   * Chain-of-thought reasoning for complex problems
   */
  async chainOfThought(problem, thoughtSteps = 3) {
    this.log('Using chain-of-thought reasoning...');

    const prompt = `Problem: ${problem}

Think through this step-by-step:
1. What are the key factors to consider?
2. What are the risks and opportunities?
3. What's the best decision and why?

Provide your reasoning for each step, then conclude with a clear recommendation.`;

    const reasoning = await this.makeDecision(prompt, { maxTokens: 800 });
    this.memory.insights.push({
      timestamp: new Date().toISOString(),
      problem,
      reasoning,
    });

    return reasoning;
  }

  /**
   * Add to memory with automatic pruning
   */
  addToMemory(category, entry) {
    if (!this.memory[category]) {
      this.memory[category] = [];
    }

    this.memory[category].push({
      timestamp: new Date().toISOString(),
      ...entry,
    });

    // Prune old memories
    if (this.memory[category].length > this.memory.maxMemorySize) {
      this.memory[category].shift();
    }
  }

  /**
   * Learn from an action's outcome
   */
  learnFromAction(action, outcome, metadata = {}) {
    const entry = {
      action,
      outcome,
      success: outcome === 'success',
      ...metadata,
    };

    if (outcome === 'success') {
      this.addToMemory('successfulActions', entry);
      this.log(`✓ Learned from success: ${action}`);
    } else {
      this.addToMemory('failedActions', entry);
      this.log(`✗ Learned from failure: ${action}`);
    }

    // Track performance for adaptation
    this.performanceWindow.push(outcome === 'success' ? 1 : 0);
    if (this.performanceWindow.length > this.performanceWindowSize) {
      this.performanceWindow.shift();
    }
  }

  /**
   * Get contextual memory for decision-making
   */
  getMemoryContext(relevantTo = null) {
    const recentSuccesses = this.memory.successfulActions.slice(-5);
    const recentFailures = this.memory.failedActions.slice(-5);
    const recentInsights = this.memory.insights.slice(-3);

    let context = '';

    if (recentSuccesses.length > 0) {
      context += `Recent successes:\n${recentSuccesses.map(s => `- ${s.action} (${s.metadata?.reason || 'no details'})`).join('\n')}\n\n`;
    }

    if (recentFailures.length > 0) {
      context += `Recent failures:\n${recentFailures.map(f => `- ${f.action} (${f.metadata?.reason || 'no details'})`).join('\n')}\n\n`;
    }

    if (recentInsights.length > 0) {
      context += `Recent insights:\n${recentInsights.map(i => `- ${i.reasoning.substring(0, 150)}...`).join('\n')}\n\n`;
    }

    return context;
  }

  /**
   * Make decision with memory context
   */
  async makeSmartDecision(prompt, includeMemory = true) {
    let enhancedPrompt = prompt;

    if (includeMemory && (this.memory.successfulActions.length > 0 || this.memory.failedActions.length > 0)) {
      const memoryContext = this.getMemoryContext();
      enhancedPrompt = `${memoryContext}Current decision:\n${prompt}`;
    }

    return await this.makeDecision(enhancedPrompt);
  }

  /**
   * Analyze market trends from observations
   */
  async analyzeMarketTrends(listings) {
    this.log('Analyzing market trends...');

    const observationPrompt = `Analyze these NFT marketplace listings:

${listings.slice(0, 15).map(l => `- ${l.name || l.nftMint}: ${l.price} SOL`).join('\n')}

Provide analysis:
1. Price range patterns
2. What seems overvalued/undervalued
3. Market sentiment (bullish/bearish/neutral)
4. Recommended action strategy

Be specific and data-driven.`;

    const analysis = await this.makeDecision(observationPrompt, { maxTokens: 600 });

    this.addToMemory('marketObservations', {
      listingCount: listings.length,
      analysis,
      avgPrice: listings.reduce((sum, l) => sum + (l.price || 0), 0) / listings.length,
    });

    return analysis;
  }

  /**
   * Create strategic plan before acting
   */
  async createStrategicPlan(context, goals, constraints) {
    this.log('Creating strategic plan...');

    const planPrompt = `Create a strategic action plan:

Context: ${context}
Goals: ${goals}
Constraints: ${constraints}

Provide a step-by-step plan with:
1. Priority actions (ordered by importance)
2. Expected outcomes for each action
3. Risk assessment
4. Success criteria

Format as structured points.`;

    const plan = await this.makeDecision(planPrompt, { maxTokens: 800 });

    this.addToMemory('insights', {
      type: 'strategic_plan',
      context,
      plan,
    });

    return plan;
  }

  /**
   * Adapt strategy based on performance
   */
  async adaptStrategy() {
    if (!this.adaptiveStrategy || this.performanceWindow.length < 5) {
      return null;
    }

    const successRate = this.performanceWindow.reduce((a, b) => a + b, 0) / this.performanceWindow.length;
    const recentTrend = this.performanceWindow.slice(-3).reduce((a, b) => a + b, 0) / 3;

    this.log(`Performance analysis: ${(successRate * 100).toFixed(1)}% success rate`);

    const adaptPrompt = `Performance analysis:
Overall success rate: ${(successRate * 100).toFixed(1)}%
Recent trend: ${(recentTrend * 100).toFixed(1)}%
Current strategy: ${this.strategy}

Recent actions:
${this.memory.successfulActions.slice(-3).map(a => `✓ ${a.action}`).join('\n')}
${this.memory.failedActions.slice(-3).map(a => `✗ ${a.action}`).join('\n')}

Should we adapt our strategy? Consider:
- If success rate < 30%, recommend more conservative
- If success rate > 70%, can be more aggressive
- Analyze what's working and what's not

Respond with: "KEEP [strategy]" or "CHANGE to [strategy]" with brief reasoning.`;

    const recommendation = await this.makeDecision(adaptPrompt);

    if (recommendation.includes('CHANGE to conservative')) {
      this.strategy = 'conservative';
      this.log('🔄 Strategy adapted to CONSERVATIVE');
      return 'conservative';
    } else if (recommendation.includes('CHANGE to aggressive')) {
      this.strategy = 'aggressive';
      this.log('🔄 Strategy adapted to AGGRESSIVE');
      return 'aggressive';
    } else if (recommendation.includes('CHANGE to moderate')) {
      this.strategy = 'moderate';
      this.log('🔄 Strategy adapted to MODERATE');
      return 'moderate';
    }

    this.log(`Strategy maintained: ${this.strategy}`);
    return null;
  }

  /**
   * Self-critique and improvement
   */
  async selfCritique(action, result) {
    const critiquePrompt = `Self-critique:
Action taken: ${action}
Result: ${result}

What could have been done better? What should we learn from this?
Be honest and constructive. Provide 2-3 specific insights.`;

    const critique = await this.makeDecision(critiquePrompt);

    this.addToMemory('insights', {
      type: 'self_critique',
      action,
      critique,
    });

    return critique;
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