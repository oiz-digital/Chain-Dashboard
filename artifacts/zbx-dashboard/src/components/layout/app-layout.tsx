import React, { createContext, useContext, useState } from "react";
import { Sidebar } from "./sidebar";
import { useGetChainStats } from "@workspace/api-client-react";
import { Activity, Box, Zap, TrendingUp, Cpu, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface SidebarCtx { isOpen: boolean; toggle: () => void; close: () => void }
const SidebarContext = createContext<SidebarCtx>({ isOpen: false, toggle: () => {}, close: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

function TopBar() {
  const { data: stats } = useGetChainStats({ query: { refetchInterval: 5000 } });
  const { isOpen, toggle } = useSidebar();

  const items = [
    { icon: Box,       label: "Block",      value: stats ? `#${Number(stats.latestHeight).toLocaleString()}` : "—", color: "text-yellow-400" },
    { icon: Zap,       label: "TPS",        value: stats ? stats.tps.toString() : "—",                              color: "text-cyan-400" },
    { icon: TrendingUp,label: "ZBX",        value: stats ? `$${Number(stats.zbxPriceUsd).toFixed(3)}` : "—",        color: "text-primary" },
    { icon: Activity,  label: "Validators", value: stats ? stats.activeValidators.toString() : "—",                  color: "text-green-400" },
  ];

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card/50 backdrop-blur-sm flex-shrink-0">
      {/* Mobile: hamburger + brand */}
      <div className="flex items-center gap-3 md:hidden">
        <button onClick={toggle} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-bold text-base tracking-tight">ZBX Explorer</span>
        </div>
      </div>

      {/* Desktop: stats */}
      <div className="hidden md:flex items-center gap-6">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <item.icon className={cn("h-3 w-3", item.color)} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
            <span className={cn("text-[11px] font-mono font-semibold", item.color)}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Desktop right side */}
      <div className="hidden md:flex items-center gap-4">
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

      {/* Mobile right: mini stats */}
      <div className="flex md:hidden items-center gap-3">
        {items.slice(0, 2).map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={cn("text-[10px] font-mono font-semibold", item.color)}>{item.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(s => !s);
  const close  = () => setIsOpen(false);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close }}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans dark">
        {/* Desktop sidebar — hidden on mobile, always visible on md+ */}
        <div className="hidden md:flex md:flex-col md:flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
              onClick={close}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/60 md:hidden overflow-y-auto">
              <Sidebar />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto w-full">
            <div className="mx-auto p-4 md:p-6 lg:p-8 max-w-7xl animate-in fade-in duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
