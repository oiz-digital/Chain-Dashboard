import React, { useState } from "react";
import { Shield, TrendingUp, Users, Coins, Lock, Info, ChevronRight, Star } from "lucide-react";
import {
  useGetStakingOverview,
  useGetStakingValidators,
  getGetStakingOverviewQueryKey,
  getGetStakingValidatorsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function StatCard({ title, value, sub, icon: Icon, color, badge }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string; badge?: string;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] font-mono bg-green-500/15 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const TABS = ["Validators", "My Delegations", "Liquid Staking"] as const;
type Tab = typeof TABS[number];

export default function StakingPage() {
  const [tab, setTab] = useState<Tab>("Validators");
  const [stakeAmount, setStakeAmount] = useState("10000");
  const [selectedValidator, setSelectedValidator] = useState<number | null>(null);
  const [delegateStatus, setDelegateStatus] = useState<"idle" | "confirming" | "success">("idle");

  const valsParams = {};
  const { data: overview } = useGetStakingOverview({ query: { queryKey: getGetStakingOverviewQueryKey(), refetchInterval: 30000 } });
  const { data: valsData, isLoading } = useGetStakingValidators(valsParams, { query: { queryKey: getGetStakingValidatorsQueryKey(valsParams), refetchInterval: 30000 } });

  const validators = valsData?.validators ?? [];

  const handleDelegate = () => {
    if (!selectedValidator) return;
    setDelegateStatus("confirming");
    setTimeout(() => setDelegateStatus("success"), 2000);
    setTimeout(() => setDelegateStatus("idle"), 5000);
  };

  const totalStakedM = overview ? (Number(overview.totalStaked) / 1_000_000).toFixed(1) : "—";
  const liquidTvlM = overview ? (Number(overview.liquidStakingTvl) / 1_000_000).toFixed(2) : "—";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Delegate ZBX to validators and earn staking rewards</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-card border border-border/60 rounded-xl px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-semibold text-primary">{overview?.stakingApr ?? "—"}%</span>
          <span className="text-muted-foreground">Current APR</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Staked"
          value={`${totalStakedM}M ZBX`}
          sub={`${overview?.inflationRate ?? "—"}% inflation rate`}
          icon={Coins}
          color="bg-primary/15 text-primary"
        />
        <StatCard
          title="Staking APR"
          value={`${overview?.stakingApr ?? "—"}%`}
          sub="Current annualized rate"
          icon={TrendingUp}
          color="bg-green-500/15 text-green-400"
          badge="LIVE"
        />
        <StatCard
          title="Delegators"
          value={overview?.totalDelegators?.toLocaleString() ?? "—"}
          sub={`${overview?.activeValidators ?? "—"} active validators`}
          icon={Users}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          title="Liquid Staking TVL"
          value={`$${liquidTvlM}M`}
          sub="zbZBX liquid token"
          icon={Lock}
          color="bg-purple-500/15 text-purple-400"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-semibold text-primary">Unbonding Period:</span>
          <span className="text-muted-foreground ml-2">
            {overview?.unbondingPeriodDays ?? 21} days. Minimum stake: {Number(overview?.minStakeAmount ?? 1000).toLocaleString()} ZBX.
            Rewards distributed every block (~{(24 * 3600 / 6).toLocaleString()} blocks/day).
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Validator list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/40 border border-border/40 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Validators" && (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest bg-muted/20 border-b border-border/30">
                <div className="col-span-2">Validator</div>
                <div className="text-right">Staked</div>
                <div className="text-right">Commission</div>
                <div className="text-right">APR</div>
                <div className="text-right">Uptime</div>
              </div>

              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 border-b border-border/20 animate-pulse bg-muted/10" />
                ))
              ) : (
                validators.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedValidator(v.id === selectedValidator ? null : v.id)}
                    className={cn(
                      "grid grid-cols-6 gap-2 px-5 py-3.5 items-center border-b border-border/20 cursor-pointer transition-colors",
                      selectedValidator === v.id
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "hover:bg-muted/20"
                    )}
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground/50 w-4">#{v.rank}</span>
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/20">
                        {v.moniker.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1">
                          {v.moniker}
                          {v.rank <= 3 && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{v.address.slice(0, 12)}…</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{(Number(v.totalStaked) / 1_000_000).toFixed(1)}M</div>
                      <div className="text-xs text-muted-foreground">ZBX</div>
                    </div>
                    <div className="text-right text-sm font-semibold">{v.commission}%</div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-400">{v.apr}%</span>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-sm font-semibold",
                        Number(v.uptime) >= 99.5 ? "text-green-400" :
                        Number(v.uptime) >= 99 ? "text-yellow-400" : "text-red-400"
                      )}>{v.uptime}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "My Delegations" && (
            <div className="bg-card border border-border/60 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 shadow-sm min-h-48">
              <Shield className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Connect your wallet to see delegations</p>
              <button className="text-sm font-semibold text-primary border border-primary/30 bg-primary/10 px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                Connect Wallet
              </button>
            </div>
          )}

          {tab === "Liquid Staking" && (
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="space-y-1">
                <h3 className="font-semibold">zbZBX — Liquid Staked ZBX</h3>
                <p className="text-sm text-muted-foreground">Stake ZBX and receive zbZBX tokens that accrue staking rewards while remaining liquid.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Exchange Rate", value: "1 zbZBX = 1.0842 ZBX" },
                  { label: "Liquid APR",    value: `${overview?.stakingApr ?? "—"}%` },
                  { label: "TVL",           value: `$${liquidTvlM}M` },
                  { label: "Protocol Fee",  value: "5%" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-muted/30 border border-border/30 p-3">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delegate Panel */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm">Delegate ZBX</h3>

            {selectedValidator ? (
              <>
                {(() => {
                  const v = validators.find(x => x.id === selectedValidator);
                  return v ? (
                    <div className="rounded-xl bg-primary/8 border border-primary/20 p-3 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                        {v.moniker.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{v.moniker}</div>
                        <div className="text-xs text-muted-foreground">APR {v.apr}% · Commission {v.commission}%</div>
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Amount (ZBX)</label>
                  <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                    <button
                      onClick={() => setStakeAmount("100000")}
                      className="text-xs text-primary font-medium hover:text-primary/80"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Estimated rewards */}
                {(() => {
                  const v = validators.find(x => x.id === selectedValidator);
                  const apr = v ? Number(v.apr) : Number(overview?.stakingApr ?? 0);
                  const daily = (Number(stakeAmount) * apr / 100) / 365;
                  const zbxP = overview?.zbxPrice ?? 0.0847;
                  return (
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Daily Reward</span>
                        <span>{daily.toFixed(2)} ZBX</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Monthly</span>
                        <span>{(daily * 30).toFixed(2)} ZBX</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Yearly</span>
                        <span className="text-green-400 font-semibold">{(daily * 365).toFixed(0)} ZBX ≈ ${(daily * 365 * Number(zbxP)).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                {delegateStatus === "success" ? (
                  <div className="w-full rounded-xl py-3 bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm text-center">
                    Delegation Submitted!
                  </div>
                ) : (
                  <button
                    onClick={handleDelegate}
                    disabled={Number(stakeAmount) < 1000 || delegateStatus === "confirming"}
                    className="w-full rounded-xl py-3 bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {delegateStatus === "confirming" ? "Confirming…" : `Delegate ${Number(stakeAmount).toLocaleString()} ZBX`}
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Shield className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground">Select a validator from the list to delegate ZBX</p>
              </div>
            )}
          </div>

          {/* Rewards summary */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Network Rewards</h3>
              <span className="text-xs text-muted-foreground">24h</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Distributed", value: `$${Number(overview?.rewardsDistributed24h ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                { label: "Inflation Rate", value: `${overview?.inflationRate ?? "—"}%/yr` },
                { label: "ZBX Price", value: `$${Number(overview?.zbxPrice ?? 0).toFixed(4)}` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
