import React from "react";
import { Link } from "wouter";
import { 
  useGetChainStats, 
  useListBlocks, 
  useListTransactions, 
  useGetChainInfo,
  useGetChainActivity
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { truncateHash, formatAge, formatZbx, formatNumber, formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Box, ArrowRightLeft, Users, Coins, Zap } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export default function Overview() {
  const { data: stats, isLoading: statsLoading } = useGetChainStats({ query: { refetchInterval: 5000 } });
  const { data: info, isLoading: infoLoading } = useGetChainInfo();
  const { data: blocks, isLoading: blocksLoading } = useListBlocks({ limit: 10 });
  const { data: txs, isLoading: txsLoading } = useListTransactions({ limit: 10 });
  const { data: activity, isLoading: activityLoading } = useGetChainActivity();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">ZBX Explorer</h1>
        {info && (
          <div className="flex items-center gap-4 text-sm bg-card px-4 py-2 rounded-md border">
            <div><span className="text-muted-foreground mr-2">Network:</span> <span className="font-mono text-primary font-semibold">{info.chainName}</span></div>
            <div className="w-px h-4 bg-border"></div>
            <div><span className="text-muted-foreground mr-2">Block Time:</span> <span className="font-mono">{info.blockTime}s</span></div>
            <div className="w-px h-4 bg-border"></div>
            <div><span className="text-muted-foreground mr-2">Token:</span> <span className="font-mono">{info.token}</span></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate transition-all border-l-4 border-l-primary/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ZBX Price</p>
                {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <h3 className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(stats?.zbxPriceUsd || 0)}</h3>
                )}
              </div>
              <div className="p-2 bg-primary/10 rounded-md text-primary"><Coins className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-blue-500/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Cap</p>
                {statsLoading ? <Skeleton className="h-8 w-32 mt-1" /> : (
                  <h3 className="text-2xl font-bold tracking-tight mt-1">${formatNumber(Number(stats?.marketCap || 0))}</h3>
                )}
              </div>
              <div className="p-2 bg-blue-500/10 rounded-md text-blue-500"><Activity className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-green-500/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Validators</p>
                {statsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                  <h3 className="text-2xl font-bold tracking-tight mt-1">{stats?.activeValidators}</h3>
                )}
              </div>
              <div className="p-2 bg-green-500/10 rounded-md text-green-500"><Users className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-yellow-500/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Latest Block</p>
                {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <h3 className="text-2xl font-mono font-bold tracking-tight mt-1 text-yellow-500">#{stats?.latestHeight}</h3>
                )}
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-md text-yellow-500"><Box className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Network Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center">
            <div className="mb-6 flex gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Current TPS</p>
                <div className="text-3xl font-mono font-bold">{stats?.tps || 0}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <div className="text-xl font-mono mt-1">{formatNumber(stats?.totalTransactions || 0)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Addresses</p>
                <div className="text-xl font-mono mt-1">{formatNumber(stats?.totalAddresses || 0)}</div>
              </div>
            </div>
            
            <div className="h-32 w-full mt-auto">
              {activityLoading ? (
                <Skeleton className="h-full w-full" />
              ) : activity && activity.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activity}>
                    <YAxis hide domain={['auto', 'auto']} />
                    <Line 
                      type="monotone" 
                      dataKey="txCount" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No activity data</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /> Supply</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center">
            {statsLoading ? (
              <div className="space-y-4"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Total Staked</span>
                    <span className="font-mono">{formatZbx(stats?.totalStaked || "0", 0)} ZBX</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Circulating Supply</span>
                    <span className="font-mono">{formatZbx(stats?.circulatingSupply || "0", 0)} ZBX</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Link href="/tokens" className="text-primary text-sm font-medium hover:underline flex items-center justify-center">
                    View detailed tokenomics &rarr;
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" /> Latest Blocks
            </CardTitle>
            <Link href="/blocks" className="text-xs text-primary hover:underline font-medium">View All</Link>
          </CardHeader>
          <CardContent className="p-0">
            {blocksLoading ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {blocks?.blocks.slice(0, 8).map(block => (
                  <div key={block.height} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-2 rounded-md">
                        <Box className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Link href={`/blocks/${block.height}`} className="font-mono text-primary font-bold hover:underline">
                          #{block.height}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">{formatAge(block.timestamp)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{block.txCount} txs</div>
                      <div className="text-xs font-mono text-muted-foreground mt-1">Reward: {formatZbx(block.reward, 0)} ZBX</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Latest Transactions
            </CardTitle>
            <Link href="/transactions" className="text-xs text-primary hover:underline font-medium">View All</Link>
          </CardHeader>
          <CardContent className="p-0">
            {txsLoading ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {txs?.transactions.slice(0, 8).map(tx => (
                  <div key={tx.hash} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-2 rounded-md">
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Link href={`/transactions/${tx.hash}`} className="font-mono text-primary hover:underline font-medium">
                          {truncateHash(tx.hash, 8, 8)}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {formatAge(tx.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="font-mono text-sm font-medium">{formatZbx(tx.amount)} ZBX</div>
                      <StatusBadge status={tx.status} className="text-[10px] h-5 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
