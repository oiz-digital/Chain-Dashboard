import React from "react";
import { useGetTokenStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZbx, formatNumber } from "@/lib/format";
import { Coins, Flame, Gem, Pickaxe } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export default function Tokens() {
  const { data: stats, isLoading } = useGetTokenStats();

  const supplyData = stats ? [
    { name: 'Circulating', value: Number(formatZbx(stats.circulatingSupply, 0).replace(/,/g, '')), color: 'hsl(var(--primary))' },
    { name: 'Unmined', value: Number(formatZbx(stats.totalSupplyCap, 0).replace(/,/g, '')) - Number(formatZbx(stats.minedSupply, 0).replace(/,/g, '')), color: 'hsl(var(--muted-foreground))' },
  ] : [];

  const allocationData = stats ? [
    { name: 'Foundation', value: Number(formatZbx(stats.foundationPremine, 0).replace(/,/g, '')), color: 'hsl(var(--chart-2))' },
    { name: 'AMM Seed', value: Number(formatZbx(stats.ammPoolSeed, 0).replace(/,/g, '')), color: 'hsl(var(--chart-3))' },
    { name: 'Mined', value: Number(formatZbx(stats.minedSupply, 0).replace(/,/g, '')) - Number(formatZbx(stats.foundationPremine, 0).replace(/,/g, '')) - Number(formatZbx(stats.ammPoolSeed, 0).replace(/,/g, '')), color: 'hsl(var(--primary))' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Coins className="h-8 w-8 text-primary" />
          Token Economics
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Supply Cap</p>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <h3 className="text-2xl font-bold font-mono tracking-tight">{formatZbx(stats?.totalSupplyCap || "0", 0)}</h3>
            )}
            <p className="text-xs text-muted-foreground mt-2">Maximum ZBX that will ever exist</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Circulating Supply</p>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <h3 className="text-2xl font-bold font-mono tracking-tight text-blue-500">{formatZbx(stats?.circulatingSupply || "0", 0)}</h3>
            )}
            {stats && (
              <Progress value={Number(stats.circulatingSupply) / Number(stats.totalSupplyCap) * 100} className="h-1 mt-3" indicatorClassName="bg-blue-500" />
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Current Block Reward</p>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <h3 className="text-2xl font-bold font-mono tracking-tight text-orange-500">{stats?.currentBlockReward} ZBX</h3>
            )}
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Pickaxe className="h-3 w-3" /> Per block (every ~5s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-purple-500">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Staking APR</p>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <h3 className="text-2xl font-bold font-mono tracking-tight text-purple-500">{stats?.stakingApr.toFixed(2)}%</h3>
            )}
            <p className="text-xs text-muted-foreground mt-2">Estimated annualized yield</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gem className="h-5 w-5 text-primary" /> Supply Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={supplyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {supplyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${formatNumber(value)} ZBX`, 'Amount']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {stats && (
              <div className="text-center mt-4 text-sm font-medium">
                <span className="text-primary text-xl font-bold font-mono">{stats.percentMined.toFixed(2)}%</span> of total supply mined
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" /> Halving Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 mt-4">
              <div className="bg-muted/30 p-6 rounded-lg border border-orange-500/20 text-center">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Blocks Until Next Halving</h4>
                <div className="text-5xl font-mono font-bold text-orange-500 tracking-tighter">
                  {isLoading ? <Skeleton className="h-12 w-48 mx-auto" /> : formatNumber(stats?.blocksUntilHalving || 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Reward drops to {stats ? stats.currentBlockReward / 2 : '-'} ZBX at block #{stats?.nextHalvingBlock}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Halving Interval</div>
                  <div className="font-mono font-bold text-lg">{isLoading ? <Skeleton className="h-6 w-20" /> : formatNumber(stats?.halvingInterval || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">blocks</div>
                </div>
                <div className="p-4 border rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Burned Supply</div>
                  <div className="font-mono font-bold text-lg text-red-500">{isLoading ? <Skeleton className="h-6 w-20" /> : formatZbx(stats?.burnedSupply || "0", 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">ZBX</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
