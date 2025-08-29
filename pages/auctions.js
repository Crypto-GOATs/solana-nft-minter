// pages/auctions.js
import { useEffect, useState } from "react";

export default function Auctions() {
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    async function fetchAuctions() {
      // Replace with your backend fetching auctions
      const res = await fetch("/api/auctions"); // you will create this API
      const data = await res.json();
      setAuctions(data);
    }
    fetchAuctions();
  }, []);

  async function handleBid(auctionId) {
    const bidAmount = prompt("Enter your bid (in SOL)");
    if (!bidAmount) return;

    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidAmount }),
      });
      const data = await res.json();
      alert("Bid placed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Failed to place bid: " + err.message);
    }
  }

  return (
    <div>
      <h1>All Auctions</h1>
      <ul>
        {auctions.map(auction => (
          <li key={auction.id}>
            NFT: {auction.nftMint} - Min Bid: {auction.minBid} SOL{" "}
            <button onClick={() => handleBid(auction.id)}>Place Bid</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
