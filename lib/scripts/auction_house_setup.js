import { Metaplex, WRAPPED_SOL_MINT, keypairIdentity } from "@metaplex-foundation/js";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import fs from "fs";

// 1. Load your wallet
const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync("/Users/tommasolunardon/.config/solana/id.json", "utf8"))
);
const wallet = Keypair.fromSecretKey(secretKey);

// 2. Connect to Devnet
const connection = new Connection(clusterApiUrl("devnet"));
const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));

// 3. Create the Auction House
const existingAH = await metaplex
  .auctionHouse()
  .findByCreatorAndMint({ creator: wallet.publicKey, treasuryMint: WRAPPED_SOL_MINT })
if(!existingAH){
(async () => {
  const auctionHouse = await metaplex
    .auctionHouse()
    .create({
      sellerFeeBasisPoints: 500, // 5% fee
      canChangeSalePrice: false, // you control price changes
      requiresSignOff: false, // no additional approvals needed
      hasAuctioneer: false, // optional, leave false for now
    });

  console.log("✅ Auction House created at:", auctionHouse.address.toString());

})();} else {
  console.log("✅ Auction House already exists at:", existingAH.address.toString());

}
