# Solana NFT Minter (Drag & Drop + IPFS Upload)

A minimal Next.js dApp to let users **upload an image/video**, store it on **IPFS via NFT.storage**, and **mint an NFT** on Solana using the **Metaplex Token Metadata** program.

https://github.com/metaplex-foundation

## Features
- Connect wallet (Phantom, Solflare, Backpack)
- Drag-and-drop upload with live preview (images & videos)
- Uploads file + metadata to IPFS (NFT.storage)
- Mints NFT via Metaplex JS
- Configurable royalties (basis points)
- Devnet by default

## Quick Start

```bash
# 1) Unzip and install deps
npm install

# 2) Copy env file
cp .env.example .env.local
# Fill NEXT_PUBLIC_NFT_STORAGE_KEY with your NFT.storage API key
# Optionally set NEXT_PUBLIC_SOLANA_RPC

# 3) Run dev server
npm run dev
```

Open http://localhost:3000

## Notes / Production Hardening
- Exposing `NEXT_PUBLIC_NFT_STORAGE_KEY` in the browser is fine for demos,
  but **not recommended** for production. Instead, create a Next.js API route
  that handles the upload server-side and keeps your key secret.
- Consider rate limiting, allowlists, and file size/type checks to prevent abuse.
- Start on **Devnet**. When ready, switch to a mainnet RPC provider and ensure
  your users understand network fees and risks.

## Tech Stack
- Next.js (pages router)
- @solana/web3.js, Metaplex JS SDK
- @solana/wallet-adapter (React + UI)
- NFT.storage
- react-dropzone
```

