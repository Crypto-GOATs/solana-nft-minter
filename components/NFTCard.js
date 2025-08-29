export default function NFTCard({ nft, onSell, onBid }) {
  const handleSell = () => {
    const price = prompt("Enter minimum bid (SOL):");
    if (price) onSell(nft, parseFloat(price));
  };

  const handleBid = () => {
    const price = prompt("Enter your bid (SOL):");
    if (price) onBid(nft, parseFloat(price));
  };

  return (
    <div className="nft-card">
      <img src={nft.metadata?.uri} alt={nft.name} />
      <h3>{nft.name}</h3>
      <p>{nft.description}</p>
      {onSell && <button onClick={handleSell}>List for Auction</button>}
      {onBid && <button onClick={handleBid}>Place Bid</button>}
    </div>
  );
}
