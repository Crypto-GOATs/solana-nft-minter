"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import idlJson from "../target/idl/solana_marketplace.json";
console.log("Program IDL:", idlJson);
const ProgramContext = createContext(null);

export const ProgramProvider = ({ children }) => {
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const wallet = useWallet();

  useEffect(() => {
    // Only initialize the program when the wallet is connected
    if (!wallet.connected || !wallet.publicKey) {
      setProgram(null);
      return;
    }

    const initProgram = async () => {    
      try {
        setError(null);
        
        
        const programId = new PublicKey("8HFHKEB2m6QF6e8VW6iWzgh1xLmfvrPMJXsAzsLHkj9w");
        
        // Use the devnet cluster
        const connection = new Connection("https://api.devnet.solana.com", "confirmed");
        
        // Use the wallet object provided by the wallet adapter
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });


        console.log('=== Initialization Debug ===');
        console.log('1. IDL check:', !!idlJson);
        console.log('2. Program ID check:', programId?.toString());
        console.log('3. Provider check:', !!provider);
        console.log('4. Provider connection:', !!provider?.connection);
        console.log('5. Provider wallet:', !!provider?.wallet);
        
        // Try to isolate the issue
        console.log('6. Creating PublicKey...');
        const pubkey = new PublicKey(idlJson.address);
        console.log('   ✓ PublicKey created:', pubkey.toString());
        
        console.log('7. Creating Program instance...');
        const programClient = new Program(idlJson, provider);
        console.log('   ✓ Program instance created');
        
        console.log('8. Setting program state...');
        setProgram(programClient);
        console.log("✅ Program initialized successfully!");
        
        setProgram(programClient);
        console.log("✅ Program initialized successfully!");
      } catch (err) {
        console.error("❌ Failed to initialize program:", err);
        setError(err.message);
        setProgram(null);
      }
    };

    initProgram();
  }, [wallet.connected, wallet.publicKey]);

  return (
    <ProgramContext.Provider value={{ program, error }}>
      {children}
    </ProgramContext.Provider>
  );
};

export const useProgram = () => {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error('useProgram must be used within ProgramProvider');
  }
  return context;
};