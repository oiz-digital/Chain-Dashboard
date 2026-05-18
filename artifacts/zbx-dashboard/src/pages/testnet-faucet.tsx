import React, { useState } from "react";
import { FlaskConical, Droplet, Clock, CheckCircle2, XCircle, Loader2, ExternalLink, Copy, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetwork } from "@/contexts/NetworkContext";

interface FaucetResult {
  success:     boolean;
  txHash?:     string;
  amount?:     number;
  newBalance?: string;
  message?:    string;
  error?:      string;
  nextAllowed?: string;
}

interface HistoryItem {
  id:        number;
  address:   string;
  amount:    string;
  txHash:    string;
  createdAt: string;
}

export default function TestnetFaucet() {
  const { isTestnet, setNetwork } = useNetwork();
  const [address,  setAddress]    = useState("");
  const [loading,  setLoading]    = useState(false);
  const [result,   setResult]     = useState<FaucetResult | null>(null);
  const [history,  setHistory]    = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [copied,   setCopied]     = useState(false);

  const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(address.trim());

  async function handleRequest() {
    if (!isValidAddr || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/testnet/faucet", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, ...data });
        loadHistory();
      } else {
        setResult({ success: false, error: data.error, nextAllowed: data.nextAllowed });
      }
    } catch (e) {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistLoading(true);
    try {
      const res  = await fetch("/api/testnet/faucet/history?limit=10");
      const data = await res.json();
      setHistory(data.requests ?? []);
    } catch {}
    setHistLoading(false);
  }

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  React.useEffect(() => { loadHistory(); }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
          <FlaskConical className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Testnet Faucet</h1>
          <p className="text-sm text-muted-foreground">Get 1,000 test ZBX · Chain ID 8990 · 24h cooldown</p>
        </div>
      </div>

      {/* Testnet warning if on mainnet */}
      {!isTestnet && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
          <FlaskConical className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-300">You are currently on Mainnet</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">Switch to Testnet to use the faucet.</p>
          </div>
          <button
            onClick={() => setNetwork("testnet")}
            className="text-xs font-semibold text-yellow-400 border border-yellow-500/40 px-3 py-1.5 rounded-md hover:bg-yellow-500/20 transition-colors"
          >
            Switch to Testnet
          </button>
        </div>
      )}

      {/* Request card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Droplet className="h-4 w-4 text-yellow-400" />
          <span className="font-semibold text-sm">Request Test Tokens</span>
          <span className="ml-auto text-[11px] font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
            1,000 ZBX / 24h
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Your Testnet Address</label>
          <input
            value={address}
            onChange={e => { setAddress(e.target.value); setResult(null); }}
            placeholder="0x..."
            className={cn(
              "w-full rounded-lg border bg-background/50 px-3 py-2.5 text-sm font-mono outline-none transition-colors",
              address && !isValidAddr
                ? "border-red-500/50 focus:border-red-500"
                : "border-border/60 focus:border-yellow-500/50"
            )}
          />
          {address && !isValidAddr && (
            <p className="text-[11px] text-red-400">Enter a valid 0x address (40 hex chars)</p>
          )}
        </div>

        <button
          onClick={handleRequest}
          disabled={!isValidAddr || loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            isValidAddr && !loading
              ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30"
              : "bg-muted/30 border border-border/40 text-muted-foreground cursor-not-allowed"
          )}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Sending ZBX...</>
          ) : (
            <><Droplet className="h-4 w-4" /> Request 1,000 Test ZBX</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={cn(
            "rounded-lg border p-4 space-y-2",
            result.success
              ? "bg-green-500/10 border-green-500/30"
              : "bg-red-500/10 border-red-500/30"
          )}>
            <div className="flex items-center gap-2">
              {result.success
                ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                : <XCircle       className="h-4 w-4 text-red-400" />
              }
              <span className={cn("text-sm font-semibold", result.success ? "text-green-300" : "text-red-300")}>
                {result.success ? `${result.amount?.toLocaleString()} ZBX Sent!` : "Request Failed"}
              </span>
            </div>
            {result.success && result.txHash && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Tx Hash:</span>
                <span className="text-[11px] font-mono text-foreground truncate flex-1">{result.txHash}</span>
                <button onClick={() => copyHash(result.txHash!)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            {result.success && result.newBalance && (
              <p className="text-[11px] text-muted-foreground">
                New balance: <span className="font-mono text-yellow-400">{parseFloat(result.newBalance).toFixed(2)} ZBX</span>
              </p>
            )}
            {result.success && result.nextAllowed && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next request: {new Date(result.nextAllowed).toLocaleString()}
              </p>
            )}
            {!result.success && result.error && (
              <p className="text-[11px] text-red-300">{result.error}</p>
            )}
            {!result.success && result.nextAllowed && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Available at: {new Date(result.nextAllowed).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Amount",   value: "1,000 ZBX",  color: "text-yellow-400" },
          { label: "Cooldown", value: "24 Hours",   color: "text-cyan-400" },
          { label: "Chain ID", value: "8990",       color: "text-primary" },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-border/40 bg-card/60 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            <p className={cn("text-sm font-bold font-mono mt-1", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Recent Faucet Requests</span>
          <button onClick={loadHistory} disabled={histLoading} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            {histLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </button>
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No faucet requests yet</div>
        ) : (
          <div className="divide-y divide-border/30">
            {history.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <Droplet className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-xs font-mono text-muted-foreground truncate flex-1">{item.address}</span>
                <span className="text-xs font-mono text-yellow-400 font-semibold">+{item.amount} ZBX</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
