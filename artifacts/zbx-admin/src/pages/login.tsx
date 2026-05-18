import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Activity, Eye, EyeOff, ArrowRight, Loader2, Shield, Brain, Coins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { StatusBanner } from "@/components/ui/status-banner";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS = [
  { username: "superadmin", password: "admin123", role: "Super Admin", color: "text-primary" },
  { username: "validator_admin", password: "valops123", role: "Admin", color: "text-cyan-400" },
  { username: "chain_monitor", password: "monitor123", role: "Viewer", color: "text-muted-foreground" },
];

const FEATURES = [
  { icon: Shield, label: "Validator Management", desc: "Monitor and manage all network validators" },
  { icon: Coins, label: "Token Registry", desc: "Full control over token listings and metadata" },
  { icon: Brain, label: "AI Model Registry", desc: "Deploy and manage on-chain AI models" },
  { icon: Users, label: "Admin Users", desc: "Role-based access control for your team" },
];

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError("Please enter username and password."); return; }
    setError("");
    setLoading(true);
    setProgress(20);

    const t1 = setTimeout(() => setProgress(55), 300);
    const t2 = setTimeout(() => setProgress(80), 600);

    const result = await login(username, password);

    clearTimeout(t1); clearTimeout(t2);

    if (result.success) {
      setProgress(100);
      setSuccess(true);
      setTimeout(() => setLocation("/"), 600);
    } else {
      setProgress(0);
      setLoading(false);
      setError(result.error ?? "Login failed. Please try again.");
    }
  }

  function fillDemo(u: string, p: string) {
    setUsername(u); setPassword(p); setError("");
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar border-r border-border flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(270_85%_60%_/_0.12)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(190_90%_55%_/_0.08)_0%,_transparent_60%)]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground tracking-wide">ZBX ADMIN</p>
              <p className="text-xs text-muted-foreground font-mono">Control Room v2.0</p>
            </div>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-foreground leading-tight mb-3">
              Zebvix Chain<br />
              <span className="text-primary">Network Operations</span>
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              Mission-critical infrastructure for managing the ZBX blockchain — validators, tokens, AI models, and system settings.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/50">
                <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-emerald-400 font-mono">NETWORK ONLINE — Block #284,710 — 847 TPS</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground">ZBX ADMIN</p>
              <p className="text-xs text-muted-foreground">Control Room</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access the admin panel</p>
          </div>

          {error && (
            <StatusBanner type="error" title="Authentication failed" message={error} className="mb-5" />
          )}
          {success && (
            <StatusBanner type="success" title="Login successful" message="Redirecting to dashboard..." dismissible={false} className="mb-5" />
          )}

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-login">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Username or Email</Label>
              <Input
                id="username"
                data-testid="input-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="superadmin"
                disabled={loading}
                className="h-11"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="h-11 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Authenticating...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                <>{success ? "Redirecting..." : "Sign in"} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Demo accounts</p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemo(acc.username, acc.password)}
                  data-testid={`button-demo-${acc.username}`}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{acc.username.slice(0,2).toUpperCase()}</span>
                    </div>
                    <span className="font-mono text-foreground">{acc.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", acc.color)}>{acc.role}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            ZBX Chain Admin Panel — Authorized access only
          </p>
        </div>
      </div>
    </div>
  );
}
