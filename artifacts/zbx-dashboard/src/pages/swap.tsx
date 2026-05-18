import React, { useState, useEffect } from "react";
import { ArrowUpDown, Info, Zap, RefreshCw, ChevronDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  useGetSwapQuote,
  useListDexPools,
  getGetSwapQuoteQueryKey,
  getListDexPoolsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const TOKENS = ["ZBX", "ZBXUSD", "ETH", "BTC", "BNB", "USDT"];

function TokenSelector({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-muted/60 hover:bg-muted border border-border/60 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
      >
        <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
          {value[0]}
        </span>
        {value}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border/60 rounded-xl shadow-xl p-1 min-w-[120px]">
          {TOKENS.filter(t => t !== exclude).map(t => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false); }}
              className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors",
                t === value ? "text-primary font-semibold" : "text-foreground")}
            >
              <span className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{t[0]}</span>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SwapPage() {
  const [tokenIn, setTokenIn] = useState("ZBX");
  const [tokenOut, setTokenOut] = useState("ZBXUSD");
  const [amountIn, setAmountIn] = useState("1000");
  const [slippage, setSlippage] = useState("0.5");
  const [swapStatus, setSwapStatus] = useState<"idle" | "confirming" | "success">("idle");

  const quoteParams = { tokenIn, tokenOut, amountIn, slippage };
  const { data: quote, isLoading: quoteLoading, refetch } = useGetSwapQuote(
    quoteParams,
    { query: { queryKey: getGetSwapQuoteQueryKey(quoteParams), enabled: Number(amountIn) > 0, refetchInterval: 12000 } }
  );
  const poolParams = {};
  const { data: poolsData } = useListDexPools(poolParams, { query: { queryKey: getListDexPoolsQueryKey(poolParams), staleTime: 30000 } });

  const flip = () => {
    const prevIn = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(prevIn);
    setAmountIn(quote?.amountOut ?? amountIn);
  };

  const handleSwap = () => {
    if (!quote) return;
    setSwapStatus("confirming");
    setTimeout(() => setSwapStatus("success"), 1800);
    setTimeout(() => setSwapStatus("idle"), 5000);
  };

  const priceImpact = Number(quote?.priceImpact ?? 0);
  const impactColor = priceImpact < 0.1 ? "text-green-400" : priceImpact < 0.5 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Swap</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trade tokens instantly via ZBX AMM pools</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 border border-border/40 rounded-lg px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          ZBX DEX · AMM v2
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Swap Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3 shadow-sm">
            {/* From */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You Pay</span>
                <span>Balance: —</span>
              </div>
              <div className="flex items-center gap-3">
                <TokenSelector value={tokenIn} onChange={setTokenIn} exclude={tokenOut} />
                <input
                  type="number"
                  value={amountIn}
                  onChange={e => setAmountIn(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-right text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="text-right text-xs text-muted-foreground">
                ≈ ${(Number(amountIn) * 0.0847).toFixed(2)} USD
              </div>
            </div>

            {/* Flip button */}
            <div className="flex justify-center">
              <button
                onClick={flip}
                className="h-9 w-9 rounded-xl bg-card border border-border/60 hover:bg-muted flex items-center justify-center transition-all hover:rotate-180 duration-300 shadow-sm"
              >
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* To */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You Receive</span>
                <button onClick={() => refetch()} className="hover:text-foreground transition-colors">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <TokenSelector value={tokenOut} onChange={setTokenOut} exclude={tokenIn} />
                <div className="flex-1 text-right text-2xl font-bold text-foreground">
                  {quoteLoading ? (
                    <span className="text-muted-foreground animate-pulse">...</span>
                  ) : (
                    <span className="text-green-400">{quote ? Number(quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0.0"}</span>
                  )}
                </div>
              </div>
              {quote && (
                <div className="text-right text-xs text-muted-foreground">
                  1 {tokenIn} = {Number(quote.executionPrice).toFixed(6)} {tokenOut}
                </div>
              )}
            </div>

            {/* Slippage */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Slippage Tolerance</span>
              {["0.1", "0.5", "1.0"].map(s => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={cn("text-xs px-2.5 py-1 rounded-lg border transition-colors",
                    slippage === s
                      ? "bg-primary/20 border-primary/40 text-primary font-semibold"
                      : "border-border/40 text-muted-foreground hover:bg-muted")}
                >
                  {s}%
                </button>
              ))}
            </div>

            {/* Quote details */}
            {quote && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={impactColor}>{quote.priceImpact}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min. Received</span>
                  <span>{Number(quote.minimumReceived).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee (0.3%)</span>
                  <span>{Number(quote.fee).toFixed(4)} {tokenIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <span className="font-mono">{quote.route.join(" → ")}</span>
                </div>
              </div>
            )}

            {/* Swap Button */}
            {swapStatus === "success" ? (
              <div className="w-full rounded-xl py-3.5 bg-green-500/15 border border-green-500/30 flex items-center justify-center gap-2 text-green-400 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Swap Successful!
              </div>
            ) : (
              <button
                onClick={handleSwap}
                disabled={!quote || quoteLoading || swapStatus === "confirming" || Number(amountIn) <= 0}
                className="w-full rounded-xl py-3.5 bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {swapStatus === "confirming" ? "Confirming…" : `Swap ${tokenIn} → ${tokenOut}`}
              </button>
            )}

            {priceImpact >= 0.5 && (
              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                High price impact ({priceImpact.toFixed(2)}%). Consider splitting your trade.
              </div>
            )}
          </div>
        </div>

        {/* Pools Overview */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Top Liquidity Pools</h3>
            <div className="space-y-2">
              {poolsData?.pools.slice(0, 6).map((pool) => (
                <div key={pool.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30">
                  <div className="flex items-center gap-1.5">
                    <span className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">{pool.token0Symbol[0]}</span>
                    <span className="h-7 w-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-[11px] font-bold text-cyan-400 -ml-1.5">{pool.token1Symbol[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{pool.pairName}</div>
                    <div className="text-xs text-muted-foreground">Fee: {pool.feeTier}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">${(Number(pool.tvlUsd) / 1_000_000).toFixed(2)}M</div>
                    <div className="text-xs text-muted-foreground">TVL</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-400">{pool.apy}%</div>
                    <div className="text-xs text-muted-foreground">APY</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">${(Number(pool.volume24h) / 1_000_000).toFixed(2)}M</div>
                    <div className="text-xs text-muted-foreground">24h Vol</div>
                  </div>
                </div>
              )) ?? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
