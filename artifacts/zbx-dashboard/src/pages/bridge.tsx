import React, { useState } from "react";
import { ArrowRightLeft, Clock, CheckCircle2, AlertTriangle, ExternalLink, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAINS = [
  { id: "zbx",      name: "ZBX Chain",  logo: "Z", color: "text-primary",  bg: "bg-primary/20",  tokens: ["ZBX", "ZBXUSD"] },
  { id: "eth",      name: "Ethereum",   logo: "E", color: "text-blue-400",  bg: "bg-blue-500/20", tokens: ["ETH", "USDT", "USDC", "WBTC"] },
  { id: "cosmos",   name: "Cosmos Hub", logo: "C", color: "text-purple-400",bg: "bg-purple-500/20",tokens: ["ATOM", "USDC"] },
  { id: "bnb",      name: "BNB Chain",  logo: "B", color: "text-yellow-400",bg: "bg-yellow-500/20",tokens: ["BNB", "USDT"] },
  { id: "osmosis",  name: "Osmosis",    logo: "O", color: "text-pink-400",  bg: "bg-pink-500/20", tokens: ["OSMO", "USDC", "ATOM"] },
  { id: "celestia", name: "Celestia",   logo: "T", color: "text-cyan-400",  bg: "bg-cyan-500/20", tokens: ["TIA"] },
];

const RECENT_BRIDGES = [
  { id: "0xbr001", from: "ZBX Chain", to: "Ethereum",   amount: "50,000 ZBX", value: "$4,235", status: "success",  time: "2m ago" },
  { id: "0xbr002", from: "Ethereum",  to: "ZBX Chain",  amount: "2.5 ETH",    value: "$8,320", status: "success",  time: "8m ago" },
  { id: "0xbr003", from: "Cosmos Hub",to: "ZBX Chain",  amount: "1,000 ATOM", value: "$9,610", status: "pending",  time: "14m ago" },
  { id: "0xbr004", from: "ZBX Chain", to: "Osmosis",    amount: "100,000 ZBX",value: "$8,470", status: "success",  time: "31m ago" },
  { id: "0xbr005", from: "BNB Chain", to: "ZBX Chain",  amount: "30 BNB",     value: "$8,820", status: "success",  time: "47m ago" },
];

function ChainPicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chain = CHAINS.find(c => c.id === value) ?? CHAINS[0];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 bg-muted/40 border border-border/60 rounded-xl px-4 py-3 hover:bg-muted/60 transition-colors"
        >
          <span className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0", chain.bg, chain.color)}>{chain.logo}</span>
          <span className="flex-1 text-left font-semibold text-sm">{chain.name}</span>
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border/60 rounded-xl shadow-xl p-1.5 space-y-0.5">
            {CHAINS.map(c => (
              <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm",
                  c.id === value && "bg-primary/10 text-primary")}>
                <span className={cn("h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold", c.bg, c.color)}>{c.logo}</span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BridgePage() {
  const [fromChain, setFromChain] = useState("zbx");
  const [toChain,   setToChain]   = useState("eth");
  const [token,     setToken]     = useState("ZBX");
  const [amount,    setAmount]    = useState("10000");
  const [status,    setStatus]    = useState<"idle" | "confirming" | "success">("idle");

  const from = CHAINS.find(c => c.id === fromChain)!;
  const to   = CHAINS.find(c => c.id === toChain)!;
  const tokens = from.tokens;
  const bridgeFee  = (Number(amount) * 0.001).toFixed(2);
  const receiveAmt = (Number(amount) * 0.999).toFixed(2);
  const estimatedTime = fromChain === "zbx" || toChain === "zbx" ? "~2 min" : "~15 min";

  const swap = () => {
    const tmp = fromChain;
    setFromChain(toChain);
    setToChain(tmp);
    setToken(CHAINS.find(c => c.id === toChain)?.tokens[0] ?? "ZBX");
  };

  const bridge = () => {
    setStatus("confirming");
    setTimeout(() => setStatus("success"), 2500);
    setTimeout(() => setStatus("idle"), 6000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bridge</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Transfer assets cross-chain via IBC and ZBX Bridge Protocol</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/60 rounded-xl px-3 py-1.5">
          <Shield className="h-3.5 w-3.5 text-green-400" />
          Secured by IBC
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bridge form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-4">
            <ChainPicker label="From" value={fromChain} onChange={setFromChain} />

            {/* Flip */}
            <div className="flex justify-center">
              <button onClick={swap} className="h-9 w-9 rounded-xl bg-card border border-border/60 hover:bg-muted flex items-center justify-center transition-all hover:rotate-180 duration-300 shadow-sm">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <ChainPicker label="To" value={toChain} onChange={setToChain} />

            {/* Token & Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Token & Amount</label>
              <div className="flex gap-2">
                <select
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none cursor-pointer"
                >
                  {tokens.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                />
              </div>
            </div>

            {/* Quote */}
            {Number(amount) > 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You Receive</span>
                  <span className="font-semibold text-green-400">{Number(receiveAmt).toLocaleString()} {token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bridge Fee (0.1%)</span>
                  <span>{Number(bridgeFee).toLocaleString()} {token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Time</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{estimatedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <span className="font-mono">{from.name} → {to.name}</span>
                </div>
              </div>
            )}

            {status === "success" ? (
              <div className="w-full rounded-xl py-3.5 bg-green-500/15 border border-green-500/30 flex items-center justify-center gap-2 text-green-400 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Bridge Transaction Submitted!
              </div>
            ) : (
              <button
                onClick={bridge}
                disabled={Number(amount) <= 0 || fromChain === toChain || status === "confirming"}
                className="w-full rounded-xl py-3.5 bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {status === "confirming" ? "Confirming…" : `Bridge ${token} to ${to.name}`}
              </button>
            )}

            {fromChain === toChain && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Source and destination chains must be different.
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Supported chains */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Supported Networks</h3>
            <div className="grid grid-cols-2 gap-3">
              {CHAINS.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                  <span className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0", c.bg, c.color)}>{c.logo}</span>
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.tokens.join(", ")}</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Live
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Bridges */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h3 className="font-semibold text-sm">Recent Bridge Transfers</h3>
            </div>
            <div className="divide-y divide-border/20">
              {RECENT_BRIDGES.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{tx.from} → {tx.to}</div>
                    <div className="text-xs text-muted-foreground">{tx.amount} · {tx.value}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                      tx.status === "success" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                    )}>
                      {tx.status}
                    </span>
                    <div className="text-[10px] text-muted-foreground text-right">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
