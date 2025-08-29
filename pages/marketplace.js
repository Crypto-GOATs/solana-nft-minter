"use client";

import { useEffect, useState } from "react";
import { useMetaplex } from "@/contexts/MetaplexContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { sol } from "@metaplex-foundation/js";

function resolveUri(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

export default function MarketplacePage() {
  const { metaplex, auctionHouseAddress } = useMetaplex();
  const { publicKey } = useWallet();

  const [listings, setListings] = useState([]);
  const [bidAmounts, setBidAmounts] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!metaplex || !auctionHouseAddress) return;

    async function fetchListings() {
      setLoading(true);
      try {
        const auctionHouse = await metaplex
          .auctionHouse()
          .findByAddress({ address: auctionHouseAddress });

        const lazyListings = await metaplex
          .auctionHouse()
          .findListings({ auctionHouse, status: "active" });

        const listingsWithNfts = await Promise.all(
          lazyListings.map(async (lazyListing) => {
            try {
              const nft = await metaplex
                .nfts()
                .findByMetadata({ metadata: lazyListing.metadataAddress });

              const metadataRes = await fetch(resolveUri(nft.uri));
              const metadata = await metadataRes.json();

              const bids = await metaplex.auctionHouse().findBids({
                auctionHouse,
                mint: nft.mint.address,
              });

              const highestBid = bids.length
                ? Math.max(...bids.map((b) => b.price.basisPoints.toNumber() / 1e9))
                : 0;

              const minAcceptableBid = Math.max(
                lazyListing.price.basisPoints.toNumber() / 1e9,
                highestBid
              );

              return {
                lazyListing,
                nft,
                image: metadata.image,
                highestBid,
                minAcceptableBid,
              };
            } catch (e) {
              console.warn("Failed to load NFT for listing", lazyListing, e);
              return null;
            }
          })
        );

        setListings(listingsWithNfts.filter(Boolean));
      } catch (e) {
        console.error("Error fetching listings:", e);
      }
      setLoading(false);
    }

    fetchListings();
  }, [metaplex, auctionHouseAddress]);

  const handlePlaceBid = async (listing) => {
    if (!publicKey) return alert("Connect your wallet first!");

    const bidAmount = parseFloat(
      bidAmounts[listing.nft.mint.address.toString()]
    );

    if (!bidAmount || isNaN(bidAmount)) {
      return alert("Enter a valid bid amount");
    }
    if (bidAmount <= listing.minAcceptableBid) {
      return alert(`Bid must be higher than ${listing.minAcceptableBid} SOL`);
    }

    setStatus("⏳ Placing bid...");
    try {
      const auctionHouse = await metaplex
        .auctionHouse()
        .findByAddress({ address: auctionHouseAddress });

      const builder = await metaplex
        .auctionHouse()
        .builders()
        .bid({
          auctionHouse,
          mintAccount: listing.nft.mint.address,
          price: sol(bidAmount),
        });

      await metaplex.rpc().sendAndConfirmTransaction(builder);

      setStatus(`✅ Bid placed: ${bidAmount} SOL`);
    } catch (e) {
      console.error("Failed to place bid:", e);
      setStatus("❌ Failed: " + e.message);
    }
  };

  return (
    <div className="container">
      <h1 className="text-4xl font-extrabold mb-8 text-center">
        Marketplace
      </h1>

      {loading ? (
        <p className="text-center text-gray-400 animate-pulse">
          Loading active listings...
        </p>
      ) : listings.length === 0 ? (
        <p className="text-center text-gray-400 text-lg">
          No active listings found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <div key={listing.nft.mint.address.toString()} className="card flex flex-col items-center p-4">
              <img
                src={resolveUri(listing.image)}
                alt={listing.nft.name}
                className="nft-image"
              />
              <h3 className="mt-3 font-semibold text-center">{listing.nft.name}</h3>
              <p className="text-gray-400 text-sm mt-1 text-center">
                Seller’s Min: {listing.lazyListing.price.basisPoints.toNumber() / 1e9} SOL
              </p>
              <p className="text-gray-400 text-sm text-center">
                Highest Bid: {listing.highestBid || "—"} SOL
              </p>
              <p className="text-gray-200 font-semibold text-center">
                Min Next Bid: {listing.minAcceptableBid + 0.01} SOL
              </p>

              <input
                type="number"
                step="0.01"
                min={listing.minAcceptableBid + 0.01}
                placeholder={`> ${listing.minAcceptableBid} SOL`}
                value={bidAmounts[listing.nft.mint.address.toString()] || ""}
                onChange={(e) =>
                  setBidAmounts({
                    ...bidAmounts,
                    [listing.nft.mint.address.toString()]: e.target.value,
                  })
                }
                className="input"
              />

              <button
                className="button mt-3 w-full"
                onClick={() => handlePlaceBid(listing)}
              >
                Place Bid
              </button>
            </div>
          ))}
        </div>
      )}

      {status && <p className="mt-6 text-center tag">{status}</p>}
    </div>
  );
}
