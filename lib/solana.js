import { Connection } from "@solana/web3.js";

export function getRpcEndpoint() {
  if (typeof process !== "undefined") {
    return process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
  }
  return "https://api.devnet.solana.com";
}

export function getConnection() {
  return new Connection(getRpcEndpoint());
}
