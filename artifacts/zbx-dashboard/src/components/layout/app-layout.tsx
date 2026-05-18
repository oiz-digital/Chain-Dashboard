import React from "react";
import { Sidebar } from "./sidebar";
import { useHealthCheck, useGetChainStats } from "@workspace/api-client-react";
import { Activity, Box, Zap, TrendingUp, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function TopBar() {
  const { data: stats } = useGetChainStats({ query: { refetchInterval: 5000 } });

  const items = [
    {
      icon: Box,
      label: "Block",
      value: stats ? `#${Number(stats.latestHeight).toLocaleString()}` : "—",
      color: "text-yellow-400",
    },
    {
      icon: Zap,
      label: "TPS",
      value: stats ? stats.tps.toString() : "—",
      color: "text-cyan-400",
    },
    {
      icon: TrendingUp,
      label: "ZBX",
      value: stats ? `$${Number(stats.zbxPriceUsd).toFixed(3)}` : "—",
      color: "text-primary",
    },
    {
      icon: Activity,
      label: "Validators",
      value: stats ? stats.activeValidators.toString() : "—",
      color: "text-green-400",
    },
  ];

  return (
    <div className="hidden lg:flex items-center justify-between px-6 py-2 border-b border-border/40 bg-card/50 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-6">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <item.icon className={cn("h-3 w-3", item.color)} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
            <span className={cn("text-[11px] font-mono font-semibold", item.color)}>{item.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Link href="/ai-agent"
          className="flex items-center gap-1.5 text-[11px] font-mono text-fuchsia-400 hover:text-fuchsia-300 transition-colors border border-fuchsia-500/20 bg-fuchsia-500/8 hover:bg-fuchsia-500/15 px-2.5 py-1 rounded-md">
          <Cpu className="h-3 w-3" />
          0xCA AIINFER · 12 models
        </Link>

        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-500 font-medium">Mainnet · Chain ID 8989</span>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  useHealthCheck({ query: { refetchInterval: 30000 } });

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans dark">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto w-full">
          <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
