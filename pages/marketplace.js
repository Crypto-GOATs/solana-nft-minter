"use client";

import { useEffect, useState } from "react";
import { useMetaplex } from "@/contexts/MetaplexContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';


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
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch active listings
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

        // Hydrate all listings + fetch metadata
        const listingsWithNfts = await Promise.all(
          lazyListings.map(async (lazyListing) => {
            try {
              const fullListing = await metaplex
                .auctionHouse()
                .loadListing({ lazyListing });

              const nft = await metaplex
                .nfts()
                .findByMetadata({ metadata: fullListing.metadataAddress });

              const metadataRes = await fetch(resolveUri(nft.uri));
              const metadata = await metadataRes.json();

              return {
                listing: fullListing, // hydrated listing
                nft,
                image: metadata.image,
              };
            } catch (e) {
              console.warn("Failed to load listing", lazyListing, e);
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

  // Handle Buy
  const handleBuyNow = async (listing) => {
    if (!publicKey) return alert("Connect your wallet first!");

    setStatus("⏳ Processing purchase...");
    try {
      const auctionHouse = await metaplex
        .auctionHouse()
        .findByAddress({ address: auctionHouseAddress });

      const { purchase } = await metaplex.auctionHouse().buy({
        auctionHouse,
        listing: listing.listing, // ✅ already hydrated
      });

      setStatus(`✅ Successfully purchased: ${listing.nft.name}`);
      console.log("Purchase result:", purchase);
    } catch (e) {
      console.error("Failed to buy:", e);
      setStatus("❌ Failed: " + e.message);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h1> Marketplace</h1>
      <WalletMultiButton />
      </div>
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
            <div
              key={listing.nft.mint.address.toString()}
              className="card flex flex-col items-center p-4"
            >
              <img
                src={resolveUri(listing.image)}
                alt={listing.nft.name}
                className="nft-image"
              />
              <h3 className="mt-3 font-semibold text-center">
                {listing.nft.name}
              </h3>
              <p className="text-gray-400 text-sm mt-1 text-center">
                Price:{" "}
                {listing.listing.price.basisPoints.toNumber() / 1e9} SOL
              </p>

              <button
                className="button mt-3 w-full"
                onClick={() => handleBuyNow(listing)}
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      )}

      {status && <p className="mt-6 text-center tag">{status}</p>}
    </div>
  );
}
