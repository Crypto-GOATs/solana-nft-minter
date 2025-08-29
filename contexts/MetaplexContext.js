"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { useWallet } from "@solana/wallet-adapter-react";

const MetaplexContext = createContext();

export function useMetaplex() {
  return useContext(MetaplexContext);
}

export function MetaplexProvider({ children }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [metaplex, setMetaplex] = useState(null);
  const [auctionHouseAddress, setAuctionHouseAddress] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (!connected || !publicKey) {
          setMetaplex(null);
          setReady(true); // ready, but no wallet connected
          return;
        }

        const connection = new Connection(clusterApiUrl("devnet"));
        const mx = Metaplex.make(connection).use(
          walletAdapterIdentity({ publicKey, signTransaction })
        );

        setMetaplex(mx);

        // Replace with your real Auction House address
        setAuctionHouseAddress(
          new PublicKey("3C62M1m8hfW7xPonRsGa6Sm9cE3eVZVDKuDvPFsynUAr")
        );

        setReady(true);
      } catch (err) {
        console.error("Failed to initialize Metaplex:", err);
      }
    };

    init();
  }, [publicKey, connected]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Connecting to Metaplex...</p>
      </div>
    );
  }

  return (
    <MetaplexContext.Provider value={{ metaplex, auctionHouseAddress }}>
      {children}
    </MetaplexContext.Provider>
  );
}
