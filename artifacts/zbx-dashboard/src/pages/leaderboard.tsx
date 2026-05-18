import React, { useState } from "react";
import { Trophy, Copy, ExternalLink, TrendingUp, Users, Coins, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const TOTAL_SUPPLY = 500_000_000;

const LABELS: Record<string, string> = {
  zbx1foundation0000000000000000: "ZBX Foundation",
  zbx1ecosystem00000000000000000: "Ecosystem Fund",
  zbx1treasury000000000000000000: "Treasury",
  zbx1team0000000000000000000000: "Team & Advisors",
  zbx1validators0000000000000000: "Validator Pool",
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genAddress(i: number) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  let n = i * 1_000_003 + 987_654;
  for (let j = 0; j < 38; j++) {
    n = (n * 1_664_525 + 1_013_904_223) & 0x7fffffff;
    result += chars[n % chars.length];
  }
  return `zbx1${result}`;
}

const ACCOUNTS = Array.from({ length: 50 }, (_, i) => {
  const fixed = [
    { address: "zbx1foundation0000000000000000", balance: 85_000_000, staked: 0,          txCount: 412 },
    { address: "zbx1ecosystem00000000000000000", balance: 60_000_000, staked: 0,          txCount: 218 },
    { address: "zbx1treasury000000000000000000", balance: 45_000_000, staked: 0,          txCount: 87 },
    { address: "zbx1team0000000000000000000000", balance: 35_000_000, staked: 0,          txCount: 134 },
    { address: "zbx1validators0000000000000000", balance: 18_420_000, staked: 18_420_000, txCount: 9842 },
  ];
  if (i < fixed.length) {
    const f = fixed[i];
    return { rank: i + 1, address: f.address, label: LABELS[f.address], balance: f.balance, stakedAmount: f.staked, txCount: f.txCount };
  }
  const seed  = i * 137.508;
  const seed2 = i * 97.333 + 5;
  const r1 = seededRandom(seed), r2 = seededRandom(seed2);
  const balance = Math.round(1_000_000 * Math.pow(0.72, i - 5) * (0.7 + r1 * 0.6));
  return {
    rank: i + 1,
    address: genAddress(i),
    label: undefined as string | undefined,
    balance,
    stakedAmount: Math.round(balance * r2 * 0.4),
    txCount: Math.round(50 + r1 * 2000),
  };
});

type SortKey = "balance" | "staked" | "txCount";

const RANK_ICONS: Record<number, { icon: string; color: string }> = {
  1: { icon: "🥇", color: "text-yellow-400" },
  2: { icon: "🥈", color: "text-zinc-400" },
  3: { icon: "🥉", color: "text-orange-500" },
};

function copyAddr(a: string) {
  navigator.clipboard?.writeText(a);
}

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("balance");
  const [copied, setCopied] = useState<string | null>(null);

  const sorted = [...ACCOUNTS].sort((a, b) => {
    if (sortBy === "balance")  return b.balance - a.balance;
    if (sortBy === "staked")   return b.stakedAmount - a.stakedAmount;
    return b.txCount - a.txCount;
  }).map((a, i) => ({ ...a, rank: i + 1 }));

  const top3Total = sorted.slice(0, 3).reduce((s, a) => s + a.balance, 0);

  const copy = (addr: string) => {
    copyAddr(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Top ZBX accounts by balance, staking, and activity</p>
        </div>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-4">
        {[sorted[1], sorted[0], sorted[2]].filter(Boolean).map((a, podiumIdx) => {
          const realRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
          const rankInfo = RANK_ICONS[realRank];
          const height   = realRank === 1 ? "pt-0" : "pt-6";
          return (
            <div key={a.address} className={cn("flex flex-col items-center text-center", height)}>
              <div className={cn("bg-card border border-border/60 rounded-2xl p-4 w-full shadow-sm space-y-2",
                realRank === 1 && "border-yellow-500/30 bg-yellow-500/5")}>
                <span className="text-2xl">{rankInfo.icon}</span>
                <div className={cn("h-10 w-10 rounded-xl mx-auto flex items-center justify-center text-xs font-bold",
                  realRank === 1 ? "bg-yellow-500/20 text-yellow-400" : "bg-muted/60 text-muted-foreground")}>
                  {a.label ? a.label.slice(0, 2).toUpperCase() : a.address.slice(4, 6).toUpperCase()}
                </div>
                <div>
                  <p className={cn("text-xs font-semibold truncate", realRank === 1 ? "text-yellow-300" : "text-foreground")}>
                    {a.label ?? `${a.address.slice(0, 10)}…`}
                  </p>
                  <p className="text-sm font-bold mt-1">
                    {(a.balance / 1_000_000).toFixed(1)}M ZBX
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {((a.balance / TOTAL_SUPPLY) * 100).toFixed(2)}% supply
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sort controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted/40 border border-border/40 rounded-xl p-1">
          {([["balance", "Balance", Coins], ["staked", "Staked", TrendingUp], ["txCount", "Activity", Activity]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                sortBy === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{sorted.length} accounts</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-6 gap-2 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest bg-muted/20 border-b border-border/30">
          <div className="col-span-1">Rank</div>
          <div className="col-span-2">Address</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Staked</div>
          <div className="text-right">Txns</div>
        </div>
        <div className="divide-y divide-border/20">
          {sorted.map(a => {
            const ri = RANK_ICONS[a.rank];
            return (
              <div key={a.address} className="grid grid-cols-6 gap-2 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                <div className="col-span-1 flex items-center gap-2">
                  {ri ? (
                    <span className="text-lg">{ri.icon}</span>
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground w-6 text-center">#{a.rank}</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                    {a.label ? a.label.slice(0, 2).toUpperCase() : a.address.slice(4, 6).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {a.label && <p className="text-xs font-semibold text-primary truncate">{a.label}</p>}
                    <p className="text-xs font-mono text-muted-foreground truncate">{a.address.slice(0, 16)}…</p>
                  </div>
                  <button
                    onClick={() => copy(a.address)}
                    className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0"
                  >
                    {copied === a.address
                      ? <span className="text-[9px] text-green-400">✓</span>
                      : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{(a.balance / 1_000_000).toFixed(2)}M</p>
                  <p className="text-[10px] text-muted-foreground">{((a.balance / TOTAL_SUPPLY) * 100).toFixed(3)}%</p>
                </div>
                <div className="text-right">
                  {a.stakedAmount > 0 ? (
                    <p className="text-sm font-semibold text-green-400">{(a.stakedAmount / 1_000_000).toFixed(2)}M</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/40">—</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{a.txCount.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
