import React, { createContext, useContext, useState } from "react";
import { Sidebar } from "./sidebar";
import { useGetChainStats } from "@workspace/api-client-react";
import { Activity, Box, Zap, TrendingUp, Cpu, Menu, X, ChevronDown, FlaskConical, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useNetwork } from "@/contexts/NetworkContext";
import type { NetworkName } from "@/contexts/NetworkContext";

interface SidebarCtx { isOpen: boolean; toggle: () => void; close: () => void }
const SidebarContext = createContext<SidebarCtx>({ isOpen: false, toggle: () => {}, close: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

function NetworkSwitcher() {
  const { network, setNetwork, chainId, isTestnet } = useNetwork();
  const [open, setOpen] = useState(false);

  const options: { value: NetworkName; label: string; chainId: number; icon: React.ElementType; color: string }[] = [
    { value: "mainnet", label: "Mainnet",  chainId: 8989, icon: Globe,         color: "text-green-400" },
    { value: "testnet", label: "Testnet",  chainId: 8990, icon: FlaskConical,  color: "text-yellow-400" },
  ];
  const current = options.find(o => o.value === network)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono font-medium transition-colors",
          isTestnet
            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
            : "border-green-500/30 bg-green-500/8 text-green-400 hover:bg-green-500/15"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isTestnet ? "bg-yellow-400" : "bg-green-500")} />
        <current.icon className="h-3 w-3" />
        {current.label} · {chainId}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border/60 bg-card shadow-xl overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setNetwork(opt.value); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium transition-colors",
                  network === opt.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                <span className="flex-1 text-left">{opt.label}</span>
                <span className={cn("text-[10px] font-mono", opt.color)}>ID {opt.chainId}</span>
                {network === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopBar() {
  const { data: stats } = useGetChainStats({ query: { refetchInterval: 5000 } });
  const { isOpen, toggle } = useSidebar();
  const { isTestnet } = useNetwork();

  const items = [
    { icon: Box,       label: "Block",      value: stats ? `#${Number(stats.latestHeight).toLocaleString()}` : "—", color: "text-yellow-400" },
    { icon: Zap,       label: "TPS",        value: stats ? stats.tps.toString() : "—",                              color: "text-cyan-400" },
    { icon: TrendingUp,label: "ZBX",        value: stats ? `$${Number(stats.zbxPriceUsd).toFixed(isTestnet ? 5 : 3)}` : "—", color: "text-primary" },
    { icon: Activity,  label: "Validators", value: stats ? stats.activeValidators.toString() : "—",                  color: "text-green-400" },
  ];

  return (
    <>
      {/* Testnet yellow banner */}
      {isTestnet && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-yellow-500/15 border-b border-yellow-500/30 flex-shrink-0">
          <FlaskConical className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
          <span className="text-[11px] font-medium text-yellow-300">
            You are on <span className="font-bold">Testnet</span> (Chain ID 8990) — tokens have no real value.
          </span>
          <Link href="/testnet-faucet" className="text-[11px] font-semibold text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors">
            Get test ZBX →
          </Link>
        </div>
      )}

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
        <div className="hidden md:flex items-center gap-3">
          <Link href="/ai-agent"
            className="flex items-center gap-1.5 text-[11px] font-mono text-fuchsia-400 hover:text-fuchsia-300 transition-colors border border-fuchsia-500/20 bg-fuchsia-500/8 hover:bg-fuchsia-500/15 px-2.5 py-1 rounded-md">
            <Cpu className="h-3 w-3" />
            0xCA AIINFER · 12 models
          </Link>
          <NetworkSwitcher />
        </div>

        {/* Mobile right: mini stats + network switcher */}
        <div className="flex md:hidden items-center gap-2">
          {items.slice(0, 2).map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={cn("text-[10px] font-mono font-semibold", item.color)}>{item.value}</span>
            </div>
          ))}
          <NetworkSwitcher />
        </div>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(s => !s);
  const close  = () => setIsOpen(false);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close }}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans dark">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-col md:flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={close} />
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
