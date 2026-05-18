import React, { useState, useMemo, useCallback } from "react";
import {
  ArrowUpDown, Settings2, ChevronDown, AlertTriangle, CheckCircle2,
  RefreshCw, Zap, TrendingUp, Droplets, Clock, X, Info,
  ArrowRight, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useGetSwapQuote, useListDexPools, useListSwapTransactions,
  getGetSwapQuoteQueryKey, getListDexPoolsQueryKey, getListSwapTransactionsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

/* ─── Token config ─────────────────────────────────────────────────── */
const TC: Record<string, { color: string; bg: string; name: string; usd: number }> = {
  ZBX:    { color: "#00FF87", bg: "#00FF8722", name: "Zebvix",   usd: 0.0847 },
  ZBXUSD: { color: "#60A5FA", bg: "#60A5FA22", name: "ZBX USD",  usd: 1.0 },
  ETH:    { color: "#818CF8", bg: "#818CF822", name: "Ethereum", usd: 3182.0 },
  BTC:    { color: "#FB923C", bg: "#FB923C22", name: "Bitcoin",  usd: 67800.0 },
  BNB:    { color: "#FBBF24", bg: "#FBBF2422", name: "BNB",      usd: 589.0 },
  USDT:   { color: "#34D399", bg: "#34D39922", name: "Tether",   usd: 1.0 },
  USDC:   { color: "#3B82F6", bg: "#3B82F622", name: "USD Coin", usd: 1.0 },
};
const TOKENS = Object.keys(TC);

/* ─── Price chart data generator ───────────────────────────────────── */
function genChart(base: number, len: number) {
  let p = base; const d = [];
  for (let i = 0; i < len; i++) {
    p *= 1 + (Math.random() - 0.498) * 0.015;
    d.push({ i, price: +p.toFixed(8), vol: Math.round(Math.random() * 120_000 + 20_000) });
  }
  return d;
}

/* ─── Token Icon ────────────────────────────────────────────────────── */
function TIcon({ symbol, size = 7 }: { symbol: string; size?: number }) {
  const t = TC[symbol] ?? { color: "#888", bg: "#88888822", name: symbol };
  return (
    <span style={{ background: t.bg, color: t.color, width: `${size * 4}px`, height: `${size * 4}px` }}
      className="rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 border"
     >
      {symbol.slice(0, 3)}
    </span>
  );
}

/* ─── Token Selector ────────────────────────────────────────────────── */
function TokenSelector({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string }) {
  const [open, setOpen] = useState(false);
  const t = TC[value] ?? TC.ZBX;
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:opacity-90"
        style={{ background: t.bg, borderColor: t.color + "40", color: t.color }}>
        <span className="text-xs font-black">{value}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 z-50 bg-card border border-border/60 rounded-2xl shadow-2xl p-2 min-w-[200px]">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1.5">Select Token</p>
            {TOKENS.filter(t => t !== exclude).map(tok => (
              <button key={tok} onClick={() => { onChange(tok); setOpen(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-muted/60",
                  tok === value && "bg-muted/60")}>
                <span style={{ background: TC[tok].bg, color: TC[tok].color }}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black border"
                 >
                  {tok.slice(0, 3)}
                </span>
                <div className="text-left">
                  <p className="font-semibold text-sm">{tok}</p>
                  <p className="text-xs text-muted-foreground">{TC[tok].name}</p>
                </div>
                <p className="ml-auto text-xs text-muted-foreground">${TC[tok].usd < 1 ? TC[tok].usd.toFixed(4) : TC[tok].usd.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Settings Popover ──────────────────────────────────────────────── */
function SwapSettings({ slippage, setSlippage, deadline, setDeadline, mev, setMev, onClose }:
  { slippage: string; setSlippage: (v: string) => void; deadline: string; setDeadline: (v: string) => void;
    mev: boolean; setMev: (v: boolean) => void; onClose: () => void }) {
  return (
    <div className="absolute top-12 right-0 z-50 bg-card border border-border/60 rounded-2xl shadow-2xl p-5 w-72">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-sm">Transaction Settings</p>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Slippage Tolerance</p>
          <div className="flex items-center gap-2">
            {["0.1", "0.5", "1.0"].map(s => (
              <button key={s} onClick={() => setSlippage(s)}
                className={cn("flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  slippage === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/30")}>
                {s}%
              </button>
            ))}
            <input value={slippage} onChange={e => setSlippage(e.target.value)}
              className="flex-1 bg-muted/40 border border-border/40 rounded-xl px-2 py-1.5 text-xs text-right outline-none focus:border-primary/40"
              placeholder="Custom" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Transaction Deadline</p>
          <div className="flex items-center gap-2">
            <input value={deadline} onChange={e => setDeadline(e.target.value)}
              className="flex-1 bg-muted/40 border border-border/40 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary/40" />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">MEV Protection</p>
            <p className="text-[10px] text-muted-foreground">Route via private mempool</p>
          </div>
          <button onClick={() => setMev(!mev)}
            className={cn("w-10 h-5 rounded-full transition-all relative", mev ? "bg-primary" : "bg-muted/60")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", mev ? "left-5" : "left-0.5")} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Price Chart ───────────────────────────────────────────────────── */
const PERIODS = ["1H", "4H", "1D", "1W"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_LEN: Record<Period, number> = { "1H": 60, "4H": 96, "1D": 144, "1W": 168 };

function PriceChart({ tokenIn, tokenOut }: { tokenIn: string; tokenOut: string }) {
  const [period, setPeriod] = useState<Period>("1D");
  const basePrice = (TC[tokenIn]?.usd ?? 0.0847) / (TC[tokenOut]?.usd ?? 1);
  const data = useMemo(() => genChart(basePrice, PERIOD_LEN[period]), [tokenIn, tokenOut, period]);
  const first = data[0]?.price ?? 0;
  const last  = data[data.length - 1]?.price ?? 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{tokenIn}/{tokenOut} Price</p>
          <p className="text-2xl font-bold font-mono mt-0.5">
            {last < 1 ? last.toFixed(6) : last.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </p>
          <span className={cn("text-xs font-semibold", isUp ? "text-green-400" : "text-red-400")}>
            {isUp ? "+" : ""}{change.toFixed(2)}%
          </span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("text-xs px-2.5 py-1 rounded-lg border font-medium transition-all",
                period === p ? "bg-primary/20 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/20")}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? "#00FF87" : "#f87171"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isUp ? "#00FF87" : "#f87171"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip contentStyle={{ background: "#0d0d16", border: "1px solid #ffffff18", borderRadius: 12, fontSize: 11 }}
              formatter={(v: number) => [v < 1 ? v.toFixed(6) : v.toFixed(4), "Price"]}
              labelFormatter={() => ""} />
            <Area dataKey="price" stroke={isUp ? "#00FF87" : "#f87171"} strokeWidth={1.5}
              fill="url(#chartGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={2}>
            <Bar dataKey="vol" fill="#ffffff15" radius={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Route Visualizer ──────────────────────────────────────────────── */
function RouteViz({ route, tokenIn, tokenOut }: { route?: string[]; tokenIn: string; tokenOut: string }) {
  const path = route && route.length > 0 ? route : [tokenIn, tokenOut];
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Best Route</p>
        <span className="ml-auto text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">Optimal</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {path.map((tok, i) => (
          <React.Fragment key={i}>
            <span style={{ background: (TC[tok]?.bg ?? "#88888820"), color: (TC[tok]?.color ?? "#888"), borderColor: (TC[tok]?.color ?? "#888") + "44" }}
              className="text-xs font-bold px-2.5 py-1 rounded-full border">
              {tok}
            </span>
            {i < path.length - 1 && (
              <div className="flex items-center gap-0.5">
                <div className="h-px w-3 bg-border/60" />
                <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                <div className="h-px w-3 bg-border/60" />
              </div>
            )}
          </React.Fragment>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">100%</span>
      </div>
    </div>
  );
}

/* ─── Main Swap Page ────────────────────────────────────────────────── */
export default function SwapPage() {
  const [tokenIn,  setTokenIn]  = useState("ZBX");
  const [tokenOut, setTokenOut] = useState("ZBXUSD");
  const [amountIn, setAmountIn] = useState("1000");
  const [slippage, setSlippage] = useState("0.5");
  const [deadline, setDeadline] = useState("20");
  const [mev,      setMev]      = useState(false);
  const [settings, setSettings] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "confirming" | "success">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const quoteP = { tokenIn, tokenOut, amountIn, slippage };
  const { data: quote, isLoading: quoteLoading, refetch } = useGetSwapQuote(quoteP,
    { query: { queryKey: getGetSwapQuoteQueryKey(quoteP), enabled: Number(amountIn) > 0, refetchInterval: 8000 } });
  const { data: poolsData } = useListDexPools({},
    { query: { queryKey: getListDexPoolsQueryKey({}), staleTime: 30000 } });
  const { data: swapsData } = useListSwapTransactions({ limit: 6 },
    { query: { queryKey: getListSwapTransactionsQueryKey({ limit: 6 }), refetchInterval: 10000 } });

  const flip = () => {
    const prev = tokenIn;
    setTokenIn(tokenOut); setTokenOut(prev);
    setAmountIn(quote?.amountOut ?? amountIn);
  };

  const handleSwap = () => {
    if (!quote) return;
    setConfirmOpen(false);
    setStatus("confirming");
    setTimeout(() => setStatus("success"), 2000);
    setTimeout(() => setStatus("idle"), 6000);
  };

  const priceImpact = Number(quote?.priceImpact ?? 0);
  const impactColor = priceImpact < 0.1 ? "text-green-400" : priceImpact < 0.5 ? "text-yellow-400" : "text-red-400";
  const impactBg    = priceImpact < 0.1 ? "bg-green-500" : priceImpact < 0.5 ? "bg-yellow-500" : "bg-red-500";
  const usdIn  = (Number(amountIn) * (TC[tokenIn]?.usd ?? 0.0847));
  const usdOut = quote ? (Number(quote.amountOut) * (TC[tokenOut]?.usd ?? 1)) : 0;

  const poolForPair = poolsData?.pools.find(p =>
    (p.token0Symbol === tokenIn && p.token1Symbol === tokenOut) ||
    (p.token0Symbol === tokenOut && p.token1Symbol === tokenIn)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" /> Swap
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trade instantly with ZBX AMM — best price, lowest slippage</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            ZBX DEX · AMM v2 · {poolsData?.pools.length ?? "—"} pools
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Swap Card ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 shadow-lg space-y-3">
            {/* Card header */}
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Swap Tokens</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => refetch()} title="Refresh quote"
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className={cn("h-3.5 w-3.5", quoteLoading && "animate-spin")} />
                </button>
                <div className="relative">
                  <button onClick={() => setSettings(s => !s)}
                    className={cn("p-1.5 rounded-lg hover:bg-muted transition-colors relative",
                      settings ? "bg-primary/20 text-primary" : "text-muted-foreground")}>
                    <Settings2 className="h-3.5 w-3.5" />
                    {mev && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                  </button>
                  {settings && (
                    <SwapSettings slippage={slippage} setSlippage={setSlippage}
                      deadline={deadline} setDeadline={setDeadline}
                      mev={mev} setMev={setMev} onClose={() => setSettings(false)} />
                  )}
                </div>
              </div>
            </div>

            {/* You Pay */}
            <div className="rounded-xl border border-border/40 bg-muted/30 p-4 space-y-2 hover:border-border/60 transition-colors">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You Pay</span>
                <button className="hover:text-primary transition-colors">Balance: — MAX</button>
              </div>
              <div className="flex items-center gap-3">
                <TokenSelector value={tokenIn} onChange={setTokenIn} exclude={tokenOut} />
                <input type="number" value={amountIn} onChange={e => setAmountIn(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-right text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{TC[tokenIn]?.name}</span>
                <span className="text-xs text-muted-foreground">
                  ≈ ${usdIn < 1 ? usdIn.toFixed(4) : usdIn.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Flip */}
            <div className="flex justify-center relative -my-1">
              <button onClick={flip}
                className="h-10 w-10 rounded-xl bg-card border border-border/60 hover:bg-muted flex items-center justify-center transition-all hover:rotate-180 duration-300 shadow-md z-10">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* You Receive */}
            <div className="rounded-xl border border-border/40 bg-muted/30 p-4 space-y-2 hover:border-border/60 transition-colors">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You Receive</span>
                <span className="text-xs">Balance: —</span>
              </div>
              <div className="flex items-center gap-3">
                <TokenSelector value={tokenOut} onChange={setTokenOut} exclude={tokenIn} />
                <div className="flex-1 text-right">
                  {quoteLoading ? (
                    <div className="h-8 bg-muted/60 rounded-lg animate-pulse ml-auto w-24" />
                  ) : (
                    <span className={cn("text-2xl font-bold", quote ? "text-green-400" : "text-muted-foreground/30")}>
                      {quote ? Number(quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0.0"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                {quote ? (
                  <span className="text-xs text-muted-foreground">
                    1 {tokenIn} = {Number(quote.executionPrice).toFixed(6)} {tokenOut}
                  </span>
                ) : <span />}
                {usdOut > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ≈ ${usdOut < 1 ? usdOut.toFixed(4) : usdOut.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* Quote details */}
            {quote && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Price Impact
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", impactBg)}
                        style={{ width: `${Math.min(100, priceImpact * 100)}%` }} />
                    </div>
                    <span className={cn("font-semibold", impactColor)}>{quote.priceImpact}%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min. Received</span>
                  <span className="font-medium">{Number(quote.minimumReceived).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trading Fee (0.3%)</span>
                  <span className="font-medium">{Number(quote.fee).toFixed(4)} {tokenIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Deadline</span>
                  <span>{deadline} min</span>
                </div>
                {mev && (
                  <div className="flex justify-between text-green-400">
                    <span className="flex items-center gap-1"><Info className="h-3 w-3" /> MEV Protection</span>
                    <span>Active</span>
                  </div>
                )}
              </div>
            )}

            {/* High impact warning */}
            {priceImpact >= 0.5 && (
              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                High price impact ({priceImpact.toFixed(2)}%). Consider splitting into smaller trades.
              </div>
            )}

            {/* Swap Button */}
            {status === "success" ? (
              <div className="w-full rounded-xl py-4 bg-green-500/15 border border-green-500/30 flex items-center justify-center gap-2 text-green-400 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                Swap Successful!
              </div>
            ) : (
              <button onClick={() => quote && setConfirmOpen(true)}
                disabled={!quote || quoteLoading || status === "confirming" || Number(amountIn) <= 0}
                className="w-full rounded-xl py-4 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #00FF87, #00cc70)", color: "#000" }}>
                {status === "confirming" ? "Confirming…" : !quote ? "Enter an amount" : `Swap ${tokenIn} → ${tokenOut}`}
              </button>
            )}
          </div>

          {/* Pool stats for pair */}
          {poolForPair && (
            <div className="bg-card border border-border/60 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pool Stats</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">TVL</p>
                  <p className="font-bold text-sm">${(Number(poolForPair.tvlUsd) / 1e6).toFixed(2)}M</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">24h Vol</p>
                  <p className="font-bold text-sm">${(Number(poolForPair.volume24h) / 1e6).toFixed(2)}M</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">APY</p>
                  <p className="font-bold text-sm text-green-400">{poolForPair.apy}%</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ──────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <PriceChart tokenIn={tokenIn} tokenOut={tokenOut} />
          <RouteViz route={quote?.route} tokenIn={tokenIn} tokenOut={tokenOut} />

          {/* Recent Swaps */}
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <p className="font-semibold text-sm">Recent Swaps</p>
              <span className="text-xs text-muted-foreground">{swapsData?.total ?? "—"} total</span>
            </div>
            <div className="divide-y divide-border/20">
              {swapsData?.swaps.slice(0, 6).map(swap => (
                <div key={swap.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span style={{ color: TC[swap.tokenIn]?.color ?? "#888", background: TC[swap.tokenIn]?.bg ?? "#88888818" }}
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                     >
                      {swap.tokenIn}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    <span style={{ color: TC[swap.tokenOut]?.color ?? "#888", background: TC[swap.tokenOut]?.bg ?? "#88888818" }}
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                     >
                      {swap.tokenOut}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">{Number(swap.amountIn).toLocaleString(undefined, { maximumFractionDigits: 2 })} {swap.tokenIn}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{swap.txHash.slice(0, 8)}…</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    swap.status === "success" ? "bg-green-500/15 text-green-400" :
                    swap.status === "failed"  ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"
                  )}>{swap.status}</span>
                </div>
              )) ?? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted/10" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmOpen && quote && (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">Confirm Swap</p>
                <button onClick={() => setConfirmOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">{Number(amountIn).toLocaleString()} {tokenIn}</p>
                  <p className="text-muted-foreground text-sm mt-1">≈ ${usdIn.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="flex justify-center"><ArrowUpDown className="h-5 w-5 text-primary" /></div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">{Number(quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenOut}</p>
                  <p className="text-muted-foreground text-sm mt-1">≈ ${usdOut.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="text-xs space-y-2 bg-muted/20 rounded-xl p-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Price Impact</span><span className={impactColor}>{quote.priceImpact}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Min. Received</span><span>{Number(quote.minimumReceived).toFixed(6)} {tokenOut}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span>{Number(quote.fee).toFixed(4)} {tokenIn}</span></div>
              </div>
              <button onClick={handleSwap}
                className="w-full rounded-xl py-3.5 font-bold text-sm"
                style={{ background: "linear-gradient(135deg, #00FF87, #00cc70)", color: "#000" }}>
                Confirm Swap
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
