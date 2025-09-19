"use client";
import { useCallback, useMemo, useState } from "react";
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
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/web3.js";

// Correct Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8UQs7LsrC');

export default function Home() {
  const wallet = useWallet();
  const connection = useMemo(() => getConnection(), []);
  const { program } = useProgram();

  const [selectedFile, setSelectedFile] = useState(null);
  const [name, setName] = useState("My NFT");
  const [description, setDescription] = useState("Minted via my Solana dApp");
  const [royaltiesBps, setRoyaltiesBps] = useState(500); // 5%
  const [price, setPrice] = useState("0.1"); // SOL
  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showListing, setShowListing] = useState(false);

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
      setShowListing(true); // Show listing section after successful mint
      
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
        <DropzonePreview onFileSelected={setSelectedFile} />
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