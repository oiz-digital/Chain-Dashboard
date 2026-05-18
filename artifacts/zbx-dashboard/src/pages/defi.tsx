import React, { useState, useMemo } from "react";
import {
  Landmark, Activity, Droplets, ArrowUpRight, ArrowDownRight,
  TrendingUp, Shield, Zap, BarChart3, DollarSign, Globe,
  RefreshCw, Info, ChevronRight, Cpu,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useGetDefiStats, useListDexPools, getListDexPoolsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

/* ─── Mock data generators ────────────────────── */
function genTvlHistory(currentTvl: number) {
  let v = currentTvl * 0.72; const d = [];
  for (let i = 0; i < 90; i++) {
    v *= 1 + (Math.random() - 0.47) * 0.025;
    const date = new Date(); date.setDate(date.getDate() - (90 - i));
    d.push({ day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), tvl: +v.toFixed(0), vol: Math.round(v * 0.012 * Math.random() * 2) });
  }
  return d;
}

const YIELD_OPPORTUNITIES = [
  { name: "ZBX/ZBXUSD", protocol: "ZBX AMM", tvl: 8.4e6,  apy: 42.8, risk: "Low",    type: "LP",      tokens: ["ZBX", "ZBXUSD"] },
  { name: "ZBX Staking", protocol: "ZBX PoS", tvl: 21e6,   apy: 14.2, risk: "Low",    type: "Stake",   tokens: ["ZBX"] },
  { name: "ZBX/ETH",     protocol: "ZBX AMM", tvl: 3.2e6,  apy: 38.5, risk: "Medium", type: "LP",      tokens: ["ZBX", "ETH"] },
  { name: "ZBX/BTC",     protocol: "ZBX AMM", tvl: 2.8e6,  apy: 35.2, risk: "Medium", type: "LP",      tokens: ["ZBX", "BTC"] },
  { name: "ZBXUSD Lend", protocol: "ZBX Lend",tvl: 4.1e6,  apy: 8.9,  risk: "Low",    type: "Lend",    tokens: ["ZBXUSD"] },
  { name: "Bridge LP",   protocol: "ZBX IBC", tvl: 1.6e6,  apy: 22.1, risk: "Medium", type: "Bridge",  tokens: ["ZBX"] },
  { name: "ZBX/BNB",     protocol: "ZBX AMM", tvl: 1.9e6,  apy: 29.7, risk: "High",   type: "LP",      tokens: ["ZBX", "BNB"] },
];

const TC: Record<string, { color: string; bg: string }> = {
  ZBX:    { color: "#00FF87", bg: "#00FF8722" },
  ZBXUSD: { color: "#60A5FA", bg: "#60A5FA22" },
  ETH:    { color: "#818CF8", bg: "#818CF822" },
  BTC:    { color: "#FB923C", bg: "#FB923C22" },
  BNB:    { color: "#FBBF24", bg: "#FBBF2422" },
  USDT:   { color: "#34D399", bg: "#34D39922" },
};

const RISK_COLORS = { Low: "text-green-400 bg-green-500/10 border-green-500/20", Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", High: "text-red-400 bg-red-500/10 border-red-500/20" };
const TYPE_COLORS  = { LP: "bg-primary/10 text-primary border-primary/20", Stake: "bg-purple-500/10 text-purple-400 border-purple-500/20", Lend: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", Bridge: "bg-orange-500/10 text-orange-400 border-orange-500/20" };

/* ─── Protocol Card ────────────────────────────── */
function ProtocolCard({ title, tvl, apy, change, icon: Icon, color, desc, href, chartColor }:
  { title: string; tvl: number; apy?: number; change: number; icon: React.ElementType; color: string; desc: string; href?: string; chartColor: string }) {
  const sparkData = useMemo(() => {
    let v = tvl * 0.88; const d = [];
    for (let i = 0; i < 20; i++) { v *= 1 + (Math.random() - 0.47) * 0.03; d.push({ v: +v.toFixed(0) }); }
    return d;
  }, [tvl]);
  const isUp = change >= 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
          <Icon className="h-5 w-5" />
        </div>
        {href && (
          <Link href={href} className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
            View <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div>
        <p className="font-bold text-lg">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area dataKey="v" stroke={chartColor} strokeWidth={1.5} fill={`url(#grad-${title})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">TVL</p>
          <p className="font-bold text-sm">${(tvl / 1e6).toFixed(2)}M</p>
        </div>
        {apy !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Best APY</p>
            <p className="font-bold text-sm text-green-400">{apy}%</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">24h Change</p>
          <p className={cn("font-bold text-sm", isUp ? "text-green-400" : "text-red-400")}>
            {isUp ? "+" : ""}{change.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main DeFi Page ────────────────────────────── */
export default function DefiPage() {
  const { data: stats, isLoading } = useGetDefiStats();
  const { data: poolsData } = useListDexPools({}, { query: { queryKey: getListDexPoolsQueryKey({}), staleTime: 30000 } });
  const [tvlPeriod, setTvlPeriod] = useState<"30D" | "90D">("90D");
  const [sortYield, setSortYield] = useState<"apy" | "tvl">("apy");

  const totalTvl = Number(stats?.totalTvl ?? 0);
  const tvlData  = useMemo(() => genTvlHistory(totalTvl), [totalTvl]);
  const tvlSlice = tvlPeriod === "30D" ? tvlData.slice(-30) : tvlData;

  const isUp = (stats?.priceChange24h ?? 0) >= 0;

  const ammTvl     = Number(stats?.ammPoolTvl ?? 0);
  const stakingTvl = Number(stats?.stakingTvl ?? 0);
  const lendingTvl = Number(stats?.lendingTvl ?? 0);
  const bridgeTvl  = ammTvl * 0.1;

  const pieData = [
    { name: "AMM Pools",      value: ammTvl,     color: "#00FF87" },
    { name: "Liquid Staking", value: stakingTvl, color: "#818CF8" },
    { name: "Lending",        value: lendingTvl, color: "#34D399" },
    { name: "IBC Bridge",     value: bridgeTvl,  color: "#FB923C" },
  ];

  const sortedYields = [...YIELD_OPPORTUNITIES].sort((a, b) =>
    sortYield === "apy" ? b.apy - a.apy : b.tvl - a.tvl
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> DeFi Ecosystem
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete ZBX Chain financial infrastructure — swap, stake, lend, bridge</p>
        </div>
        {stats && (
          <div className="flex items-center gap-2 bg-card border border-border/60 px-4 py-2.5 rounded-xl font-mono">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground text-sm">ZBX</span>
            <span className="font-bold text-base">${Number(stats.zbxPrice).toFixed(4)}</span>
            <span className={cn("text-xs flex items-center gap-0.5 font-semibold", isUp ? "text-green-400" : "text-red-400")}>
              {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(stats.priceChange24h).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Value Locked", value: `$${(totalTvl / 1e6).toFixed(2)}M`,      sub: "All protocols",   icon: Droplets,  color: "text-primary",   change: 11.2 },
          { label: "24h Trading Volume", value: `$${(Number(stats?.dailyVolume ?? 0) / 1e6).toFixed(2)}M`, sub: "DEX only", icon: BarChart3, color: "text-blue-400",  change: 23.5 },
          { label: "24h Protocol Fees",  value: `$${Number(stats?.totalFees24h ?? 0).toLocaleString()}`, sub: "To liquidity providers", icon: DollarSign, color: "text-green-400", change: 23.5 },
          { label: "Active Users (24h)", value: "1,847",     sub: "+18% from yesterday",  icon: Activity,  color: "text-purple-400", change: 18.0 },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            {isLoading
              ? <div className="h-8 bg-muted/40 rounded-lg animate-pulse" />
              : <p className="text-2xl font-bold">{s.value}</p>
            }
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">{s.sub}</p>
              <span className="text-xs font-semibold text-green-400">+{s.change}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* TVL Chart + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Total Value Locked</p>
              <p className="text-xs text-muted-foreground mt-0.5">Historical TVL across all ZBX protocols</p>
            </div>
            <div className="flex gap-1">
              {(["30D", "90D"] as const).map(p => (
                <button key={p} onClick={() => setTvlPeriod(p)}
                  className={cn("text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
                    tvlPeriod === p ? "bg-primary/20 border-primary/30 text-primary" : "border-border/30 text-muted-foreground")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvlSlice} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00FF87" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  interval={tvlPeriod === "30D" ? 4 : 12} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} width={50} />
                <Tooltip contentStyle={{ background: "#0d0d16", border: "1px solid #ffffff18", borderRadius: 12, fontSize: 11 }}
                  formatter={(v: number) => [`$${(v / 1e6).toFixed(3)}M`, "TVL"]} />
                <Area dataKey="tvl" stroke="#00FF87" strokeWidth={2} fill="url(#tvlGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tvlSlice} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={3}>
                <Bar dataKey="vol" fill="#00FF8740" radius={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
          <p className="font-semibold">TVL Distribution</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0d0d16", border: "1px solid #ffffff18", borderRadius: 12, fontSize: 11 }}
                  formatter={(v: number) => [`$${(v / 1e6).toFixed(2)}M`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                <span className="text-xs font-semibold">${(d.value / 1e6).toFixed(2)}M</span>
                <span className="text-[10px] text-muted-foreground">{((d.value / totalTvl) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Protocol Cards */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ZBX Protocols</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ProtocolCard title="ZBX DEX" desc="AMM liquidity pools" tvl={ammTvl} apy={42.8} change={14.3}
            icon={Droplets} color="bg-primary/15 text-primary" chartColor="#00FF87" href="/pools" />
          <ProtocolCard title="Liquid Staking" desc="Validator delegation" tvl={stakingTvl} apy={14.2} change={5.1}
            icon={Shield} color="bg-purple-500/15 text-purple-400" chartColor="#818CF8" href="/staking" />
          <ProtocolCard title="ZBX Lend" desc="Money markets" tvl={lendingTvl} apy={9.4} change={8.9}
            icon={DollarSign} color="bg-cyan-500/15 text-cyan-400" chartColor="#34D399" />
          <ProtocolCard title="IBC Bridge" desc="Cross-chain liquidity" tvl={bridgeTvl} apy={22.1} change={31.2}
            icon={Globe} color="bg-orange-500/15 text-orange-400" chartColor="#FB923C" href="/ibc" />
        </div>
      </div>

      {/* Yield Opportunities */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <p className="font-semibold">Yield Opportunities</p>
            <p className="text-xs text-muted-foreground mt-0.5">Best APY across all ZBX protocols</p>
          </div>
          <div className="flex gap-1">
            {(["apy", "tvl"] as const).map(s => (
              <button key={s} onClick={() => setSortYield(s)}
                className={cn("text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all uppercase",
                  sortYield === s ? "bg-primary/20 border-primary/30 text-primary" : "border-border/40 text-muted-foreground")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border/20">
          <div className="hidden md:grid grid-cols-7 gap-3 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest bg-muted/10">
            <div className="col-span-2">Opportunity</div>
            <div>Protocol</div>
            <div className="text-right">TVL</div>
            <div className="text-right">APY</div>
            <div className="text-right">Risk</div>
            <div className="text-right">Action</div>
          </div>
          {sortedYields.map(y => (
            <div key={y.name} className="grid grid-cols-2 md:grid-cols-7 gap-3 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
              <div className="col-span-1 md:col-span-2 flex items-center gap-3">
                <div className="flex">
                  {y.tokens.map((tok, i) => (
                    <span key={tok} style={{ background: TC[tok]?.bg ?? "#88888820", color: TC[tok]?.color ?? "#888" }}
                      className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black border", i > 0 && "-ml-2 border-card")}>
                      {tok.slice(0, 3)}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-sm">{y.name}</p>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", TYPE_COLORS[y.type as keyof typeof TYPE_COLORS] ?? "")}>
                    {y.type}
                  </span>
                </div>
              </div>
              <div className="hidden md:block text-xs text-muted-foreground">{y.protocol}</div>
              <div className="hidden md:block text-right text-sm font-semibold">${(y.tvl / 1e6).toFixed(2)}M</div>
              <div className="col-span-1 md:block text-right md:text-right">
                <span className="text-xl font-black text-green-400">{y.apy}%</span>
                <p className="text-[10px] text-muted-foreground">APY</p>
              </div>
              <div className="hidden md:flex justify-end">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", RISK_COLORS[y.risk as keyof typeof RISK_COLORS] ?? "")}>
                  {y.risk}
                </span>
              </div>
              <div className="hidden md:flex justify-end">
                <button className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                  style={{ background: "#00FF8720", color: "#00FF87", border: "1px solid #00FF8730" }}>
                  Deposit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI + ZBX stats footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-fuchsia-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-fuchsia-500/15 flex items-center justify-center flex-shrink-0">
            <Cpu className="h-6 w-6 text-fuchsia-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold">AI-Powered DeFi</p>
            <p className="text-xs text-muted-foreground mt-0.5">ZEP-009: On-chain AI inference optimizes routing, predicts impermanent loss, and detects MEV attacks in real time</p>
          </div>
          <Link href="/ai-features" className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors flex-shrink-0">
            Learn →
          </Link>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl p-5">
          <p className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> ZBX Token Metrics</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Market Cap</p>
              <p className="font-bold text-sm">${(Number(stats?.zbxPrice ?? 0.0847) * 500e6 / 1e6).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Circulating</p>
              <p className="font-bold text-sm">51.4M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Supply</p>
              <p className="font-bold text-sm">500M</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
