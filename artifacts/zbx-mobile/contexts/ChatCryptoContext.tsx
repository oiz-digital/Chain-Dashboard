import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getOrCreateKeyPair, type KeyPair } from "@/utils/crypto";
import { useAppAuth } from "@/contexts/AppAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ChatCryptoState {
  keyPair: KeyPair | null;
  isReady: boolean;
  registerKey: () => Promise<void>;
}

const ChatCryptoContext = createContext<ChatCryptoState>({
  keyPair: null,
  isReady: false,
  registerKey: async () => {},
});

export function ChatCryptoProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAppAuth();
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isReady, setIsReady] = useState(false);

  const registerKey = useCallback(async () => {
    if (!token) return;
    const kp = await getOrCreateKeyPair();
    setKeyPair(kp);
    try {
      await fetch(`${API_BASE}/api/chat/public-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ publicKey: kp.publicKey }),
      });
    } catch {}
    setIsReady(true);
  }, [token]);

  useEffect(() => {
    (async () => {
      const kp = await getOrCreateKeyPair();
      setKeyPair(kp);
      setIsReady(true);
      if (isAuthenticated && token) {
        try {
          await fetch(`${API_BASE}/api/chat/public-key`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ publicKey: kp.publicKey }),
          });
        } catch {}
      }
    })();
  }, [isAuthenticated, token]);

  return (
    <ChatCryptoContext.Provider value={{ keyPair, isReady, registerKey }}>
      {children}
    </ChatCryptoContext.Provider>
  );
}

export function useChatCrypto() { return useContext(ChatCryptoContext); }
