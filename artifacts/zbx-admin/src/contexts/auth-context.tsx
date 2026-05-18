import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AdminRole = "superadmin" | "admin" | "moderator" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: AdminRole;
  loginTime: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const STORAGE_KEY = "zbx_admin_session_v1";

const DEMO_USERS: Array<AuthUser & { password: string }> = [
  { id: 1, username: "superadmin", email: "super@zbx.io", displayName: "Super Admin", role: "superadmin", password: "admin123", loginTime: "" },
  { id: 2, username: "validator_admin", email: "valops@zbx.io", displayName: "Validator Ops", role: "admin", password: "valops123", loginTime: "" },
  { id: 3, username: "chain_monitor", email: "monitor@zbx.io", displayName: "Chain Monitor", role: "viewer", password: "monitor123", loginTime: "" },
];

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(r => setTimeout(r, 900));
    const found = DEMO_USERS.find(u => (u.username === username || u.email === username) && u.password === password);
    if (!found) return { success: false, error: "Invalid credentials. Check username and password." };
    const { password: _pw, ...authUser } = found;
    const session: AuthUser = { ...authUser, loginTime: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(session);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
