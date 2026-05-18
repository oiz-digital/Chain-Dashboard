import React from "react";
import { useGetDefiStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Landmark, Activity, Droplets, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Defi() {
  const { data: stats, isLoading } = useGetDefiStats();

  const isPositive = stats ? stats.priceChange24h >= 0 : true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Landmark className="h-8 w-8 text-primary" />
          DeFi Ecosystem
        </h1>
        {stats && (
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-md border font-mono">
            <span className="text-muted-foreground text-sm">ZBX:</span>
            <span className="font-bold">{formatCurrency(stats.zbxPrice)}</span>
            <span className={`text-xs flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(stats.priceChange24h).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-lg shadow-primary/5">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-primary mb-1 uppercase tracking-wider">Total Value Locked</p>
            {isLoading ? <Skeleton className="h-10 w-48" /> : (
              <h3 className="text-4xl font-bold font-mono tracking-tight">${formatNumber(Number(stats?.totalTvl || 0))}</h3>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">24h Volume</p>
                {isLoading ? <Skeleton className="h-8 w-32" /> : (
                  <h3 className="text-2xl font-bold font-mono tracking-tight">${formatNumber(Number(stats?.dailyVolume || 0))}</h3>
                )}
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">24h Fees</p>
                {isLoading ? <Skeleton className="h-8 w-32" /> : (
                  <h3 className="text-2xl font-bold font-mono tracking-tight">${formatNumber(Number(stats?.totalFees24h || 0))}</h3>
                )}
              </div>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">TVL Breakdown</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">AMM Pools</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <>
                <div className="text-3xl font-bold font-mono text-blue-500 mb-2">
                  ${formatNumber(Number(stats?.ammPoolTvl || 0))}
                </div>
                <p className="text-sm text-muted-foreground">Includes 20M ZBX genesis seed liquidity.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Liquid Staking</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <>
                <div className="text-3xl font-bold font-mono text-purple-500 mb-2">
                  ${formatNumber(Number(stats?.stakingTvl || 0))}
                </div>
                <p className="text-sm text-muted-foreground">Validator delegations represented as liquid tokens.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Lending & Borrowing</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <>
                <div className="text-3xl font-bold font-mono text-green-500 mb-2">
                  ${formatNumber(Number(stats?.lendingTvl || 0))}
                </div>
                <p className="text-sm text-muted-foreground">Collateral supplied across money markets.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
