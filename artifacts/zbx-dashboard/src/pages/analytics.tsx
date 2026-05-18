import React, { useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Activity, Droplets } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";

const DAYS_OPTIONS = [7, 30, 90] as const;
type Days = typeof DAYS_OPTIONS[number];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateHistory(days: Days) {
  const now  = Date.now();
  const base = 0.0847;
  return Array.from({ length: days }, (_, i) => {
    const seed    = i * 7 + 42;
    const trend   = (i / days) * 0.008;
    const noise   = (seededRandom(seed) - 0.48) * 0.012;
    const dayOff  = days - i;
    const date    = new Date(now - dayOff * 86_400_000).toISOString().slice(5, 10);
    const price   = Math.max(0.05, base - 0.01 + trend + noise);
    const tvl     = 24_870_000 * (0.80 + (i / days) * 0.15 + (seededRandom(seed + 1) - 0.47) * 0.05);
    const volume  = 300_000 + seededRandom(seed + 2) * 2_000_000;
    return {
      date,
      price: parseFloat(price.toFixed(5)),
      tvl:   parseFloat((tvl / 1_000_000).toFixed(3)),
      volume: parseFloat((volume / 1_000_000).toFixed(3)),
    };
  });
}

const CHAIN_METRICS = [
  { label: "Block Time", value: "6.0s", sub: "avg", good: true },
  { label: "TPS (peak)", value: "847", sub: "last 24h", good: true },
  { label: "Active Addresses", value: "42,618", sub: "30d", good: true },
  { label: "Daily Txns", value: "189,420", sub: "yesterday", good: true },
  { label: "Avg Gas Price", value: "0.025 gwei", sub: "last block", good: true },
  { label: "Contract Calls", value: "68,240", sub: "24h", good: true },
];

function StatBadge({ label, value, change }: { label: string; value: string; change?: number }) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs font-semibold", up ? "text-green-400" : "text-red-400")}>
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {up ? "+" : ""}{change.toFixed(2)}% 24h
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [days, setDays] = useState<Days>(30);
  const data = generateHistory(days);

  const currentPrice = data[data.length - 1]?.price ?? 0.0847;
  const yesterdayPrice = data[data.length - 2]?.price ?? 0.0847;
  const weekAgo = data[Math.max(0, data.length - 8)]?.price ?? 0.0847;
  const priceChange24h = ((currentPrice - yesterdayPrice) / yesterdayPrice * 100);
  const priceChange7d  = ((currentPrice - weekAgo) / weekAgo * 100);
  const marketCap = currentPrice * 187_500_000;
  const fdv       = currentPrice * 500_000_000;
  const currentTvl = (data[data.length - 1]?.tvl ?? 24.87);
  const totalVolume = data.reduce((s, d) => s + d.volume, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Price, TVL, and on-chain activity metrics</p>
        </div>
        <div className="flex gap-1 bg-muted/40 border border-border/40 rounded-xl p-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                days === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBadge label="ZBX Price" value={`$${currentPrice.toFixed(5)}`} change={priceChange24h} />
        <StatBadge label="Market Cap" value={`$${(marketCap / 1_000_000).toFixed(2)}M`} change={priceChange24h} />
        <StatBadge label="Total TVL" value={`$${currentTvl.toFixed(2)}M`} />
        <StatBadge label={`${days}D Volume`} value={`$${totalVolume.toFixed(2)}M`} />
      </div>

      {/* Price Chart */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">ZBX Price (USD)</h3>
          </div>
          <div className={cn("flex items-center gap-1 text-xs font-semibold",
            priceChange7d >= 0 ? "text-green-400" : "text-red-400")}>
            {priceChange7d >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {priceChange7d >= 0 ? "+" : ""}{priceChange7d.toFixed(2)}% 7d
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.floor(days / 6)} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(4)}`} width={65} />
            <Tooltip content={<CustomTooltip formatter={(v: number) => `$${v.toFixed(5)}`} />} />
            <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* TVL + Volume charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TVL */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Total Value Locked (USD)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.floor(days / 5)} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(1)}M`} width={58} />
              <Tooltip content={<CustomTooltip formatter={(v: number) => `$${v.toFixed(3)}M`} />} />
              <Area type="monotone" dataKey="tvl" stroke="#60a5fa" strokeWidth={2} fill="url(#tvlGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Volume */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <h3 className="font-semibold text-sm">Daily DEX Volume (USD)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.floor(days / 5)} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(1)}M`} width={58} />
              <Tooltip content={<CustomTooltip formatter={(v: number) => `$${v.toFixed(3)}M`} />} />
              <Bar dataKey="volume" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chain Metrics */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-green-400" />
          <h3 className="font-semibold text-sm">Chain Performance</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {CHAIN_METRICS.map(m => (
            <div key={m.label} className="rounded-xl bg-muted/30 border border-border/30 p-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-base font-bold mt-1">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Token Distribution */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-yellow-400" />
          <h3 className="font-semibold text-sm">Token Supply Distribution</h3>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Foundation & Ecosystem", pct: 29, color: "bg-primary" },
            { label: "Community & Grants",      pct: 20, color: "bg-blue-500" },
            { label: "Validators & Staking",    pct: 25, color: "bg-green-500" },
            { label: "Team & Advisors",          pct: 15, color: "bg-purple-500" },
            { label: "Public Sale",              pct: 11, color: "bg-orange-500" },
          ].map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold">{s.pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", s.color)} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl bg-muted/30 border border-border/30 p-3">
            <p className="text-xs text-muted-foreground">Circulating Supply</p>
            <p className="text-sm font-bold mt-1">187.5M ZBX</p>
            <p className="text-[10px] text-muted-foreground">37.5% of total</p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/30 p-3">
            <p className="text-xs text-muted-foreground">Fully Diluted Val.</p>
            <p className="text-sm font-bold mt-1">${(fdv / 1_000_000).toFixed(2)}M</p>
            <p className="text-[10px] text-muted-foreground">500M total supply</p>
          </div>
        </div>
      </div>
    </div>
  );
}
