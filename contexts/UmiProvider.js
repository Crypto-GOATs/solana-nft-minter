"use client";

import { createContext, useContext, useMemo } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { nftStorageUploader } from "@metaplex-foundation/umi-uploader-nft-storage";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

const UmiContext = createContext();

export function UmiProvider({ children }) {
  const wallet = useWallet();

  // ✅ useMemo so umi is stable across renders
  const umi = useMemo(() => {
    const instance = createUmi(
      process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com"
    )
      .use(walletAdapterIdentity(wallet))
      .use(
        nftStorageUploader({
          token: "978602fd.9b6f879824b44fceb176b9786cae027c",
        })
      );

    return instance;
  }, [wallet]);

  const auctionHouseAddress = new PublicKey(
    "3C62M1m8hfW7xPonRsGa6Sm9cE3eVZVDKuDvPFsynUAr"
  );

  return (
    <UmiContext.Provider value={{ umi, auctionHouseAddress }}>
      {children}
    </UmiContext.Provider>
  );
}

export function useUmi() {
  return useContext(UmiContext);
}
