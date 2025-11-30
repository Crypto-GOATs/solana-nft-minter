'use client';

import React from 'react';

/**
 * LitepaperPage Component
 * Renders the full OnlyFansSolana Litepaper document using custom, embedded CSS.
 * This component is designed to be used as a separate page/route within the Next.js application.
 */
const LitepaperPage = () => {
    
    // Custom CSS Styles for the Litepaper document
    const customStyles = `
        .litepaper-root {
            min-height: 100vh;
            background: #0b0b12;
            color: #e5e7eb;
            padding-top: 48px;
            padding-bottom: 80px;
        }
        .container {
            max-width: 960px;
            margin: 0 auto;
            padding: 24px;
            background: #13131f;
            border: 1px solid #1f2033;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            transition: 0.2s all;
        }

        /* Headers */
        .doc-header {
            font-size: 2.5rem;
            font-weight: 800;
            color: #7c3aed; /* Using the button purple for a highlight color */
            border-bottom: 1px solid #232640;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .doc-subheader {
            font-size: 2rem;
            font-weight: 600;
            color: #e5e7eb;
            margin-top: 32px;
            margin-bottom: 16px;
            border-left: 4px solid #10b981; /* Contrasting green */
            padding-left: 12px;
        }
        .doc-section-header {
            font-size: 1.25rem;
            font-weight: 700;
            color: #e5e7eb;
            margin-top: 24px;
            margin-bottom: 12px;
        }

        /* Text and Lists */
        .doc-paragraph, .doc-list li {
            color: #9aa0b3;
            line-height: 1.6;
            margin-bottom: 16px;
        }
        .doc-list {
            list-style: disc;
            margin-left: 16px;
            padding-left: 16px;
        }
        .doc-strong {
            color: #e5e7eb;
            font-weight: 600;
        }

        /* Table */
        .doc-table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            border: 1px solid #1f2033;
            border-radius: 8px;
            overflow: hidden;
        }
        .doc-table thead {
            background: #1d1f35;
        }
        .doc-table th, .doc-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #1f2033;
            font-size: 0.875rem;
        }
        .doc-table th {
            color: #b7c0d8;
            text-transform: uppercase;
        }
        .doc-td-role {
            font-weight: 600;
            color: #e5e7eb;
        }
        .doc-td-key {
            color: #34d399; /* Green for keys */
            font-family: monospace;
            white-space: nowrap;
        }

        /* Specific text highlights */
        .highlight-purple {
            color: #7c3aed;
        }
        .highlight-red {
            color: #ef4444; /* Standard Tailwind red for emphasis */
            font-weight: 700;
        }
        .doc-ordered-list {
             list-style: decimal;
             margin-left: 16px;
             padding-left: 16px;
        }
        @media (max-width: 600px) {
            .doc-header { font-size: 1.75rem; }
            .doc-subheader { font-size: 1.5rem; }
            .container { padding: 16px; }
        }
    `;

    const tableData = [
        { role: "Creator (Seller)", responsibility: "Uploads image, mints NFT, defines royalties, lists the NFT for sale.", key: "Wallet Public Key" },
        { role: "Collector (Buyer)", responsibility: "Purchases the listed NFT using SOL.", key: "Wallet Public Key" },
        { role: "Listing Account", responsibility: "Program-derived address (PDA) storing the NFT's list price and state.", key: "PDA (Listing)" },
        { role: "Escrow Token Account", responsibility: "Holds the NFT on behalf of the seller while it is listed for sale.", key: "PDA (Escrow Token)" },
    ];

    return (
        <div className="litepaper-root">
            {/* Embedded CSS Styles */}
            <style dangerouslySetInnerHTML={{ __html: customStyles }} />

            <div className="container">
                <h1 className="doc-header">
                    OnlyFansSolana: The Solana Electric Fan NFT Marketplace
                </h1>

                {/* Abstract */}
                <section>
                    <h2 className="doc-subheader" style={{ marginTop: 0 }}>Abstract</h2>
                    <p className="doc-paragraph">
                        <strong className="highlight-purple">OnlyFansSolana</strong> is a decentralized application (dApp) on the Solana blockchain that serves as a niche marketplace for creating, verifying, and trading <strong className="doc-strong">Electric Fan NFTs</strong>. Leveraging the high throughput and low latency of Solana, the platform offers creators a seamless way to mint unique, collectible fan artwork. The core innovation is the use of a <strong className="doc-strong">Machine Learning (ML) model</strong> to verify that uploaded imagery genuinely depicts an electric fan, ensuring content fidelity and exclusivity for collectors.
                    </p>
                </section>

                {/* 1. The Problem */}
                <section>
                    <h2 className="doc-subheader">1. The Problem: Content Verification & Niche Collectibility</h2>
                    <p className="doc-paragraph">
                        The current NFT ecosystem struggles with content sprawl, generic projects, and a lack of mechanisms to enforce thematic compliance. For niche collectors, finding verified, high-quality, and thematically accurate digital assets is difficult.
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Content Saturation:</strong> Finding specific, high-quality assets in broad marketplaces is challenging.</li>
                        <li><strong className="doc-strong">Verification Gap:</strong> There is often no technical guarantee that an NFT's image matches the project's theme or stated parameters.</li>
                    </ul>
                </section>

                {/* 2. The Solution */}
                <section>
                    <h2 className="doc-subheader">2. The Solution: OnlyFansSolana (The Electric Fan Marketplace)</h2>
                    <p className="doc-paragraph">
                        <strong className="highlight-purple">OnlyFansSolana</strong> introduces a streamlined, vertically integrated solution powered by Solana's technology and Anchor smart contracts, defined by the following core features:
                    </p>

                    <h3 className="doc-section-header">2.1. ML-Powered Verification (The Fan Police)</h3>
                    <p className="doc-paragraph">
                        Every image uploaded by a user must pass a proprietary, on-chain-ready <strong className="doc-strong">AI classification step</strong> before minting is allowed.
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">How it Works:</strong> The uploaded image is passed through a pre-trained **MobileNet** model (or similar classifier) integrated into the application layer.</li>
                        <li><strong className="doc-strong">The Guardrail:</strong> The system is specifically trained (or configured) to identify the "electric fan" object class with a high degree of confidence.</li>
                        <li><strong className="doc-strong">Outcome:</strong> If the image is successfully classified as an electric fan, the user receives an <strong className="doc-strong">AI-Verified</strong> status, enabling the mint. If it fails, the mint is blocked, ensuring thematic purity for the collection.</li>
                    </ul>

                    <h3 className="doc-section-header">2.2. Solana Foundation</h3>
                    <p className="doc-paragraph">
                        <strong className="highlight-purple">OnlyFansSolana</strong> is built entirely on the Solana blockchain, offering distinct advantages:
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Low Cost:</strong> Minimal transaction fees allow creators to mint and list assets affordably and frequently.</li>
                        <li><strong className="doc-strong">Speed:</strong> Instant finality ensures listings and sales are executed almost immediately.</li>
                        <li><strong className="doc-strong">Standard Compliance:</strong> All NFTs adhere to the **Metaplex Token Metadata Program (MPL-TM)** standard, ensuring maximum compatibility across all major Solana marketplaces and wallets.</li>
                    </ul>
                </section>

                {/* 3. Marketplace Mechanics */}
                <section>
                    <h2 className="doc-subheader">3. The OnlyFansSolana Marketplace Mechanics</h2>
                    <p className="doc-paragraph">
                        The dApp uses an **Anchor program** to manage the listing and sale of the AI-verified fan NFTs.
                    </p>
                    
                    {/* Table */}
                    <div className="doc-table-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="doc-table">
                            <thead className="doc-thead">
                                <tr>
                                    <th className="doc-th">Role</th>
                                    <th className="doc-th">Responsibility</th>
                                    <th className="doc-th">Solana Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, index) => (
                                    <tr key={index}>
                                        <td className="doc-td doc-td-role">{row.role}</td>
                                        <td className="doc-td">{row.responsibility}</td>
                                        <td className="doc-td doc-td-key">{row.key}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="doc-section-header">3.1. The Minting and Listing Process</h3>
                    <ol className="doc-ordered-list">
                        <li><strong className="doc-strong">Upload & Verification:</strong> User uploads the fan image. The ML model verifies the image.</li>
                        <li><strong className="doc-strong">Minting:</strong> Upon successful verification, the creator defines the NFT name, description, and <strong className="doc-strong">Royalties (Seller Fee Basis Points)</strong>, and triggers the Metaplex `createNft` function.</li>
                        <li><strong className="doc-strong">Listing:</strong> The creator specifies the price in <strong className="doc-strong">SOL</strong>. The Anchor listing instruction is executed, creating the `Listing` account and transferring the NFT from the creator's wallet to the `Escrow Token Account`.</li>
                        <li><strong className="doc-strong">Sale:</strong> A buyer executes the `buy_nft` instruction, transferring SOL to the creator (minus royalties and platform fees), and receiving the NFT from the Escrow account.</li>
                    </ol>
                    
                    <h3 className="doc-section-header">3.2. Royalties and Fees</h3>
                    <p className="doc-paragraph">
                        Creators set their desired royalties during the mint process. <strong className="highlight-red">This rate is defaulted to 5% (500 BPS)</strong>, and these royalties are automatically enforced at the protocol level for all future secondary sales, directly compensating the original Fan artist.
                    </p>
                </section>

                {/* 4. Technology Stack */}
                <section>
                    <h2 className="doc-subheader">4. Technology Stack</h2>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Blockchain:</strong> Solana</li>
                        <li><strong className="doc-strong">Smart Contracts:</strong> Anchor Framework</li>
                        <li><strong className="doc-strong">NFT Standard:</strong> Metaplex Token Metadata Program</li>
                        <li><strong className="doc-strong">Frontend:</strong> Next.js (React)</li>
                        <li><strong className="doc-strong">AI Verification:</strong> TensorFlow.js with a pre-trained MobileNet model (or similar lightweight classification network).</li>
                    </ul>
                </section>

                {/* 5. X402 Integration and AI Agents */}
                <section>
                    <h2 className="doc-subheader">5. X402 Integration and Autonomous AI Agents</h2>

                    <h3 className="doc-section-header">5.1. X402 Protocol Integration</h3>
                    <p className="doc-paragraph">
                        <strong className="highlight-purple">OnlyFansSolana</strong> is now integrated with the <strong className="doc-strong">X402 protocol</strong>, enabling advanced AI agent interactions and autonomous marketplace participation. This integration allows AI agents to seamlessly interact with the platform's smart contracts, enabling programmatic NFT listing, purchasing, and trading operations.
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Agent Authentication:</strong> Secure wallet management for AI agents through the X402 protocol.</li>
                        <li><strong className="doc-strong">Automated Transactions:</strong> AI agents can autonomously execute marketplace transactions with proper authorization.</li>
                        <li><strong className="doc-strong">API Integration:</strong> RESTful API endpoints enable AI agents to interact with the marketplace programmatically.</li>
                    </ul>

                    <h3 className="doc-section-header">5.2. AI Trading Agents</h3>
                    <p className="doc-paragraph">
                        We are actively developing <strong className="doc-strong">autonomous AI trading agents</strong> that participate in the OnlyFansSolana marketplace. These agents employ various strategies to analyze, trade, and curate electric fan NFT collections.
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Art Generator Agent:</strong> Creates and mints AI-generated electric fan artwork, leveraging the ML verification system to ensure all generated images pass the "fan police" checks.</li>
                        <li><strong className="doc-strong">Trading Agent:</strong> Analyzes market trends, pricing patterns, and rarity metrics to make autonomous buying and selling decisions within the marketplace.</li>
                        <li><strong className="doc-strong">Collector Agent:</strong> Curates themed collections based on specific criteria such as art style, pricing, or historical significance.</li>
                        <li><strong className="doc-strong">Market Maker Agent:</strong> Provides liquidity by maintaining buy and sell listings at competitive prices.</li>
                    </ul>

                    <h3 className="doc-section-header">5.3. Agent Architecture</h3>
                    <p className="doc-paragraph">
                        Each AI agent operates with the following core components:
                    </p>
                    <ul className="doc-list">
                        <li><strong className="doc-strong">Wallet Management:</strong> Secure Solana wallet with dedicated keypair for autonomous transactions.</li>
                        <li><strong className="doc-strong">Decision Engine:</strong> Machine learning models and rule-based systems that determine trading strategies.</li>
                        <li><strong className="doc-strong">ML Verification:</strong> Integration with the platform's MobileNet-based fan verification system to ensure compliance.</li>
                        <li><strong className="doc-strong">Transaction Executor:</strong> Anchor-based transaction builder that interacts with the marketplace smart contracts.</li>
                    </ul>
                </section>

                {/* 6. Future Roadmap */}
                <section>
                    <h2 className="doc-subheader">6. Future Roadmap</h2>
                    <ol className="doc-ordered-list">
                        <li><strong className="doc-strong">Multi-Agent Ecosystem:</strong> Expand the AI agent framework to support third-party developers creating custom trading and curation agents.</li>
                        <li><strong className="doc-strong">Agent Marketplace:</strong> Enable users to subscribe to or purchase AI agent strategies and services.</li>
                        <li><strong className="doc-strong">Advanced ML Models:</strong> Integrate more sophisticated image generation and classification models, including fine-tuned Stable Diffusion models specifically trained on electric fan designs.</li>
                        <li><strong className="doc-strong">Community Governance:</strong> Introduce a DAO mechanism for the community to vote on new verification classes (e.g., "Vintage Fans," "Industrial Fans") and agent behavior parameters.</li>
                        <li><strong className="doc-strong">Cross-Chain Integration:</strong> Explore bridging mechanisms to enable electric fan NFT trading across multiple blockchain networks.</li>
                        <li><strong className="doc-strong">Fan Swapping:</strong> Implement a simple swap mechanism for directly trading Fan NFTs peer-to-peer without listing fees.</li>
                    </ol>
                </section>
            </div>
        </div>
    );
};

export default LitepaperPage;
