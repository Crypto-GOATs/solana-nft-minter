"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useMetaplex } from "@/contexts/MetaplexContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { sol } from "@metaplex-foundation/js";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';


export default function MyNfts() {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { metaplex, auctionHouseAddress } = useMetaplex();

  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [listingData, setListingData] = useState({});

  function resolveUri(uri) {
    if (!uri) return null;
    if (uri.startsWith("ipfs://")) {
      return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
    }
    return uri;
  }

  // Fetch NFTs and listing info
  useEffect(() => {
    if (!publicKey || !metaplex || !auctionHouseAddress) return;

    async function fetchNFTs() {
      setLoading(true);
      try {
        const nftList = await metaplex
          .nfts()
          .findAllByOwner({ owner: new PublicKey(publicKey) });

        const auctionHouse = await metaplex
          .auctionHouse()
          .findByAddress({ address: auctionHouseAddress });

        const loaded = await Promise.all(
          nftList.map(async (nft) => {
            try {
              const fullNft = await metaplex.nfts().load({ metadata: nft });
              const metadataRes = await fetch(resolveUri(fullNft.uri));
              const metadata = await metadataRes.json();

              // check if it's already listed
              const lazyListings = await metaplex.auctionHouse().findListings({
                auctionHouse,
                mint: fullNft.mint.address,
                status: "active",
              });

              if (lazyListings.length > 0) {
                try {
                  const listing = await metaplex
                    .auctionHouse()
                    .loadListing({ lazyListing: lazyListings[0] });

                  const bids = await metaplex.auctionHouse().findBids({
                    auctionHouse,
                    mint: fullNft.mint.address,
                  });

                  const highestBid = bids.length
                    ? Math.max(
                        ...bids.map(
                          (b) => b.price.basisPoints.toNumber() / 1e9
                        )
                      )
                    : 0;

                  setListingData((prev) => ({
                    ...prev,
                    [fullNft.mint.address.toBase58()]: {
                      listing,
                      highestBid,
                    },
                  }));
                } catch (err) {
                  console.warn("Skipping invalid listing", lazyListings[0], err);
                }
              }

              return {
                mint: fullNft.mint.address.toBase58(),
                name: metadata.name,
                description: metadata.description,
                image: resolveUri(metadata.image),
              };
            } catch (err) {
              console.error("Error loading NFT:", err);
              return null;
            }
          })
        );

        setNfts(loaded.filter(Boolean));
      } catch (err) {
        console.error("Error fetching NFTs:", err);
      }
      setLoading(false);
    }

    fetchNFTs();
  }, [publicKey, metaplex, auctionHouseAddress]);

  async function handleListForSale(nft) {
    if (!publicKey) return alert("Connect your wallet first!");
    const { price } = formData[nft.mint] || {};
    if (!price || isNaN(price) || price <= 0) {
      return alert("Enter a valid price in SOL");
    }

    try {
      const auctionHouse = await metaplex
        .auctionHouse()
        .findByAddress({ address: auctionHouseAddress });

      await metaplex.auctionHouse().list({
        auctionHouse,
        mintAccount: new PublicKey(nft.mint),
        price: sol(price),
      });

      alert(`NFT listed for ${price} SOL.`);
      window.location.reload();
    } catch (err) {
      console.error("Error listing NFT:", err);
      alert("Failed to list NFT.");
    }
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h1> My NFTs</h1>
      <WalletMultiButton />
      </div>
      {loading && (
        <p className="text-center text-gray-400 animate-pulse">
          Loading NFTs...
        </p>
      )}
      {!loading && nfts.length === 0 && (
        <p className="text-center text-gray-400 text-lg">No NFTs found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {nfts.map((nft) => {
          const listing = listingData[nft.mint];

          return (
            <div key={nft.mint} className="card flex flex-col items-center p-4">
              {nft.image ? (
                <img src={nft.image} alt={nft.name} className="nft-image" />
              ) : (
                <div className="w-full h-40 bg-gray-800 flex items-center justify-center rounded-lg">
                  <span className="text-gray-400 text-sm">No Image</span>
                </div>
              )}
              <h3 className="mt-3 font-semibold text-center">{nft.name}</h3>
              <p className="text-gray-400 text-sm text-center">
                {nft.description}
              </p>

              {listing ? (
                <>
                  <p className="text-gray-400 mt-2 text-center">
                    Ask Price:{" "}
                    {(
                      listing.listing.price.basisPoints.toNumber() / 1e9
                    ).toFixed(2)}{" "}
                    SOL
                  </p>
                  <button
                    className="button mt-3 w-full bg-gray-600 cursor-not-allowed"
                    disabled
                  >
                    Already Listed
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Price (SOL)"
                    className="input mt-2"
                    value={formData[nft.mint]?.price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [nft.mint]: {
                          ...formData[nft.mint],
                          price: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <button
                    className="button mt-3 w-full"
                    onClick={() => handleListForSale(nft)}
                  >
                    List for Sale
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
