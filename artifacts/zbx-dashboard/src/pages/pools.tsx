import React, { useState } from "react";
import { Droplets, TrendingUp, DollarSign, BarChart3, Plus, ExternalLink, Filter } from "lucide-react";
import {
  useListDexPools,
  useListSwapTransactions,
  getListDexPoolsQueryKey,
  getListSwapTransactionsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type SortKey = "tvl" | "volume" | "apy" | "fees";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "tvl", label: "TVL" },
  { key: "volume", label: "Volume" },
  { key: "apy", label: "APY" },
  { key: "fees", label: "Fees" },
];

function StatCard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function PoolsPage() {
  const [sortBy, setSortBy] = useState<SortKey>("tvl");

  const poolParams = { sortBy };
  const { data: poolsData, isLoading } = useListDexPools(
    poolParams,
    { query: { queryKey: getListDexPoolsQueryKey(poolParams), refetchInterval: 30000 } }
  );
  const swapParams = { limit: 10 };
  const { data: swapsData } = useListSwapTransactions(swapParams, { query: { queryKey: getListSwapTransactionsQueryKey(swapParams), refetchInterval: 15000 } });

  const pools = poolsData?.pools ?? [];
  const totalTvl = pools.reduce((s, p) => s + Number(p.tvlUsd), 0);
  const totalVol24 = pools.reduce((s, p) => s + Number(p.volume24h), 0);
  const totalFees24 = pools.reduce((s, p) => s + Number(p.fees24h), 0);

  const fmt = (n: number, unit = "M") => {
    if (unit === "M") return `$${(n / 1_000_000).toFixed(2)}M`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidity Pools</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Provide liquidity and earn trading fees on ZBX DEX</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Add Liquidity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total TVL" value={fmt(totalTvl)} sub="Across all pools" icon={Droplets} color="bg-blue-500/15 text-blue-400" />
        <StatCard title="24h Volume" value={fmt(totalVol24)} sub="Trading volume" icon={BarChart3} color="bg-primary/15 text-primary" />
        <StatCard title="24h Fees" value={fmt(totalFees24, "$")} sub="Distributed to LPs" icon={DollarSign} color="bg-green-500/15 text-green-400" />
        <StatCard title="Active Pools" value={String(pools.filter(p => p.isActive).length)} sub={`${pools.length} total`} icon={TrendingUp} color="bg-orange-500/15 text-orange-400" />
      </div>

      {/* Pool Table */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 rounded-lg p-1">
            <Filter className="h-3 w-3 ml-1" />
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => setSortBy(o.key)}
                className={cn("px-3 py-1.5 rounded-md font-medium transition-colors",
                  sortBy === o.key ? "bg-card text-foreground shadow-sm" : "hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{pools.length} pools</span>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-7 gap-3 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest bg-muted/20 border-b border-border/30">
          <div className="col-span-2">Pool</div>
          <div className="text-right">TVL</div>
          <div className="text-right">24h Volume</div>
          <div className="text-right">24h Fees</div>
          <div className="text-right">APY</div>
          <div className="text-right">Actions</div>
        </div>

        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-border/20 bg-muted/10 animate-pulse" />
          ))
        ) : (
          pools.map((pool, idx) => (
            <div
              key={pool.id}
              className="grid grid-cols-7 gap-3 px-5 py-4 items-center border-b border-border/20 hover:bg-muted/20 transition-colors"
            >
              <div className="col-span-2 flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground/50 w-4">{idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{pool.token0Symbol[0]}</span>
                  <span className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400 -ml-2 border-2 border-card">{pool.token1Symbol[0]}</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">{pool.pairName}</div>
                  <div className="text-xs text-muted-foreground">Fee {pool.feeTier}%</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">${(Number(pool.tvlUsd) / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">${(Number(pool.volume24h) / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">${Number(pool.fees24h).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">
                  {pool.apy}%
                </span>
              </div>
              <div className="text-right flex items-center justify-end gap-1.5">
                <button className="text-xs px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-colors font-medium">
                  Add
                </button>
                <button className="text-xs px-2 py-1 rounded-lg border border-border/40 hover:bg-muted transition-colors text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Swaps */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="font-semibold text-sm">Recent Swaps</h3>
        </div>
        <div className="divide-y divide-border/20">
          {swapsData?.swaps.slice(0, 8).map((swap) => (
            <div key={swap.id} className="grid grid-cols-5 gap-3 px-5 py-3 items-center text-sm hover:bg-muted/20 transition-colors">
              <div className="font-mono text-xs text-muted-foreground truncate">{swap.txHash.slice(0, 10)}…</div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{Number(swap.amountIn).toLocaleString()}</span>
                <span className="text-muted-foreground text-xs">{swap.tokenIn}</span>
              </div>
              <div className="text-center text-muted-foreground">→</div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{Number(swap.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                <span className="text-muted-foreground text-xs">{swap.tokenOut}</span>
              </div>
              <div className="text-right">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                  swap.status === "success" ? "bg-green-500/15 text-green-400" :
                  swap.status === "failed"  ? "bg-red-500/15 text-red-400" :
                  "bg-yellow-500/15 text-yellow-400"
                )}>
                  {swap.status}
                </span>
              </div>
            </div>
          )) ?? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/10 animate-pulse" />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
