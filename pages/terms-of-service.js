'use client';
import Head from 'next/head';
import React from 'react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Terms of Service Content
const TERMS_OF_SERVICE_MD = `
# TERMS OF SERVICE: OnlyFansSolana

Last Updated: September 27, 2025

**IMPORTANT NOTICE: THIS IS A DEVNET/TESTING PLATFORM.**
THIS PLATFORM OPERATES EXCLUSIVELY ON THE SOLANA DEVELOPMENT NETWORK (DEVNET). ALL TOKENS, INCLUDING SOL AND NON-FUNGIBLE TOKENS (NFTS), HAVE **NO MONETARY VALUE** AND CANNOT BE EXCHANGED FOR REAL CURRENCY, MAINNET TOKENS, OR OTHER REAL-WORLD ASSETS. BY ACCESSING OR USING THIS SERVICE, YOU ACKNOWLEDGE AND ACCEPT THE RISKS ASSOCIATED WITH EXPERIMENTAL SOFTWARE, INCLUDING POTENTIAL LOSS OF TEST DATA AND ASSETS.

---

## 1. Acceptance of Terms

By using the services provided by OnlyFansSolana (referred to as "We," "Us," or "Our") through the OnlyFansSolana Devnet Marketplace ("the Service"), you agree to be bound by these Terms of Service (the "Terms"). If you do not agree to these Terms, do not use the Service.

**The primary purpose of the Service is to facilitate testing, development, and debugging of decentralized applications. It is not intended for commercial use.**

## 2. Devnet & Experimental Status Disclaimers

### 2.1. NO MONETARY VALUE

1. **Test Tokens Only:** All transactions on the Service use tokens (SOL and NFTs) obtained from the Solana Devnet faucet. These tokens are for testing purposes only and **possess zero (0) economic or financial value**.

2. **No Financial Liability:** We are not responsible for, and you will not have any claim against us for, any purported monetary loss, capital gain, tax liability, or financial damages arising from the use of, loss of, or changes to any Devnet assets.

3. **No Future Guarantee:** Your participation in the Devnet does not entitle you to any future compensation, airdrops, ownership, or rights on the Solana Mainnet, Testnet, or any future production environment.

### 2.2. SOFTWARE AS-IS & NO WARRANTY

The Service is provided on an **"AS IS"** and **"AS AVAILABLE"** basis. We make no guarantees regarding its functionality, security, or availability. You acknowledge and agree that:

* The Service may contain bugs, errors, or security vulnerabilities.

* The underlying Solana Devnet may experience resets, instability, or downtime without notice.

* Any data, smart contracts, or tokens deployed or stored on Devnet may be permanently deleted or lost without recovery.

## 3. User Accounts and Access

### 3.1. Eligibility

By using the Service, you represent and warrant that you are of legal age to form a binding contract in your jurisdiction.

### 3.2. Wallet Connection

You are solely responsible for maintaining the security of your Solana wallet and private keys used to access the Service. We do not store or control your private keys and cannot recover access to your wallet. You acknowledge that if your Devnet wallet is compromised, we bear no responsibility.

## 4. User Conduct and Content (Intellectual Property)

### 4.1. Responsibility for Content

You are solely responsible for all content, including any underlying digital assets (art, code, video, etc.) and metadata, that you mint, upload, trade, or associate with an NFT on the Service ("User Content").

### 4.2. IP Representation and Warranty

By creating or trading User Content, you represent and warrant that:

1. You own all intellectual property rights (including copyright, trademark, and publicity rights) necessary to use, mint, and offer the User Content for sale, or you have secured all necessary licenses and permissions.

2. The User Content does not infringe upon the intellectual property rights or other proprietary rights of any third party.

3. The User Content complies with all applicable laws and is not unlawful, defamatory, or hateful.

### 4.3. Indemnification for IP Infringement

You agree to indemnify, defend, and hold harmless OnlyFansSolana from and against all claims, liabilities, damages, and expenses (including legal fees) arising from any breach of your IP representations in this Section 4, regardless of the Devnet status.

## 5. Smart Contract and Blockchain Risks

### 5.1. Smart Contract Integrity

You acknowledge that the smart contracts governing the Service are experimental. We make no warranty that the smart contracts are free of errors or vulnerabilities. You use all smart contracts deployed on this Devnet at your own testing risk.

### 5.2. Network Risk

You accept the inherent risks associated with the Solana Devnet, including, but not limited to: high latency, transaction failure, consensus errors, and intentional or unintentional network resets or forks.

## 6. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL OnlyFansSolana OR ITS AFFILIATES BE LIABLE FOR ANY CONSEQUENTIAL, INCIDENTAL, INDIRECT, SPECIAL, PUNITIVE, OR OTHER DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF TEST DATA, LOSS OF TEST TOKENS, OR ANY OTHER PECUNIARY LOSS) ARISING OUT OF OR IN ANY WAY RELATED TO YOUR USE OF THE SERVICE, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

## 7. Governing Law

These Terms shall be governed by the laws of Switzerland without regard to its conflict of law principles.

## 8. Modifications to Terms

We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. We will provide notice of material changes by updating the "Last Updated" date at the top of these Terms. By continuing to access or use the Service after those revisions become effective, you agree to be bound by the revised Terms.
`;

/**
 * Custom component to render the basic structure of the Markdown text.
 */
const SimpleMarkdownRenderer = ({ content }) => {
  const parts = content.split('\n').map(line => line.trim());
  const elements = [];

  for (let i = 0; i < parts.length; i++) {
    let line = parts[i];

    if (line.startsWith('# TERMS OF SERVICE:')) {
      elements.push(
        <h1 key={i} style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginTop: 0,
          marginBottom: '16px',
          background: "linear-gradient(45deg, #9945FF, #14F195)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          {line.substring(2).trim()}
        </h1>
      );
    } else if (line.startsWith('**Last Updated:')) {
      elements.push(
        <p key={i} style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '24px'
        }}>
          {line.substring(2, line.length - 2)}
        </p>
      );
    } else if (line.startsWith('**IMPORTANT NOTICE:')) {
      elements.push(
        <div key={i} style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))',
          border: '1px solid #f59e0b',
          borderLeft: '4px solid #ef4444',
          color: '#dc2626',
          padding: '16px',
          fontWeight: '600',
          fontSize: '16px',
          margin: '24px 0',
          borderRadius: '12px'
        }}>
          {line.substring(2, line.length - 2)}
        </div>
      );
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />);
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginTop: '32px',
          marginBottom: '16px',
          background: "linear-gradient(45deg, #9945FF, #14F195)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          {line.substring(3).trim()}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{
          fontSize: '20px',
          fontWeight: '600',
          marginTop: '24px',
          marginBottom: '12px',
          color: '#1f2937'
        }}>
          {line.substring(4).trim()}
        </h3>
      );
    } else if (line.startsWith('*')) {
      elements.push(
        <li key={i} style={{
          marginLeft: '20px',
          marginBottom: '8px',
          color: '#6b7280',
          lineHeight: '1.6'
        }}>
          {line.substring(1).trim()}
        </li>
      );
    } else if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937; font-weight: 600">$1</strong>');
      elements.push(
        <li key={i} style={{
          marginLeft: '20px',
          marginBottom: '8px',
          color: '#6b7280',
          lineHeight: '1.6'
        }} dangerouslySetInnerHTML={{ __html: formattedLine }} />
      );
    } else if (line.length > 0) {
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937; font-weight: 600">$1</strong>');
      elements.push(
        <p key={i} style={{
          color: '#6b7280',
          marginBottom: '12px',
          lineHeight: '1.6'
        }} dangerouslySetInnerHTML={{ __html: formattedLine }} />
      );
    }
  }

  return <>{elements}</>;
};

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service - OnlyFansSolana</title>
        <meta name="description" content="Terms of Service for OnlyFansSolana Devnet Marketplace" />
      </Head>

      <div className="container">
        {/* Header matching other pages */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Animated OnlyFans Logo */}
            <div style={{ width: "70px", height: "47px", flexShrink: 0 }}>
              <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="fanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                    <stop offset="50%" style={{stopColor:"#14F195", stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                  </linearGradient>

                  <linearGradient id="solanaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:"#9945FF", stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#14F195", stopOpacity:1}} />
                  </linearGradient>

                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <circle cx="150" cy="80" r="45" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" opacity="0.8"/>

                <g filter="url(#glow)">
                  <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transformOrigin="150 80">
                    <animateTransform attributeName="transform" attributeType="XML"
                                      type="rotate" from="0 150 80" to="360 150 80"
                                      dur="1.5s" repeatCount="indefinite"/>
                  </ellipse>

                  <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transform="rotate(120 150 80)" transformOrigin="150 80">
                    <animateTransform attributeName="transform" attributeType="XML"
                                      type="rotate" from="120 150 80" to="480 150 80"
                                      dur="1.5s" repeatCount="indefinite"/>
                  </ellipse>

                  <ellipse cx="150" cy="50" rx="8" ry="25" fill="url(#fanGradient)" transform="rotate(240 150 80)" transformOrigin="150 80">
                    <animateTransform attributeName="transform" attributeType="XML"
                                      type="rotate" from="240 150 80" to="600 150 80"
                                      dur="1.5s" repeatCount="indefinite"/>
                  </ellipse>
                </g>

                <circle cx="150" cy="80" r="8" fill="#1e293b"/>
                <circle cx="150" cy="80" r="4" fill="url(#solanaGradient)"/>

                <rect x="147" y="115" width="6" height="25" fill="#475569" rx="3"/>
                <ellipse cx="150" cy="145" rx="20" ry="5" fill="#64748b"/>

                <text x="150" y="170" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="bold"
                      textAnchor="middle" fill="url(#solanaGradient)">
                  OnlyFansSolana
                </text>

                <text x="150" y="190" fontFamily="Arial, sans-serif" fontSize="10"
                      textAnchor="middle" fill="#64748b" fontStyle="italic">
                  Premium Electric Fan NFTs
                </text>

                <g opacity="0.4">
                  <path d="M 200 60 Q 220 65 240 60" stroke="#14F195" strokeWidth="2" fill="none" strokeLinecap="round">
                    <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite"/>
                  </path>
                  <path d="M 205 75 Q 230 78 250 75" stroke="#14F195" strokeWidth="1.5" fill="none" strokeLinecap="round">
                    <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.7s" repeatCount="indefinite"/>
                  </path>
                  <path d="M 200 90 Q 225 95 245 90" stroke="#14F195" strokeWidth="1" fill="none" strokeLinecap="round">
                    <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.9s" repeatCount="indefinite"/>
                  </path>
                </g>

                <rect x="10" y="10" width="30" height="15" rx="7" fill="#1e293b" opacity="0.9"/>
                <text x="25" y="21" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold"
                      textAnchor="middle" fill="#14F195">NFT</text>
              </svg>
            </div>

            <div>
              <h1 style={{
                margin: 0,
                fontSize: "32px",
                background: "linear-gradient(45deg, #9945FF, #14F195)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 'bold'
              }}>
                Terms of Service
              </h1>
              <p style={{
                margin: 0,
                fontSize: "14px",
                color: "#64748b",
                fontStyle: "italic"
              }}>
                OnlyFansSolana Devnet Marketplace Agreement
              </p>
            </div>
          </div>
          <WalletMultiButton />
        </div>

        {/* Content Card */}
        <div className="card" style={{ padding: '32px' }}>
          <SimpleMarkdownRenderer content={TERMS_OF_SERVICE_MD} />

          {/* Footer */}
          <div style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <p style={{
              color: '#6b7280',
              marginBottom: '0',
              lineHeight: '1.6'
            }}>
              By using OnlyFansSolana, you acknowledge that you have read and understood these terms.
            </p>
          </div>
        </div>

        {/* Bottom footer matching other pages */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '20px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <p style={{
            color: '#64748b',
            fontSize: '14px',
            margin: '0 0 8px 0'
          }}>
            Please read these terms carefully before using the OnlyFansSolana marketplace
          </p>
          <p style={{
            color: '#9945FF',
            fontSize: '12px',
            margin: 0,
            fontWeight: '500'
          }}>
            OnlyFansSolana - Devnet Testing Platform
          </p>
        </div>
      </div>
    </>
  );
}
