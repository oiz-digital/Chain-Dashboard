import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getOrCreateChainWallet, type ChainWallet } from "@/utils/chainAddress";
import { useAppAuth } from "@/contexts/AppAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ChainChatState {
  wallet: ChainWallet | null;
  isReady: boolean;
  isRegistered: boolean;
  register: () => Promise<{ ok: boolean; error?: string }>;
}

const ChainChatContext = createContext<ChainChatState>({
  wallet: null,
  isReady: false,
  isRegistered: false,
  register: async () => ({ ok: false }),
});

export function ChainChatProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAppAuth();
  const [wallet, setWallet] = useState<ChainWallet | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const register = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!token || !wallet) return { ok: false, error: "Not ready" };
    try {
      const r = await fetch(`${API_BASE}/api/chat/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: wallet.address, publicKey: wallet.publicKey }),
      });
      const d = await r.json();
      if (r.ok) { setIsRegistered(true); return { ok: true }; }
      return { ok: false, error: d.error };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [token, wallet]);

  useEffect(() => {
    (async () => {
      const w = await getOrCreateChainWallet();
      setWallet(w);
      setIsReady(true);
      if (isAuthenticated && token) {
        try {
          const r = await fetch(`${API_BASE}/api/chat/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) {
            const d = await r.json();
            if (d.user?.walletAddress) {
              setIsRegistered(true);
            } else {
              const reg = await fetch(`${API_BASE}/api/chat/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ walletAddress: w.address, publicKey: w.publicKey }),
              });
              if (reg.ok) setIsRegistered(true);
            }
          }
        } catch {}
      }
    })();
  }, [isAuthenticated, token]);

  return (
    <ChainChatContext.Provider value={{ wallet, isReady, isRegistered, register }}>
      {children}
    </ChainChatContext.Provider>
  );
}

export function useChainChat() { return useContext(ChainChatContext); }
