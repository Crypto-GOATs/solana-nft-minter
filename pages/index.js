"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import DropzonePreview from "@/components/DropzonePreview";
import { getConnection } from "@/lib/solana";
import { useProgram } from "@/contexts/ProgramProvider";
import * as anchor from "@coral-xyz/anchor";
import * as tf from '@tensorflow/tfjs';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/web3.js";

// Correct Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8UQs7LsrC');

export default function Home() {
  const wallet = useWallet();
  const connection = useMemo(() => getConnection(), []);
  const { program } = useProgram();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [name, setName] = useState("My NFT");
  const [description, setDescription] = useState("Minted via my Solana dApp");
  const [royaltiesBps, setRoyaltiesBps] = useState(500); // 5%
  const [price, setPrice] = useState("0.1"); // SOL
  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showListing, setShowListing] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);
  const [isValidFan, setIsValidFan] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const modelRef = useRef(null);

  // Load the MobileNet model for image classification
  const loadModel = useCallback(async () => {
    try {
      setStatus("Loading AI model...");
      const model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json');
      modelRef.current = model;
      setModelLoaded(true);
      setStatus("AI model loaded successfully!");
    } catch (error) {
      console.error('Error loading model:', error);
      setStatus("Failed to load AI model. Image validation disabled.");
    }
  }, []);

  // FIXED: Use useEffect instead of useState
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Clean up object URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Preprocess image for MobileNet
  const preprocessImage = useCallback((imageElement) => {
    return tf.tidy(() => {
      // Convert image to tensor
      let tensor = tf.browser.fromPixels(imageElement);
      
      // Resize to 224x224 (MobileNet input size)
      const resized = tf.image.resizeBilinear(tensor, [224, 224]);
      
      // Normalize pixel values to [-1, 1] (MobileNet expects this range)
      const normalized = resized.div(127.5).sub(1);
      
      // Add batch dimension
      const batched = normalized.expandDims(0);
      
      return batched;
    });
  }, []);

  // FIXED: Return the classification result instead of just boolean
  const classifyImage = useCallback(async (file) => {
    if (!modelRef.current) {
      const errorResult = { error: "Model not loaded", isFan: false };
      setClassificationResult(errorResult);
      return errorResult;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Preprocess the image
          const preprocessed = preprocessImage(img);
          
          // Make prediction
          const predictions = await modelRef.current.predict(preprocessed).data();
          
          // Get top prediction
          const topPredictionIndex = Array.from(predictions)
            .map((p, i) => ({ probability: p, index: i }))
            .sort((a, b) => b.probability - a.probability)[0];

          console.log('Top prediction:', topPredictionIndex);

          const confidence = topPredictionIndex.probability;
          
          // Check if it's a fan (ImageNet class 545)
          const fanClassIndices = [545];
          const isFan = fanClassIndices.includes(topPredictionIndex.index) && confidence > 0.3;
          
          console.log(`Is fan: ${isFan} (class index: ${topPredictionIndex.index}, confidence: ${confidence})`);
          
          const result = {
            isFan,
            confidence: confidence,
            className: isFan ? 'Electric Fan' : 'Not a Fan',
            topIndex: topPredictionIndex.index
          };
          
          setClassificationResult(result);
          setIsValidFan(isFan);
          
          // Clean up tensors
          preprocessed.dispose();
          
          resolve(result); // Return the full result
        } catch (error) {
          console.error('Classification error:', error);
          const errorResult = { error: error.message, isFan: false };
          setClassificationResult(errorResult);
          resolve(errorResult);
        }
      };
      img.src = URL.createObjectURL(file);
    });
  }, [preprocessImage]);

  // FIXED: Add validation for file parameter
  const setFile = useCallback(async (file) => {
    // Handle file removal case
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsValidFan(false);
      setClassificationResult(null);
      setStatus("No file selected");
      return;
    }

    // Validate that it's actually a File object
    if (!(file instanceof File) && !(file instanceof Blob)) {
      console.error('Invalid file object:', file);
      setStatus("Invalid file. Please select a valid image file.");
      return;
    }

    setBusy(true);
    try {
      setStatus("Processing image...");
      setSelectedFile(null);
      setIsValidFan(false);
      setClassificationResult(null);
      
      // Clean up previous preview URL to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      if (modelLoaded) {
        console.log("Classifying image...");
        const result = await classifyImage(file);
        
        // Use the returned result instead of state
        if (result.isFan && !result.error) {
          setSelectedFile(file);
          setStatus("✅ Fan detected! Image approved for minting.");
        } else {
          setStatus("❌ This doesn't appear to be a fan. Please upload an image of an electric fan.");
        }
      } else {
        // If model isn't loaded, allow upload but warn
        setSelectedFile(file);
        setStatus("⚠️ AI validation unavailable. Proceeding without verification.");
        setIsValidFan(true);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setStatus("Error processing image. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [modelLoaded, classifyImage, previewUrl]);

  // Upload to your backend API → NFT.storage or Pinata
  const uploadToIPFS = useCallback(async () => {
    if (!selectedFile) throw new Error("No file selected");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append(
      "metadata",
      JSON.stringify({
        name,
        description,
        type: selectedFile.type,
      })
    );

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    console.log("✅ Uploaded:", data.url);
    return data.url; // IPFS metadata URL
  }, [selectedFile, name, description]);

  const handleMint = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Connect your wallet first.");
      return;
    }
    if (!selectedFile) {
      alert("Please select a file to mint.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Uploading to IPFS...");
      const uri = await uploadToIPFS();

      setStatus("Minting on Solana...");
      const umi = createUmi(connection)
        .use(walletAdapterIdentity(wallet))
        .use(mplTokenMetadata());

      const mint = generateSigner(umi);

      await createNft(umi, {
        mint,
        authority: umi.identity,
        name,
        uri,
        sellerFeeBasisPoints: royaltiesBps,
      }).sendAndConfirm(umi);

      setMintAddress(mint.publicKey.toString());
      setStatus("✅ NFT Minted Successfully!");
      setShowListing(true);
      
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Mint failed");
    } finally {
      setBusy(false);
    }
  }, [wallet, selectedFile, name, royaltiesBps, connection, uploadToIPFS]);

  const handleListNFT = useCallback(async () => {
    if (!program || !wallet.connected || !wallet.publicKey || !mintAddress) {
        alert("Program not loaded, wallet not connected, or no NFT to list");
        return;
    }

    try {
        setBusy(true);
        setStatus("Listing NFT for sale...");

        const mintPublicKey = new PublicKey(mintAddress);
        const priceInLamports = new anchor.BN(parseFloat(price) * 1_000_000_000);

        // Generate a new keypair for the listing account (it must be a signer)
        const listingKeypair = anchor.web3.Keypair.generate();

        // Derive the PDA for the escrow token account using the correct seeds from IDL
        // Seeds: ["escrow", mint] according to your contract
        const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), mintPublicKey.toBuffer()],
            program.programId
        );

        // Find the seller's token account for the NFT
        const sellerTokenAccount = getAssociatedTokenAddressSync(
            mintPublicKey,
            wallet.publicKey
        );
        const [listingAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("listing"), mintPublicKey.toBuffer()],
            program.programId
        );

        setStatus("Sending transaction...");
        console.log("Seller:", wallet.publicKey.toString());
        console.log("NFT Mint:", mintPublicKey.toString());
        console.log("Seller Token Account:", sellerTokenAccount.toString());
        console.log("Listing Account:", listingKeypair.publicKey.toString());
        console.log("Escrow Token Account:", escrowTokenAccount.toString());

        // Use the existing program but ensure wallet is signing
        const tx = program.methods
            .listNft(priceInLamports)
            .accounts({
                listing: listingAccount,
                escrowTokenAccount: escrowTokenAccount,
                seller: wallet.publicKey,
                sellerTokenAccount: sellerTokenAccount,
                mint: mintPublicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            });
        const signature = await tx.rpc({
                skipPreflight: false,
                commitment: 'confirmed'
            });
        console.log("Transaction signature:", signature);
        setStatus("✅ NFT Listed Successfully!");
        alert("Your NFT has been listed for sale!");
        console.log("Listing created with address:", listingKeypair.publicKey.toString());

    } catch (e) {
        console.error("Error listing NFT:", e);
        setStatus(`Listing failed: ${e.message}`);
        alert(`Failed to list NFT: ${e.message}`);
    } finally {
        setBusy(false);
    }
}, [program, wallet, mintAddress, price, connection]);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1>OnlyFun</h1>
        <WalletMultiButton />
      </div>

      <div className="card">
        <h2>1. Upload your file</h2>
        <DropzonePreview onFileSelected={setFile} />
        
        {/* Show image preview */}
        {previewUrl && (
          <div style={{ marginTop: 16 }}>
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ 
                maxWidth: '300px', 
                maxHeight: '300px', 
                borderRadius: '8px',
                border: '2px solid #e5e7eb'
              }} 
            />
          </div>
        )}
        
        {/* Show classification result */}
        {classificationResult && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            borderRadius: 8,
            backgroundColor: isValidFan ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isValidFan ? '#22c55e' : '#ef4444'}`
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: isValidFan ? '#16a34a' : '#dc2626' }}>
              AI Classification Result:
            </h4>
            {classificationResult.error ? (
              <p style={{ margin: 0, color: '#dc2626' }}>
                Error: {classificationResult.error}
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>Classification:</strong> {classificationResult.className}
                </p>
                <p style={{ margin: '0' }}>
                  <strong>Confidence:</strong> {(classificationResult.confidence * 100).toFixed(1)}%
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                  <strong>ImageNet Index:</strong> {classificationResult.topIndex}
                </p>
              </>
            )}
          </div>
        )}
        
        <hr />

        <h2>2. Metadata</h2>
        <div className="row">
          <div style={{ flex: 1, minWidth: 260 }}>
            <label>Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My NFT"
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Description</label>
          <textarea
            className="textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your NFT..."
          />
        </div>

        <hr />

        <h2>3. Mint</h2>
        <button 
          className="button" 
          disabled={busy || !selectedFile} 
          onClick={handleMint}
        >
          {busy ? "Minting..." : "Mint NFT"}
        </button>

        {/* Show listing section after successful mint */}
        {showListing && mintAddress && (
          <>
            <hr />
            <h2>4. List for Sale</h2>
            <div style={{ marginBottom: 16 }}>
              <label>Price (SOL)</label>
              <input
                className="input"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.1"
                step="0.01"
                min="0"
              />
            </div>
            <button 
              className="button" 
              disabled={busy} 
              onClick={handleListNFT}
              style={{ backgroundColor: '#10b981' }}
            >
              {busy ? "Listing..." : "List NFT for Sale"}
            </button>
            <button 
              className="button" 
              onClick={() => setShowListing(false)}
              style={{ marginLeft: 8, backgroundColor: '#6b7280' }}
            >
              Skip Listing
            </button>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <p>Status: <span className="tag">{status || "Idle"}</span></p>
          {mintAddress && (
            <div>
              <p>Mint Address: <code>{mintAddress}</code></p>
              {!showListing && (
                <button 
                  className="button" 
                  onClick={() => setShowListing(true)}
                  style={{ backgroundColor: '#10b981', marginTop: 8 }}
                >
                  List This NFT for Sale
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="footer">Built with Umi, Wallet Adapter, and your backend uploader.</p>
    </div>
  );
}