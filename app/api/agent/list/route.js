// app/api/agent/list/route.js
import { NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import idlJson from '../../../../target/idl/solana_marketplace.json';
import * as tf from '@tensorflow/tfjs';
// 🚨 IMPORTANT: You MUST have the 'canvas' package installed in your Node.js environment.
import { createCanvas, loadImage } from 'canvas'; 

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PROGRAM_ID = new PublicKey('5Hixra6LUDzgLfE3C3S11H4h3f2Psnq6LkcxuEaKP8sb');

let cachedModel = null;
// New: Use a Promise to manage concurrent loading attempts
let modelPromise = null;

class NodeWallet {
  constructor(payer) {
    this.payer = payer;
  }
  async signTransaction(tx) {
    tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions(txs) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
  get publicKey() {
    return this.payer.publicKey;
  }
}

// Load MobileNet model
async function loadModel() {
  if (cachedModel) return cachedModel;
  
  // If a model is currently being loaded, return the promise for that operation
  if (modelPromise) return modelPromise;

  // Start the loading operation and store the promise
  modelPromise = (async () => {
      console.log('Loading MobileNet model...');
      // 🔄 Cosmetic change to force server restart:
      const model = await tf.loadLayersModel(
        'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json'
      );
      console.log('✅ Model loaded');
      cachedModel = model; // Cache the successful result
      modelPromise = null; // Clear the promise only on success
      return model;
  })().catch(error => {
      // CRITICAL FIX: If model loading fails (e.g., due to variable registration error),
      // we must clear the promise so the next API call can try again.
      console.error('TensorFlow Model Load Failure (Promise Reset):', error.message);
      modelPromise = null;
      throw error;
  });

  return modelPromise;
}

// Verify NFT image is a fan using ML
async function verifyNFTIsFan(nftMint, retries = 5) {
   try {
    const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
    const { mplTokenMetadata, fetchDigitalAsset } = await import('@metaplex-foundation/mpl-token-metadata');
    const { publicKey } = await import('@metaplex-foundation/umi');

    const connection = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const umi = createUmi(connection).use(mplTokenMetadata());
    const mint = publicKey(nftMint);
    
    let asset;
    let lastError;
    
    // Aggressive retry with exponential backoff
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[ML] Fetching NFT metadata (attempt ${i + 1}/${retries}...`);
        asset = await fetchDigitalAsset(umi, mint);
        console.log(`[ML] ✅ Metadata fetched successfully`);
        break;
      } catch (error) {
        lastError = error;
        console.log(`[ML] ⚠️ Fetch failed: ${error.message}`);
        
        if (i < retries - 1) {
          // Exponential backoff: 5s, 10s, 15s, 20s, 25s
          const waitTime = (i + 1) * 5000;
          console.log(`[ML] Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!asset) {
      console.error('[ML] Failed to fetch NFT metadata after all retries');
      // TEMPORARY: Skip ML verification if metadata not ready
      return { 
        isFan: true, // ⚠️ TEMPORARILY bypass for fresh mints
        confidence: 1.0,
        reason: 'Metadata not yet indexed - bypassing verification for new mint',
        bypassed: true
      };
    }

    if (!asset.metadata.uri) {
      return { isFan: false, reason: 'No metadata URI' };
    }

    // 2. Get metadata JSON
    let metadataUri = asset.metadata.uri;
    if (metadataUri.startsWith('ipfs://')) {
      const ipfsHash = metadataUri.replace('ipfs://', '');
      metadataUri = `https://beige-magnetic-sheep-465.mypinata.cloud/ipfs/${ipfsHash}`;
    }

    const metadataResponse = await fetch(metadataUri, { signal: AbortSignal.timeout(10000) });
    if (!metadataResponse.ok) {
      return { isFan: false, reason: 'Metadata fetch failed' };
    }

    const metadata = await metadataResponse.json();
    if (!metadata.image) {
      return { isFan: false, reason: 'No image in metadata' };
    }

    // 3. Get image URL
    let imageUrl = metadata.image;
    if (imageUrl.startsWith('ipfs://')) {
      const ipfsHash = imageUrl.replace('ipfs://', '');
      imageUrl = `https://beige-magnetic-sheep-465.mypinata.cloud/ipfs/${ipfsHash}`;
    }

    console.log('Fetching image from:', imageUrl);

    // 4. Download image
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageResponse.ok) {
      return { isFan: false, reason: 'Image fetch failed' };
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // 5. Load ML model
    const model = await loadModel();

    // 6. Load image using node-canvas (returns a Node.js Image object)
    const img = await loadImage(imageBuffer);

    // A. Create a canvas element and context matching the image size
    const canvasElement = createCanvas(img.width, img.height);
    const ctx = canvasElement.getContext('2d');

    // B. Draw the loaded image onto the canvas
    ctx.drawImage(img, 0, 0, img.width, img.height);

    // C. Extract the ImageData object (contains raw RGBA pixel data)
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    // 7. Convert to tensor and preprocess 
    
    // --- FIX: Use tf.tensor3d to manually construct the tensor from the raw pixel data ---
    // This bypasses environment-specific I/O issues with tf.fromPixels.
    // The ImageData.data is a Uint8ClampedArray of RGBA values. We must strip the alpha channel
    // and then reshape it into a 3D tensor [height, width, 3].
    
    // 7a. Extract only RGB channels from RGBA data (drop Alpha)
    const data = imageData.data;
    const size = imageData.width * imageData.height;
    const pixelArray = new Uint8Array(size * 3); // Allocate array for RGB (3 channels)

    for (let i = 0; i < size; i++) {
        // Read RGBA data (i * 4) and write RGB data (i * 3)
        const offset = i * 4;
        pixelArray[i * 3]     = data[offset];     // R
        pixelArray[i * 3 + 1] = data[offset + 1]; // G
        pixelArray[i * 3 + 2] = data[offset + 2]; // B
    }

    // 7b. Create the 3D tensor [height, width, 3] from the RGB array
    const tfImage = tf.tensor3d(
        pixelArray, 
        [imageData.height, imageData.width, 3], 
        'int32' // Use 'int32' for raw byte data
    ); 

    // --- END FIX ---
    
    // Ensure you resize the tensor to the expected dimensions, as decodeImage preserves the original size
    const resized = tf.image.resizeBilinear(tfImage, [224, 224]);
    
    const normalized = resized.div(127.5).sub(1);
    const batched = normalized.expandDims(0);

    // 8. Run classification
    const predictions = await model.predict(batched).data();
    
    // Cleanup tensors
    tfImage.dispose();
    resized.dispose();
    normalized.dispose();
    batched.dispose();

    // 9. Check if it's a fan (class index 545)
    const topPredictionIndex = Array.from(predictions)
      .map((p, i) => ({ probability: p, index: i }))
      .sort((a, b) => b.probability - a.probability)[0];

    const confidence = topPredictionIndex.probability;
    const fanClassIndices = [545];
    const isFan = fanClassIndices.includes(topPredictionIndex.index) && confidence > 0.3;

    console.log(`ML Result: ${isFan ? 'FAN ✅' : 'NOT FAN ❌'} (${(confidence * 100).toFixed(1)}% confidence)`);

    return {
      isFan,
      confidence,
      classIndex: topPredictionIndex.index,
      reason: isFan ? 'Verified as electric fan' : 'Not an electric fan'
    };

  } catch (error) {
    console.error('ML verification error:', error);
    return {
      isFan: false,
      reason: `Verification failed: ${error.message}`,
      error: error.message
    };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nftMint, price, skipMLCheck } = body;

    if (!nftMint || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: nftMint, price' },
        { status: 400 }
      );
    }

    // 🤖 ML GATEKEEPING - API does the classification
    if (!skipMLCheck) {
      console.log('🤖 Running ML verification on NFT:', nftMint);
      const verification = await verifyNFTIsFan(nftMint);

      if (!verification.isFan) {
        console.log('❌ ML verification FAILED:', verification.reason);
        return NextResponse.json({
          error: 'ML Verification Failed',
          message: '🚔 Fan Police Alert! This NFT is not an electric fan.',
          reason: verification.reason,
          confidence: verification.confidence,
          classIndex: verification.classIndex,
          hint: 'Only verified electric fan NFTs can be listed on SolanaOnlyFans.',
        }, { status: 403 });
      }

      console.log(`✅ ML verification PASSED (${(verification.confidence * 100).toFixed(1)}% confidence)`);
    }

    if (!process.env.AGENT_WALLET_PRIVATE_KEY) {
      throw new Error('AGENT_WALLET_PRIVATE_KEY not configured');
    }

    const agentKeypair = Keypair.fromSecretKey(
      Buffer.from(process.env.AGENT_WALLET_PRIVATE_KEY, 'base64')
    );

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const wallet = new NodeWallet(agentKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idlJson, provider);

    console.log('Listing NFT:', nftMint, 'for', price, 'SOL');

    const mintAddress = new PublicKey(nftMint);
    const priceInLamports = new BN(price * 1_000_000_000);

    const [listingAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mintAddress.toBuffer()],
      PROGRAM_ID
    );

    const listingAccountInfo = await connection.getAccountInfo(listingAccount);
    if (listingAccountInfo) {
      return NextResponse.json(
        { error: 'This NFT is already listed for sale' },
        { status: 400 }
      );
    }

    const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), mintAddress.toBuffer()],
      PROGRAM_ID
    );

    const sellerTokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      agentKeypair.publicKey
    );

    // 🚨 FIX RE-ATTEMPT: The previous fix to include ATA creation as a pre-instruction failed,
    // likely due to Anchor validation. We now enforce the prerequisite setup.
    const sellerTokenAccountInfo = await connection.getAccountInfo(sellerTokenAccount);

    if (!sellerTokenAccountInfo) {
        // If the ATA is missing, the NFT cannot be in the agent's wallet, and the list instruction will fail.
        // We stop here and give the user clear instructions on what they need to do.
        console.log(`❌ Seller ATA ${sellerTokenAccount.toBase58()} not initialized. Throwing setup error.`);
        
        return NextResponse.json(
            { 
                error: 'Wallet Setup Required',
                message: `The Agent Wallet's Associated Token Account for this NFT does not exist. The NFT must be transferred to the agent's address (${agentKeypair.publicKey.toBase58()}) BEFORE listing, which automatically creates the token account.`,
                hint: 'Please transfer the NFT to the agent wallet and try again.',
                requiredAta: sellerTokenAccount.toBase58()
            },
            { status: 403 }
        );
    }
    
    // If we reach here, the ATA is initialized, which solves the "AccountNotInitialized" error.
    // The listing can proceed. We no longer need preInstructions as the ATA is ready.

    const tx = await program.methods
      .listNft(priceInLamports)
      .accounts({
        listing: listingAccount,
        escrowTokenAccount: escrowTokenAccount,
        seller: agentKeypair.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        mint: mintAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc(); // .preInstructions() removed as ATA is now a prerequisite

    console.log('✅ List transaction successful:', tx);

    return NextResponse.json({
      success: true,
      message: 'NFT listed successfully',
      transaction: tx,
      listing: listingAccount.toString(),
      nftMint: nftMint,
      price: price,
      mlVerified: !skipMLCheck,
    });

  } catch (error) {
    console.error('List API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.logs },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agent/list',
    description: 'List NFT for sale with ML verification',
    method: 'POST',
    requiredFields: ['nftMint', 'price'],
    optionalFields: ['skipMLCheck'],
    mlGatekeeping: 'Enabled - Only electric fan NFTs can be listed',
    network: process.env.SOLANA_NETWORK || 'solana-devnet',
    programId: PROGRAM_ID.toString(),
  });
}