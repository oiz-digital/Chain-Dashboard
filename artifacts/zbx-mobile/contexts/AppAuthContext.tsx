import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_KEY = "zbx_auth_v1";
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export interface AppUser {
  id: number;
  email: string;
  displayName: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

interface AuthState {
  user: AppUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
  signup: (email: string, password: string, displayName: string, inviteCode: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState & AuthActions>({
  user: null, token: null, isLoading: true, isAuthenticated: false,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (tok: string, usr: AppUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ token: tok, user: usr }));
    setToken(tok);
    setUser(usr);
  }, []);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Restore session on app start
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (raw) {
          const { token: savedToken, user: savedUser } = JSON.parse(raw);
          // Validate token with server
          const r = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (r.ok) {
            const d = await r.json();
            await persist(savedToken, d.user);
          } else {
            await clear();
          }
        }
      } catch { await clear(); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) return { success: false, error: d.error, requiresVerification: d.requiresVerification };
      await persist(d.token, d.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Check your connection." };
    }
  }, [persist]);

  const signup = useCallback(async (email: string, password: string, displayName: string, inviteCode: string) => {
    try {
      const body: Record<string, string> = { email, password };
      if (displayName.trim()) body.displayName = displayName.trim();
      if (inviteCode.trim())  body.inviteCode  = inviteCode.trim();
      const r = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return { success: false, error: d.error };
      if (d.requiresVerification) return { success: true, requiresVerification: true };
      await persist(d.token, d.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Check your connection." };
    }
  }, [persist]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    await clear();
  }, [token, clear]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { const d = await r.json(); setUser(d.user); }
      else await clear();
    } catch {}
  }, [token, clear]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user && !!token, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth() { return useContext(AuthContext); }
