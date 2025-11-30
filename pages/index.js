"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import Head from 'next/head'; // <--- 1. IMPORT HEAD
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
  const [name, setName] = useState("My fan");
  const [description, setDescription] = useState("My fan is cooler than Elon's");
  const [royaltiesBps, setRoyaltiesBps] = useState(500); // 5%
  const [price, setPrice] = useState("0.1"); // SOL
  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState(null);
  const [imageUrlForOG, setImageUrlForOG] = useState(null); // <--- 2. NEW STATE VARIABLE
  const [busy, setBusy] = useState(false);
  const [showListing, setShowListing] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);
  const [isValidFan, setIsValidFan] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isListed, setIsListed] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

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
          const preprocessed = preprocessImage(img);
          const predictions = await modelRef.current.predict(preprocessed).data();
          
          const topPredictionIndex = Array.from(predictions)
            .map((p, i) => ({ probability: p, index: i }))
            .sort((a, b) => b.probability - a.probability)[0];

          const confidence = topPredictionIndex.probability;
          const fanClassIndices = [545];
          const isFan = fanClassIndices.includes(topPredictionIndex.index) && confidence > 0.3;
          
          const result = {
            isFan,
            confidence: confidence,
            className: isFan ? 'Electric Fan' : 'Not a Fan',
            topIndex: topPredictionIndex.index
          };
          
          setClassificationResult(result);
          setIsValidFan(isFan);
          preprocessed.dispose();
          resolve(result);
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

  const setFile = useCallback(async (file) => {
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsValidFan(false);
      setClassificationResult(null);
      setStatus("No file selected");
      return;
    }

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
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      if (modelLoaded) {
        const result = await classifyImage(file);
        
        if (result.isFan && !result.error) {
          setSelectedFile(file);
          setStatus("✅ Fan detected! Let's cool it up");
        } else {
          setStatus("❌ Bro that's not a fan! You can't get past the fan police🚔");
        }
      } else {
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
    
    // --- 3. MODIFICATION: Return both URI and a mock public Image URL (update your API to return the real one)
    const metadataUri = data.url;
    // Assuming your API returns the direct, public image URL as 'imageUrl'
    // FALLBACK: If your API only returns the metadata URI, you need to parse it 
    // to get the actual image link from the metadata file and ensure it's a direct link.
    const directImageUrl = data.imageUrl || "https://solana-only-fans.vercel.app/og-fallback-image.png"; // Use a fallback or parse the URI
    
    return { uri: metadataUri, imageUrl: directImageUrl };
    // --- END MODIFICATION ---
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
      
      // --- 4. MODIFICATION: Capture the image URL
      const { uri, imageUrl } = await uploadToIPFS();
      setImageUrlForOG(imageUrl); // Set the URL for the OG tags
      // --- END MODIFICATION ---

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
      setStatus("✅ OnlyFan content generated Successfully!");
      setShowListing(true);
      
    } catch (e) {
      console.error(e);
      setStatus(e.message || "OnlyFan content generation failed");
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

        const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), mintPublicKey.toBuffer()],
            program.programId
        );

        const sellerTokenAccount = getAssociatedTokenAddressSync(
            mintPublicKey,
            wallet.publicKey
        );
        const [listingAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("listing"), mintPublicKey.toBuffer()],
            program.programId
        );

        setStatus("Sending transaction...");

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
        setIsListed(true);
        setShowShareOptions(true);
        alert("Your NFT has been listed for sale!");

    } catch (e) {
        console.error("Error listing NFT:", e);
        setStatus(`Listing failed: ${e.message}`);
        alert(`Failed to list NFT: ${e.message}`);
    } finally {
        setBusy(false);
    }
}, [program, wallet, mintAddress, price, connection]);

  // X (Twitter) sharing functions
  const generateShareText = useCallback(() => {
    const baseText = `Just minted and listed my ${name} NFT on OnlyFansSolana! 🪭✨\n\n`;
    const priceText = isListed ? `💰 Price: ${price} SOL\n` : '';
    const aiText = isValidFan ? '🤖 AI-Verified Electric Fan\n' : '';
    const hashtags = '#OnlyFansSolana $SOF #Fan #CryptoArt #Web3';
    const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
    
    return `${baseText}${priceText}${aiText}\n${hashtags}\n\nCheck it out: ${websiteUrl}`;
  }, [name, price, isListed, isValidFan]);

  const shareToX = useCallback(() => {
    const text = generateShareText();
    const encodedText = encodeURIComponent(text);
    
    // --- 6. MODIFICATION: Include the `url` parameter for X to crawl the page
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    // --- END MODIFICATION ---
    
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }, [generateShareText]);


  return (
    <>
      {/* --- 5. ADDED HEAD COMPONENT FOR DYNAMIC OG TAGS --- */}
      <Head>
        {/* Dynamic Open Graph tags for X sharing */}
        {mintAddress && imageUrlForOG && (
          <>
            <meta property="og:title" content={`Check out my new NFT: ${name}!`} />
            <meta property="og:description" content={`${description} | Price: ${price} SOL on OnlyFansSolana. AI-verified!`} />
            <meta property="og:image" content={imageUrlForOG} />
            
            {/* X-specific (Twitter Card) tags - summary_large_image is best for images */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={`Just minted: ${name} NFT on OnlyFansSolana 🪭`} />
            <meta name="twitter:description" content={`Price: ${price} SOL. ${description}`} />
            <meta name="twitter:image" content={imageUrlForOG} />
            {/* <meta name="twitter:site" content="@your_x_handle" /> Optional: your X handle */}
          </>
        )}
      </Head>
      {/* -------------------------------------------------- */}
    
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Animated OnlyFans Logo */}
            <div style={{ width: "60px", height: "40px" }}>
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
                </g>
                
                <rect x="10" y="10" width="30" height="15" rx="7" fill="#1e293b" opacity="0.9"/>
                <text x="25" y="21" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" 
                      textAnchor="middle" fill="#14F195">NFT</text>
              </svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", background: "linear-gradient(45deg, #9945FF, #14F195)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                OnlyFansSolana
              </h1>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                AI-Verified Electric Fan Marketplace
              </p>
            </div>
          </div>
          <WalletMultiButton />
        </div>

        <div className="card">
          <h2>1. Upload your fan picture</h2>
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
                  <p style={{ margin: '0 0 4px 0', color: isValidFan ? '#16a34a' : '#dc2626'  }}>
                    <strong>Classification:</strong> {classificationResult.className}
                  </p>
                </>
              )}
            </div>
          )}
          
          <hr />

          <h2>2. Fan info</h2>
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

          <h2>3. Generate your fan</h2>
          <button 
            className="button" 
            disabled={busy || !selectedFile} 
            onClick={handleMint}
          >
            {busy ? "Generating..." : "Generate fan"}
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

          {/* Share to Social Media Section */}
          {showShareOptions && mintAddress && (
            <>
              <hr />
              <h2>5. Share Your Creation</h2>
              <div style={{ 
                background: 'linear-gradient(135deg, #1da1f2 0%, #0d8bd9 100%)', 
                padding: '16px', 
                borderRadius: '12px',
                marginBottom: '16px'
              }}>
                <h3 style={{ color: 'white', margin: '0 0 12px 0', fontSize: '18px' }}>
                  🎉 Share your new NFT with the world!
                </h3>
                <p style={{ color: 'white', margin: '0 0 16px 0', fontSize: '14px', opacity: 0.9 }}>
                  Let everyone know about your awesome {name} NFT {isListed && `listed for ${price} SOL`}
                </p>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    className="button"
                    onClick={shareToX}
                    style={{ 
                      backgroundColor: '#000000',
                      color: 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Share on X
                  </button>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <p>Status: <span className="tag">{status || "Idle"}</span></p>
            {mintAddress && (
              <div>
                <p>Fan Address: <code>{mintAddress}</code></p>
                {!showListing && !isListed && (
                  <button 
                    className="button" 
                    onClick={() => setShowListing(true)}
                    style={{ backgroundColor: '#10b981', marginTop: 8 }}
                  >
                    List This fan for Sale
                  </button>
                )}
                {mintAddress && !showShareOptions && (
                  <button 
                    className="button" 
                    onClick={() => setShowShareOptions(true)}
                    style={{ backgroundColor: '#1da1f2', marginTop: 8, marginLeft: 8 }}
                  >
                    Share This NFT
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}