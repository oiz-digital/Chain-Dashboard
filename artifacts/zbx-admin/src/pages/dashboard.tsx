import { useGetAdminStats, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { Shield, Coins, Brain, Users, TrendingUp, Activity, Zap, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const tpsData = Array.from({ length: 24 }, (_, i) => ({
  block: `#${284700 + i * 50}`,
  tps: 600 + Math.random() * 500,
  txs: Math.floor(Math.random() * 200) + 50,
}));

const uptimeData = [
  { validator: "ZBX Foundation", uptime: 99.98 },
  { validator: "Quantum Node", uptime: 99.85 },
  { validator: "StakeHub Pro", uptime: 99.71 },
  { validator: "NightOwl", uptime: 97.21 },
  { validator: "RogueVal", uptime: 84.10 },
];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Network Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Zebvix Chain — live network control room</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Shield} label="Active Validators" value={stats?.activeValidators ?? 0} sub={`${stats?.jailedValidators ?? 0} jailed`} color="bg-primary/15 text-primary" />
          <StatCard icon={TrendingUp} label="Total Staked" value={`${Number(stats?.totalStaked ?? 0).toLocaleString()} ZBX`} sub="Network stake" color="bg-cyan-500/15 text-cyan-400" />
          <StatCard icon={Zap} label="Network TPS" value={(stats?.networkTps ?? 0).toFixed(1)} sub="Current throughput" color="bg-emerald-500/15 text-emerald-400" />
          <StatCard icon={Clock} label="Latest Block" value={`#${(stats?.latestBlock ?? 0).toLocaleString()}`} sub="~3s avg time" color="bg-violet-500/15 text-violet-400" />
          <StatCard icon={Coins} label="Token Registry" value={stats?.totalTokens ?? 0} sub="Registered tokens" color="bg-amber-500/15 text-amber-400" />
          <StatCard icon={Brain} label="AI Models" value={stats?.totalAiModels ?? 0} sub="On-chain models" color="bg-fuchsia-500/15 text-fuchsia-400" />
          <StatCard icon={Users} label="Admin Users" value={stats?.totalAdminUsers ?? 0} sub="Panel users" color="bg-rose-500/15 text-rose-400" />
          <StatCard icon={Activity} label="Avg Uptime" value={`${(stats?.uptimeAvg ?? 0).toFixed(2)}%`} sub="All validators" color="bg-teal-500/15 text-teal-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Network TPS (Last 24 Blocks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tpsData}>
                <defs>
                  <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(270,85%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(270,85%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(270,20%,15%)" />
                <XAxis dataKey="block" tick={{ fill: "hsl(270,20%,55%)", fontSize: 10 }} interval={5} />
                <YAxis tick={{ fill: "hsl(270,20%,55%)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(270,20%,8%)", border: "1px solid hsl(270,20%,20%)", borderRadius: 6 }}
                  labelStyle={{ color: "hsl(270,20%,80%)", fontSize: 11 }}
                  itemStyle={{ color: "hsl(270,85%,70%)", fontSize: 11 }}
                />
                <Area type="monotone" dataKey="tps" stroke="hsl(270,85%,60%)" strokeWidth={2} fill="url(#tpsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Validator Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={uptimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(270,20%,15%)" horizontal={false} />
                <XAxis type="number" domain={[80, 100]} tick={{ fill: "hsl(270,20%,55%)", fontSize: 10 }} />
                <YAxis dataKey="validator" type="category" tick={{ fill: "hsl(270,20%,55%)", fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ background: "hsl(270,20%,8%)", border: "1px solid hsl(270,20%,20%)", borderRadius: 6 }}
                  labelStyle={{ color: "hsl(270,20%,80%)", fontSize: 11 }}
                  itemStyle={{ color: "hsl(190,90%,55%)", fontSize: 11 }}
                />
                <Bar dataKey="uptime" fill="hsl(190,90%,45%)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
