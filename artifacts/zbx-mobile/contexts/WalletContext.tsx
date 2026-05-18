import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Token {
  symbol: string;
  name: string;
  balance: number;
  priceUsd: number;
  color: string;
  isNative: boolean;
  decimals: number;
  change24h: number;
}

export interface Chain {
  id: number;
  name: string;
  shortName: string;
  nativeSymbol: string;
  color: string;
  icon: string;
  testnet: boolean;
  rpc: string;
  explorer: string;
  tokens: Token[];
}

export interface TxRecord {
  hash: string;
  type: "send" | "receive" | "stake" | "unstake" | "swap";
  tokenSymbol: string;
  amount: number;
  to: string;
  from: string;
  chainId: number;
  status: "success" | "pending" | "failed";
  timestamp: number;
  gasUsed: number;
}

export const CHAINS: Chain[] = [
  {
    id: 8989,
    name: "ZBX Mainnet",
    shortName: "ZBX",
    nativeSymbol: "ZBX",
    color: "#a855f7",
    icon: "cpu",
    testnet: false,
    rpc: "https://rpc.zbx.network",
    explorer: "https://explorer.zbx.network",
    tokens: [
      { symbol: "ZBX",  name: "Zebvix",       balance: 2847.32, priceUsd: 0.284,    color: "#a855f7", isNative: true,  decimals: 18, change24h:  3.2 },
      { symbol: "USDT", name: "Tether USD",    balance: 1500.00, priceUsd: 1.00,     color: "#26a17b", isNative: false, decimals: 6,  change24h:  0.01 },
      { symbol: "USDC", name: "USD Coin",      balance: 820.50,  priceUsd: 1.00,     color: "#2775ca", isNative: false, decimals: 6,  change24h: -0.02 },
      { symbol: "WETH", name: "Wrapped ETH",   balance: 0.42,    priceUsd: 3480.00,  color: "#627eea", isNative: false, decimals: 18, change24h:  1.8 },
      { symbol: "ZLP",  name: "ZBX LP Token",  balance: 125.80,  priceUsd: 4.20,     color: "#e879f9", isNative: false, decimals: 18, change24h:  5.4 },
    ],
  },
  {
    id: 8988,
    name: "ZBX Testnet",
    shortName: "TZBX",
    nativeSymbol: "tZBX",
    color: "#f59e0b",
    icon: "zap",
    testnet: true,
    rpc: "https://testnet-rpc.zbx.network",
    explorer: "https://testnet.explorer.zbx.network",
    tokens: [
      { symbol: "tZBX",  name: "Test ZBX",    balance: 99999.00, priceUsd: 0, color: "#f59e0b", isNative: true,  decimals: 18, change24h: 0 },
      { symbol: "tUSDT", name: "Test Tether", balance: 50000.00, priceUsd: 0, color: "#26a17b", isNative: false, decimals: 6,  change24h: 0 },
    ],
  },
  {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    nativeSymbol: "ETH",
    color: "#627eea",
    icon: "hexagon",
    testnet: false,
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    tokens: [
      { symbol: "ETH",  name: "Ether",        balance: 0.84,   priceUsd: 3480.00,  color: "#627eea", isNative: true,  decimals: 18, change24h:  1.8 },
      { symbol: "USDT", name: "Tether USD",   balance: 2100.00, priceUsd: 1.00,    color: "#26a17b", isNative: false, decimals: 6,  change24h:  0.01 },
      { symbol: "USDC", name: "USD Coin",     balance: 550.00,  priceUsd: 1.00,    color: "#2775ca", isNative: false, decimals: 6,  change24h: -0.02 },
      { symbol: "WBTC", name: "Wrapped BTC",  balance: 0.012,   priceUsd: 98400.00, color: "#f7931a", isNative: false, decimals: 8,  change24h: -0.5 },
    ],
  },
  {
    id: 137,
    name: "Polygon",
    shortName: "POL",
    nativeSymbol: "POL",
    color: "#8247e5",
    icon: "triangle",
    testnet: false,
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    tokens: [
      { symbol: "POL",  name: "Polygon",     balance: 3200.00, priceUsd: 0.48,    color: "#8247e5", isNative: true,  decimals: 18, change24h: -1.2 },
      { symbol: "USDT", name: "Tether USD",  balance: 400.00,  priceUsd: 1.00,    color: "#26a17b", isNative: false, decimals: 6,  change24h:  0.01 },
      { symbol: "USDC", name: "USD Coin",    balance: 200.00,  priceUsd: 1.00,    color: "#2775ca", isNative: false, decimals: 6,  change24h: -0.02 },
      { symbol: "WETH", name: "Wrapped ETH", balance: 0.18,    priceUsd: 3480.00, color: "#627eea", isNative: false, decimals: 18, change24h:  1.8 },
    ],
  },
  {
    id: 56,
    name: "BNB Chain",
    shortName: "BNB",
    nativeSymbol: "BNB",
    color: "#f0b90b",
    icon: "disc",
    testnet: false,
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    tokens: [
      { symbol: "BNB",  name: "BNB",          balance: 2.84,   priceUsd: 720.00, color: "#f0b90b", isNative: true,  decimals: 18, change24h:  0.9 },
      { symbol: "USDT", name: "Tether USD",   balance: 300.00, priceUsd: 1.00,   color: "#26a17b", isNative: false, decimals: 6,  change24h:  0.01 },
      { symbol: "CAKE", name: "PancakeSwap",  balance: 45.20,  priceUsd: 2.80,   color: "#d1884f", isNative: false, decimals: 18, change24h:  4.1 },
      { symbol: "BUSD", name: "Binance USD",  balance: 180.00, priceUsd: 1.00,   color: "#f0b90b", isNative: false, decimals: 18, change24h:  0.0 },
    ],
  },
  {
    id: 42161,
    name: "Arbitrum",
    shortName: "ARB",
    nativeSymbol: "ETH",
    color: "#28a0f0",
    icon: "layers",
    testnet: false,
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    tokens: [
      { symbol: "ETH",  name: "Ether",     balance: 0.22,   priceUsd: 3480.00, color: "#627eea", isNative: true,  decimals: 18, change24h:  1.8 },
      { symbol: "ARB",  name: "Arbitrum",  balance: 180.00, priceUsd: 1.02,    color: "#28a0f0", isNative: false, decimals: 18, change24h:  2.3 },
      { symbol: "USDC", name: "USD Coin",  balance: 750.00, priceUsd: 1.00,    color: "#2775ca", isNative: false, decimals: 6,  change24h: -0.02 },
      { symbol: "GMX",  name: "GMX",       balance: 3.50,   priceUsd: 24.80,   color: "#00d4ff", isNative: false, decimals: 18, change24h: -0.8 },
    ],
  },
];

const WORD_LIST = [
  "abandon","ability","able","about","above","absent","absorb","abstract",
  "absurd","abuse","access","accident","account","accuse","achieve","acid",
  "acoustic","acquire","across","action","actor","actual","adapt","add",
  "addict","address","adjust","admit","adult","advance","advice","aerobic",
  "afraid","again","agent","agree","ahead","aim","airport","aisle",
  "alarm","album","alcohol","alert","alien","all","alley","allow",
];

function generateMnemonic(): string {
  return Array.from({ length: 12 }, () =>
    WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]
  ).join(" ");
}

function generateAddress(): string {
  return "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

interface StoredWallet {
  isCreated: boolean;
  address: string;
  selectedChainId: number;
  transactions: TxRecord[];
}

interface WalletContextType {
  isCreated: boolean;
  address: string | null;
  selectedChain: Chain;
  selectedChainId: number;
  setSelectedChainId: (id: number) => void;
  chains: Chain[];
  createWallet: () => Promise<string>;
  importWallet: (input: string) => Promise<void>;
  watchAddress: (addr: string) => Promise<void>;
  resetWallet: () => Promise<void>;
  addTransaction: (tx: Omit<TxRecord, "hash" | "timestamp">) => Promise<void>;
  transactions: TxRecord[];
  totalPortfolioUsd: number;
  change24hUsd: number;
  change24hPct: number;
  chainPortfolioUsd: (chainId: number) => number;
  loading: boolean;
}

const WalletContext = createContext<WalletContextType>(null!);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isCreated, setIsCreated] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainIdState] = useState(8989);
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("zbx_wallet_v2").then(raw => {
      if (raw) {
        try {
          const data = JSON.parse(raw) as StoredWallet;
          setIsCreated(data.isCreated);
          setAddress(data.address);
          setSelectedChainIdState(data.selectedChainId ?? 8989);
          setTransactions(data.transactions ?? []);
        } catch {}
      }
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (
    created: boolean, addr: string | null, chainId: number, txs: TxRecord[]
  ) => {
    await AsyncStorage.setItem("zbx_wallet_v2", JSON.stringify({
      isCreated: created, address: addr, selectedChainId: chainId, transactions: txs,
    }));
  }, []);

  const createWallet = useCallback(async () => {
    const mnemonic = generateMnemonic();
    const addr = generateAddress();
    setIsCreated(true);
    setAddress(addr);
    setSelectedChainIdState(8989);
    setTransactions([]);
    await persist(true, addr, 8989, []);
    return mnemonic;
  }, [persist]);

  const importWallet = useCallback(async (input: string) => {
    const addr = generateAddress();
    setIsCreated(true);
    setAddress(addr);
    setSelectedChainIdState(8989);
    setTransactions([]);
    await persist(true, addr, 8989, []);
  }, [persist]);

  const watchAddress = useCallback(async (addr: string) => {
    setIsCreated(true);
    setAddress(addr);
    setSelectedChainIdState(8989);
    setTransactions([]);
    await persist(true, addr, 8989, []);
  }, [persist]);

  const resetWallet = useCallback(async () => {
    setIsCreated(false);
    setAddress(null);
    setSelectedChainIdState(8989);
    setTransactions([]);
    await AsyncStorage.removeItem("zbx_wallet_v2");
  }, []);

  const setSelectedChainId = useCallback(async (id: number) => {
    setSelectedChainIdState(id);
    await persist(isCreated, address, id, transactions);
  }, [isCreated, address, transactions, persist]);

  const addTransaction = useCallback(async (tx: Omit<TxRecord, "hash" | "timestamp">) => {
    const newTx: TxRecord = {
      ...tx,
      hash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      timestamp: Date.now(),
    };
    const updated = [newTx, ...transactions].slice(0, 50);
    setTransactions(updated);
    await persist(isCreated, address, selectedChainId, updated);
  }, [transactions, isCreated, address, selectedChainId, persist]);

  const selectedChain = CHAINS.find(c => c.id === selectedChainId) ?? CHAINS[0];

  const totalPortfolioUsd = CHAINS.reduce((t, c) =>
    t + c.tokens.reduce((s, tok) => s + tok.balance * tok.priceUsd, 0), 0);

  const change24hUsd = CHAINS.reduce((t, c) =>
    t + c.tokens.reduce((s, tok) => s + (tok.balance * tok.priceUsd * tok.change24h / 100), 0), 0);

  const change24hPct = totalPortfolioUsd > 0
    ? (change24hUsd / (totalPortfolioUsd - change24hUsd)) * 100
    : 0;

  const chainPortfolioUsd = useCallback((chainId: number) => {
    const chain = CHAINS.find(c => c.id === chainId);
    if (!chain) return 0;
    return chain.tokens.reduce((s, t) => s + t.balance * t.priceUsd, 0);
  }, []);

  return (
    <WalletContext.Provider value={{
      isCreated, address, selectedChain, selectedChainId,
      setSelectedChainId, chains: CHAINS,
      createWallet, importWallet, watchAddress, resetWallet,
      addTransaction, transactions,
      totalPortfolioUsd, change24hUsd, change24hPct, chainPortfolioUsd,
      loading,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
