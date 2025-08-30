import { useCallback, useMemo, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { getConnection } from '@/lib/solana';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import DropzonePreview from '@/components/DropzonePreview';



export default function Home() {
  const wallet = useWallet();
  const connection = useMemo(() => getConnection(), []);

  const [selectedFile, setSelectedFile] = useState(null);
  const [name, setName] = useState('My NFT');
  const [description, setDescription] = useState('Minted via my Solana dApp');
  const [royaltiesBps, setRoyaltiesBps] = useState(500); // 5%
  const [status, setStatus] = useState('');
  const [mintAddress, setMintAddress] = useState(null);
  const [busy, setBusy] = useState(false);

  // Call backend to upload to NFT.storage safely
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
  if (res.ok) {
    console.log("✅ Uploaded:", data.url);
    return data.url; // IPFS metadata URL
  } else {
    console.error("❌ Upload failed:", data.error);
    throw new Error(data.error);
  }
}, [selectedFile, name, description]);

const handleMint = useCallback(async () => {
  try {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Connect your wallet first.');
      return;
    }
    if (!selectedFile) {
      alert('Please select a file to mint.');
      return;
    }

    setBusy(true);
    setStatus('Uploading to IPFS...');
    const uri = await uploadToIPFS();

    setStatus('Minting on Solana via Metaplex...');
    const umi = createUmi(connection)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());

    const mint = generateSigner(umi);

    await createNft(umi, {
      mint,
      authority: umi.identity,
      name,
      uri,
      sellerFeeBasisPoints: royaltiesBps, // bps directly
    }).sendAndConfirm(umi);

    setMintAddress(mint.publicKey.toString());
    setStatus('✅ Success!');
  } catch (e) {
    console.error(e);
    setStatus(e.message || 'Mint failed');
  } finally {
    setBusy(false);
  }
}, [wallet, selectedFile, name, royaltiesBps, connection, uploadToIPFS]);


  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1>Solana NFT Minter</h1>
        <WalletMultiButton />
      </div>

      <div className="card">
        <h2>1. Upload your file</h2>
        <DropzonePreview onFileSelected={setSelectedFile} />
        <p className="small">Tip: Use Devnet while testing. You need some SOL to pay mint fees.</p>

        <hr />

        <h2>2. Metadata</h2>
        <div className="row">
          <div style={{ flex: 1, minWidth: 260 }}>
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My NFT" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Royalties (bps)</label>
            <input
              className="input"
              type="number"
              value={royaltiesBps}
              onChange={(e) => setRoyaltiesBps(e.target.value)}
              min="0"
              max="10000"
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
        <button className="button" disabled={busy} onClick={handleMint}>
          {busy ? 'Minting...' : 'Mint NFT'}
        </button>

        <div style={{ marginTop: 16 }}>
          <p>Status: <span className="tag">{status || 'Idle'}</span></p>
          {mintAddress && (
            <p>
              Mint Address:&nbsp;
              <code>{mintAddress}</code>
            </p>
          )}
        </div>
      </div>

      <p className="footer">
        Built with Metaplex Umi, Wallet Adapter, and NFT.storage (server-side).
      </p>
    </div>
  );
}
