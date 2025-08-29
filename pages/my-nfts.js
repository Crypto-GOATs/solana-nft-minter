"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useMetaplex } from "@/contexts/MetaplexContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { toBigNumber } from "@metaplex-foundation/js";

export default function MyNfts() {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { metaplex, auctionHouseAddress } = useMetaplex();

  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({}); 
  const [auctionData, setAuctionData] = useState({}); 
  const [currentTime, setCurrentTime] = useState(Date.now());

  function resolveUri(uri) {
    if (!uri) return null;
    if (uri.startsWith("ipfs://")) {
      return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
    }
    return uri;
  }

  // Live clock for countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch NFTs and auction info
  useEffect(() => {
    if (!publicKey || !metaplex || !auctionHouseAddress) return;

    async function fetchNFTs() {
      setLoading(true);
      try {
        const nftList = await metaplex.nfts().findAllByOwner({ owner: new PublicKey(publicKey) });
        const auctionHouse = await metaplex.auctionHouse().findByAddress({
          address: auctionHouseAddress,
        });

        const loaded = await Promise.all(
          nftList.map(async (nft) => {
            try {
              const fullNft = await metaplex.nfts().load({ metadata: nft });
              const metadataRes = await fetch(resolveUri(fullNft.uri));
              const metadata = await metadataRes.json();

              const listings = await metaplex.auctionHouse().findListings({
                auctionHouse,
                mint: fullNft.mint.address,
                status: "active",
              });

              if (listings.length > 0) {
                const listing = listings[0];
                const bids = await metaplex.auctionHouse().findBids({
                  auctionHouse,
                  mint: fullNft.mint.address,
                });
                const highestBid = bids.length
                  ? Math.max(...bids.map((b) => b.price.basisPoints.toNumber() / 1e9))
                  : 0;

                const endDate = listing.endsAt
                  ? new Date(listing.endsAt.toNumber() * 1000) // ✅ convert seconds to ms
                  : null;


                setAuctionData((prev) => ({
                  ...prev,
                  [fullNft.mint.address.toBase58()]: {
                    listing,
                    highestBid,
                    endDate,
                  },
                }));
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

  async function handleListForAuction(nft) {
    if (!publicKey) return alert("Connect your wallet first!");
    const { price, duration } = formData[nft.mint] || {};
    if (!price || isNaN(price) || price <= 0) return alert("Enter a valid minimum bid price in SOL");
    if (!duration || isNaN(duration) || duration <= 0) return alert("Enter a valid duration (in days)");

    try {
      const auctionHouse = await metaplex.auctionHouse().findByAddress({ address: auctionHouseAddress });
      const priceBn = toBigNumber(price * 1_000_000_000); // lamports
      await metaplex.auctionHouse().list({
        auctionHouse,
        mintAccount: new PublicKey(nft.mint),
        price: priceBn,
      });
      alert(`NFT listed for auction at ${price} SOL for ${duration} day(s).`);
      window.location.reload();
    } catch (err) {
      console.error("Error listing NFT:", err);
      alert("Failed to list NFT for auction.");
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return "Ended";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="container">
      <h1 className="text-4xl font-extrabold mb-8 text-center">My NFTs</h1>

      {loading && <p className="text-center text-gray-400 animate-pulse">Loading NFTs...</p>}
      {!loading && nfts.length === 0 && <p className="text-center text-gray-400 text-lg">No NFTs found.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {nfts.map((nft) => {
          const auction = auctionData[nft.mint];
          const remainingTime = auction?.endDate ? auction.endDate.getTime() - currentTime : null;

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
              <p className="text-gray-400 text-sm text-center">{nft.description}</p>

              {auction ? (
                <>
                  <p className="text-gray-400 mt-2 text-center">
                    Seller’s Ask: {(auction.listing.price.basisPoints.toNumber() / 1e9).toFixed(2)} SOL
                  </p>
                  <p className="text-gray-400 text-center">
                    Highest Bid: {auction.highestBid.toFixed(2)} SOL
                  </p>
                  <p className="text-gray-200 font-semibold mt-1 text-center">
                    Remaining Time: {formatTime(remainingTime)}
                  </p>
                  <button className="button mt-3 w-full bg-gray-600 cursor-not-allowed" disabled>
                    Already on Auction
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Min bid (SOL)"
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
                  <input
                    type="number"
                    min="1"
                    placeholder="Duration (days)"
                    className="input mt-2"
                    value={formData[nft.mint]?.duration || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [nft.mint]: {
                          ...formData[nft.mint],
                          duration: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <button
                    className="button mt-3 w-full"
                    onClick={() => handleListForAuction(nft)}
                  >
                    Put up for Auction
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
