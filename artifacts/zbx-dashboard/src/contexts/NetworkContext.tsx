import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setSelectedNetwork } from "@workspace/api-client-react";

export type NetworkName = "mainnet" | "testnet";

interface NetworkContextValue {
  network:    NetworkName;
  setNetwork: (n: NetworkName) => void;
  isTestnet:  boolean;
  chainId:    number;
  displayName: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  network:     "mainnet",
  setNetwork:  () => {},
  isTestnet:   false,
  chainId:     8989,
  displayName: "Mainnet",
});

const STORAGE_KEY = "zbx_selected_network";

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkName>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "testnet" ? "testnet" : "mainnet";
    } catch {
      return "mainnet";
    }
  });

  useEffect(() => {
    setSelectedNetwork(network);
    try { localStorage.setItem(STORAGE_KEY, network); } catch {}
  }, [network]);

  const setNetwork = useCallback((n: NetworkName) => {
    setNetworkState(n);
  }, []);

  const value: NetworkContextValue = {
    network,
    setNetwork,
    isTestnet:   network === "testnet",
    chainId:     network === "testnet" ? 8990 : 8989,
    displayName: network === "testnet" ? "Testnet" : "Mainnet",
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
