import React, { useState, useMemo } from "react";
import {
  Droplets, TrendingUp, DollarSign, BarChart3, Plus, ExternalLink,
  X, ChevronDown, ChevronUp, ArrowRight, Activity, Zap, Info, Search,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar,
} from "recharts";
import {
  useListDexPools, useListSwapTransactions,
  getListDexPoolsQueryKey, getListSwapTransactionsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type SortKey = "tvl" | "volume" | "apy" | "fees";

const TC: Record<string, { color: string; bg: string }> = {
  ZBX:    { color: "#00FF87", bg: "#00FF8722" },
  ZBXUSD: { color: "#60A5FA", bg: "#60A5FA22" },
  ETH:    { color: "#818CF8", bg: "#818CF822" },
  BTC:    { color: "#FB923C", bg: "#FB923C22" },
  BNB:    { color: "#FBBF24", bg: "#FBBF2422" },
  USDT:   { color: "#34D399", bg: "#34D39922" },
  USDC:   { color: "#3B82F6", bg: "#3B82F622" },
};

function genSparkline(base: number, len = 20) {
  let p = base; const d = [];
  for (let i = 0; i < len; i++) { p *= 1 + (Math.random() - 0.495) * 0.04; d.push({ v: +p.toFixed(0) }); }
  return d;
}

/* ─── Stat Card ────────────────────────────────── */
function StatCard({ title, value, sub, icon: Icon, color, change }:
  { title: string; value: string; sub?: string; icon: React.ElementType; color: string; change?: number }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {change !== undefined && (
            <span className={cn("text-xs font-semibold", change >= 0 ? "text-green-400" : "text-red-400")}>
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pool Detail Panel ─────────────────────────── */
function PoolDetail({ pool, onClose, swaps }: { pool: any; onClose: () => void; swaps?: any[] }) {
  const t0 = TC[pool.token0Symbol] ?? { color: "#888", bg: "#88888820" };
  const t1 = TC[pool.token1Symbol] ?? { color: "#888", bg: "#88888820" };
  const volData = useMemo(() => genSparkline(Number(pool.volume24h) / 1e4, 30), [pool.id]);
  const [tab, setTab] = useState<"info" | "add" | "remove">("info");
  const [addAmt, setAddAmt] = useState("");

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden h-fit sticky top-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex">
            <span style={{ background: t0.bg, color: t0.color }} className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-black border">{pool.token0Symbol.slice(0, 3)}</span>
            <span style={{ background: t1.bg, color: t1.color }} className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-black border -ml-2.5">{pool.token1Symbol.slice(0, 3)}</span>
          </div>
          <div>
            <p className="font-bold text-sm">{pool.pairName}</p>
            <p className="text-xs text-muted-foreground">Fee {pool.feeTier}%</p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(["info", "add", "remove"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-2.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
            {t === "add" ? "+ Add Liquidity" : t === "remove" ? "− Remove" : "Info"}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {tab === "info" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "TVL",       value: `$${(Number(pool.tvlUsd) / 1e6).toFixed(2)}M` },
                { label: "24h Volume",value: `$${(Number(pool.volume24h) / 1e6).toFixed(2)}M` },
                { label: "24h Fees",  value: `$${Number(pool.fees24h).toLocaleString()}` },
                { label: "APY",       value: `${pool.apy}%`, green: true },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn("font-bold text-lg mt-0.5", s.green && "text-green-400")}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pool Reserves</p>
              <div className="space-y-2">
                {[
                  { sym: pool.token0Symbol, res: pool.token0Reserve, cfg: t0 },
                  { sym: pool.token1Symbol, res: pool.token1Reserve, cfg: t1 },
                ].map(r => {
                  const total = Number(pool.token0Reserve) + Number(pool.token1Reserve);
                  const pct = total > 0 ? (Number(r.res) / total) * 100 : 50;
                  return (
                    <div key={r.sym} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: r.cfg.color }} className="font-semibold">{r.sym}</span>
                        <span className="font-mono">{Number(r.res).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.cfg.color + "88" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volume (30 days)</p>
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={6}>
                    <Bar dataKey="v" fill="#00FF8760" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-[10px] font-mono text-muted-foreground truncate">{pool.contractAddress}</p>
            </div>
          </>
        )}

        {tab === "add" && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Deposit Amounts</p>
              {[pool.token0Symbol, pool.token1Symbol].map(sym => (
                <div key={sym} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                  <span style={{ color: TC[sym]?.color ?? "#888", background: TC[sym]?.bg ?? "#88888818" }}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black">
                    {sym.slice(0, 3)}
                  </span>
                  <input value={addAmt} onChange={e => setAddAmt(e.target.value)}
                    placeholder="0.00" type="number"
                    className="flex-1 bg-transparent text-right font-bold outline-none placeholder:text-muted-foreground/30" />
                  <span className="text-sm font-semibold">{sym}</span>
                </div>
              ))}
            </div>
            <div className="text-xs space-y-2 bg-muted/20 rounded-xl p-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Share of Pool</span><span>~0.00%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Current APY</span><span className="text-green-400">{pool.apy}%</span></div>
            </div>
            <button className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "linear-gradient(135deg, #00FF87, #00cc70)", color: "#000" }}>
              Add Liquidity
            </button>
          </div>
        )}

        {tab === "remove" && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Remove %</p>
              <div className="flex gap-2">
                {[25, 50, 75, 100].map(p => (
                  <button key={p}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border/40 hover:border-primary/40 hover:text-primary transition-colors">
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/20 rounded-xl p-3">
              <p>You will receive proportional amounts of {pool.token0Symbol} and {pool.token1Symbol} based on your LP position.</p>
            </div>
            <button className="w-full py-3 rounded-xl font-bold text-sm bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors">
              Remove Liquidity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Pool Row (extracted to allow useMemo) ─────── */
function PoolRow({ pool, idx, selected, setSelected }:
  { pool: any; idx: number; selected: number | null; setSelected: (id: number | null) => void }) {
  const t0 = TC[pool.token0Symbol] ?? { color: "#888", bg: "#88888820" };
  const t1 = TC[pool.token1Symbol] ?? { color: "#888", bg: "#88888820" };
  const isSelected = pool.id === selected;
  const sparkData = useMemo(() => genSparkline(Number(pool.volume24h) / 1e4, 15), [pool.id]);
  return (
    <div onClick={() => setSelected(isSelected ? null : pool.id)}
      className={cn(
        "grid grid-cols-2 md:grid-cols-7 gap-3 px-5 py-4 items-center border-b border-border/20 transition-all cursor-pointer",
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/20"
      )}>
      <div className="col-span-1 md:col-span-2 flex items-center gap-3">
        <span className="text-[10px] font-mono text-muted-foreground/40 w-4 hidden md:block">{idx + 1}</span>
        <div className="flex">
          <span style={{ background: t0.bg, color: t0.color }} className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black border">{pool.token0Symbol.slice(0, 3)}</span>
          <span style={{ background: t1.bg, color: t1.color }} className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black border -ml-2 border-card">{pool.token1Symbol.slice(0, 3)}</span>
        </div>
        <div>
          <p className="font-semibold text-sm">{pool.pairName}</p>
          <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{pool.feeTier}% fee</span>
        </div>
      </div>
      <div className="md:text-right col-span-1">
        <p className="font-semibold text-sm">${(Number(pool.tvlUsd) / 1e6).toFixed(2)}M</p>
        <div className="hidden md:block h-8 w-20 ml-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <Area dataKey="v" stroke={t0.color} strokeWidth={1} fill={t0.color + "20"} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="hidden md:block text-right"><p className="font-semibold text-sm">${(Number(pool.volume24h) / 1e6).toFixed(2)}M</p></div>
      <div className="hidden md:block text-right"><p className="font-semibold text-sm">${Number(pool.fees24h).toLocaleString()}</p></div>
      <div className="hidden md:block text-right">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-xl">{pool.apy}%</span>
      </div>
      <div className="hidden md:flex items-center justify-end gap-1.5">
        <button onClick={e => { e.stopPropagation(); setSelected(pool.id); }}
          className="text-xs px-2.5 py-1.5 rounded-xl font-semibold transition-colors"
          style={{ background: "#00FF8720", color: "#00FF87", border: "1px solid #00FF8730" }}>
          Add
        </button>
        <button className="text-xs px-2 py-1.5 rounded-xl border border-border/40 hover:bg-muted transition-colors text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Pools Page ───────────────────────────── */
export default function PoolsPage() {
  const [sortBy, setSortBy]     = useState<SortKey>("tvl");
  const [selected, setSelected] = useState<number | null>(null);
  const [search,   setSearch]   = useState("");

  const poolP = { sortBy };
  const { data: poolsData, isLoading } = useListDexPools(poolP,
    { query: { queryKey: getListDexPoolsQueryKey(poolP), refetchInterval: 30000 } });
  const { data: swapsData } = useListSwapTransactions({ limit: 20 },
    { query: { queryKey: getListSwapTransactionsQueryKey({ limit: 20 }), refetchInterval: 15000 } });

  const pools = poolsData?.pools ?? [];
  const filtered = pools.filter(p =>
    !search || p.pairName.toLowerCase().includes(search.toLowerCase())
  );
  const totalTvl  = pools.reduce((s, p) => s + Number(p.tvlUsd), 0);
  const totalVol  = pools.reduce((s, p) => s + Number(p.volume24h), 0);
  const totalFees = pools.reduce((s, p) => s + Number(p.fees24h), 0);
  const selectedPool = pools.find(p => p.id === selected) ?? null;

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "tvl",    label: "TVL" },
    { key: "volume", label: "Volume" },
    { key: "apy",    label: "APY" },
    { key: "fees",   label: "Fees" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Droplets className="h-6 w-6 text-primary" /> Liquidity Pools
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Provide liquidity and earn from every swap on ZBX DEX</p>
        </div>
        <button className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          style={{ background: "linear-gradient(135deg, #00FF87, #00cc70)", color: "#000" }}>
          <Plus className="h-4 w-4" /> New Position
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total TVL"    value={`$${(totalTvl / 1e6).toFixed(2)}M`}   sub="All pools" change={8.3}  icon={Droplets}  color="bg-blue-500/15 text-blue-400" />
        <StatCard title="24h Volume"   value={`$${(totalVol / 1e6).toFixed(2)}M`}   sub="Trading"   change={12.7} icon={BarChart3}  color="bg-primary/15 text-primary" />
        <StatCard title="24h Fees"     value={`$${totalFees.toLocaleString()}`}       sub="To LPs"    change={12.7} icon={DollarSign} color="bg-green-500/15 text-green-400" />
        <StatCard title="Active Pools" value={String(pools.filter(p => p.isActive).length)} sub={`${pools.length} total`} icon={TrendingUp} color="bg-orange-500/15 text-orange-400" />
      </div>

      {/* My Positions (simulated) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">My Positions</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {pools.slice(0, 3).map(pool => {
            const t0 = TC[pool.token0Symbol] ?? { color: "#888", bg: "#88888820" };
            const t1 = TC[pool.token1Symbol] ?? { color: "#888", bg: "#88888820" };
            const myTvl = (Number(pool.tvlUsd) * 0.0023);
            const earnings = myTvl * (Number(pool.apy) / 100) / 365;
            return (
              <div key={pool.id}
                className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setSelected(selected === pool.id ? null : pool.id)}>
                <div className="flex">
                  <span style={{ background: t0.bg, color: t0.color }} className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black">{pool.token0Symbol.slice(0, 3)}</span>
                  <span style={{ background: t1.bg, color: t1.color }} className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black -ml-2 border-2 border-card">{pool.token1Symbol.slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{pool.pairName}</p>
                  <p className="text-xs text-muted-foreground">Position: ${myTvl.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">+${earnings.toFixed(4)}</p>
                  <p className="text-[10px] text-muted-foreground">Today's yield</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pools Table + Detail Panel */}
      <div className={cn("grid gap-5", selected ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1")}>
        <div className={cn(selected ? "lg:col-span-2" : "")}>
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border/40">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search pools…"
                  className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-sm outline-none focus:border-primary/30" />
              </div>
              <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                {SORT_OPTS.map(o => (
                  <button key={o.key} onClick={() => setSortBy(o.key)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      sortBy === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length} pools</span>
            </div>

            {/* Header row */}
            <div className="hidden md:grid grid-cols-7 gap-3 px-5 py-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest bg-muted/10 border-b border-border/30">
              <div className="col-span-2">Pool</div>
              <div className="text-right">TVL</div>
              <div className="text-right">24h Volume</div>
              <div className="text-right">24h Fees</div>
              <div className="text-right">APY</div>
              <div className="text-right">Actions</div>
            </div>

            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 border-b border-border/20 animate-pulse bg-muted/10" />
              ))
            ) : (
              filtered.map((pool, idx) => (
                <PoolRow key={pool.id} pool={pool} idx={idx} selected={selected} setSelected={setSelected} />
              ))
            )}
          </div>
        </div>

        {/* Pool Detail Panel */}
        {selectedPool && (
          <div className="lg:col-span-1">
            <PoolDetail pool={selectedPool} onClose={() => setSelected(null)}
              swaps={swapsData?.swaps.filter(s => s.poolId === selectedPool.id)} />
          </div>
        )}
      </div>

      {/* Live Swap Feed */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Live Swap Activity</p>
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
          <span className="text-xs text-muted-foreground">{swapsData?.total ?? "—"} total swaps</span>
        </div>
        <div className="divide-y divide-border/20">
          {swapsData?.swaps.slice(0, 8).map(swap => (
            <div key={swap.id} className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 py-3 items-center text-sm hover:bg-muted/20 transition-colors">
              <div className="font-mono text-xs text-muted-foreground truncate col-span-1 md:col-span-1">{swap.txHash.slice(0, 12)}…</div>
              <div className="col-span-1 flex items-center gap-2">
                <span style={{ color: TC[swap.tokenIn]?.color ?? "#888", background: TC[swap.tokenIn]?.bg ?? "#88888818" }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {Number(swap.amountIn).toLocaleString(undefined, { maximumFractionDigits: 2 })} {swap.tokenIn}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 hidden md:block" />
                <span style={{ color: TC[swap.tokenOut]?.color ?? "#888", background: TC[swap.tokenOut]?.bg ?? "#88888818" }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full hidden md:inline">
                  {Number(swap.amountOut).toLocaleString(undefined, { maximumFractionDigits: 4 })} {swap.tokenOut}
                </span>
              </div>
              <div className="hidden md:block text-right text-xs text-muted-foreground">Impact: {swap.priceImpact}%</div>
              <div className="hidden md:block text-right text-xs font-mono text-muted-foreground/60">
                {swap.walletAddress?.slice(0, 8) ?? "0x??????"}…
              </div>
              <div className="hidden md:flex justify-end">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  swap.status === "success" ? "bg-green-500/15 text-green-400 border border-green-500/20" :
                  swap.status === "failed"  ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                  "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                )}>{swap.status}</span>
              </div>
            </div>
          )) ?? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/10 border-b border-border/20" />
          ))}
        </div>
      </div>
    </div>
  );
}
