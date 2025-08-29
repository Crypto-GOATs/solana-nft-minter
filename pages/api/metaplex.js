// pages/api/metaplex.js
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Keypair, Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import fs from "fs";

let metaplex;

function initMetaplex() {
  if (!metaplex) {
    const secretKeyString = fs.readFileSync("/Users/tommasolunardon/.config/solana/id.json", "utf8"); // your local key file
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const wallet = Keypair.fromSecretKey(secretKey);

    const connection = new Connection(clusterApiUrl("devnet"));
    metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));
  }
  return metaplex;
}

export default async function handler(req, res) {
  const mx = initMetaplex();

  try {
    if (req.method === "GET") {
      // Return NFTs owned by the wallet
      const nfts = await mx.nfts().findAllByOwner({ owner: mx.identity().publicKey });
      res.status(200).json(nfts);
    } else if (req.method === "POST") {
      const { nftMintAddress, minBid, duration } = req.body;

      // Create auction logic here: using AuctionHouse module
      // Example placeholder:
      const auctionHouse = await mx.auctionHouse().create({
        sellerFeeBasisPoints: 500,
        canChangeSalePrice: false,
        hasAuctioneer: false,
      });

      res.status(200).json({ auctionHouse: auctionHouse.address.toBase58() });
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
