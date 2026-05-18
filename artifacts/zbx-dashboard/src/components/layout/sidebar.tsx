import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Box, ArrowRightLeft, Users, Wallet, Coins, Landmark,
  Code2, ClipboardList, Wrench, Bot, MessageSquare,
  Activity, ChevronRight, Cpu, Repeat2, Droplets, Shield,
  Vote, BarChart3, Cable, Globe, Trophy, Search, FlaskConical, Droplet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetChainStats } from "@workspace/api-client-react";
import { useSidebar } from "./app-layout";
import { useNetwork } from "@/contexts/NetworkContext";

const MAINNET_NAV_SECTIONS = [
  {
    label: "Explorer",
    items: [
      { href: "/",             label: "Overview",        icon: LayoutDashboard },
      { href: "/search",       label: "Global Search",   icon: Search },
      { href: "/blocks",       label: "Blocks",          icon: Box },
      { href: "/transactions", label: "Transactions",    icon: ArrowRightLeft },
      { href: "/validators",   label: "Validators",      icon: Users },
      { href: "/wallet",       label: "Wallet Lookup",   icon: Wallet },
      { href: "/tokens",       label: "Tokens",          icon: Coins },
      { href: "/defi",         label: "DeFi",            icon: Landmark },
    ],
  },
  {
    label: "DeFi",
    items: [
      { href: "/swap",    label: "Swap",            icon: Repeat2 },
      { href: "/pools",   label: "Liquidity Pools", icon: Droplets },
      { href: "/staking", label: "Staking",         icon: Shield },
      { href: "/bridge",  label: "Bridge",          icon: Cable },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/governance",  label: "Proposals",    icon: Vote },
      { href: "/analytics",   label: "Analytics",    icon: BarChart3 },
      { href: "/ibc",         label: "IBC Channels", icon: Globe },
      { href: "/leaderboard", label: "Leaderboard",  icon: Trophy },
    ],
  },
  {
    label: "Protocol",
    items: [
      { href: "/chain-code", label: "Chain Code",    icon: Code2 },
      { href: "/audit",      label: "Feature Audit", icon: ClipboardList },
      { href: "/patches",    label: "Gap Fixes",     icon: Wrench },
    ],
  },
];

const TESTNET_NAV_SECTIONS = [
  {
    label: "Testnet Explorer",
    items: [
      { href: "/",             label: "Overview",        icon: LayoutDashboard },
      { href: "/search",       label: "Global Search",   icon: Search },
      { href: "/blocks",       label: "Blocks",          icon: Box },
      { href: "/transactions", label: "Transactions",    icon: ArrowRightLeft },
      { href: "/validators",   label: "Validators",      icon: Users },
      { href: "/wallet",       label: "Wallet Lookup",   icon: Wallet },
    ],
  },
  {
    label: "Testnet Tools",
    items: [
      { href: "/testnet-faucet", label: "Test Faucet",   icon: Droplet },
      { href: "/staking",        label: "Staking",       icon: Shield },
      { href: "/governance",     label: "Governance",    icon: Vote },
    ],
  },
  {
    label: "Protocol",
    items: [
      { href: "/chain-code", label: "Chain Code",    icon: Code2 },
      { href: "/audit",      label: "Feature Audit", icon: ClipboardList },
      { href: "/patches",    label: "Gap Fixes",     icon: Wrench },
    ],
  },
];

const AI_ITEMS = [
  { href: "/ai-features", label: "AI Features",   icon: Bot },
  { href: "/ai-agent",    label: "AI Agent Chat",  icon: MessageSquare },
];

function NavLink({ href, label, Icon, isActive, onClick }: {
  href: string; label: string; Icon: React.ElementType; isActive: boolean; onClick?: () => void
}) {
  return (
    <Link href={href} onClick={onClick}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative",
        isActive
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />}
      <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="h-3 w-3 text-primary opacity-60" />}
    </Link>
  );
}

export function Sidebar() {
  const [location]   = useLocation();
  const { close }    = useSidebar();
  const { data: stats } = useGetChainStats({ query: { refetchInterval: 5000 } });
  const { network, isTestnet, chainId } = useNetwork();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  const navSections = isTestnet ? TESTNET_NAV_SECTIONS : MAINNET_NAV_SECTIONS;

  return (
    <div className="flex flex-col h-full w-64 border-r border-border/60 bg-card">
      {/* Brand */}
      <div className={cn(
        "flex items-center gap-3 px-5 py-5 border-b",
        isTestnet ? "border-yellow-500/30 bg-yellow-500/5" : "border-border/60"
      )}>
        <div className="relative">
          <div className={cn(
            "h-9 w-9 rounded-xl border flex items-center justify-center",
            isTestnet ? "bg-yellow-500/20 border-yellow-500/30" : "bg-primary/20 border-primary/30"
          )}>
            {isTestnet
              ? <FlaskConical className="h-5 w-5 text-yellow-400" />
              : <Activity className="h-5 w-5 text-primary" />
            }
          </div>
          <span className={cn(
            "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
            isTestnet ? "bg-yellow-400" : "bg-green-500"
          )} />
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-base leading-none text-foreground">ZBX Explorer</span>
          <span className={cn(
            "text-[10px] font-mono mt-1",
            isTestnet ? "text-yellow-500" : "text-muted-foreground"
          )}>
            {isTestnet ? "TESTNET" : "MAINNET"} · CHAIN {chainId}
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-4 overflow-y-auto px-3 space-y-6">
        {navSections.map(section => (
          <div key={section.label}>
            <p className={cn(
              "text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5",
              isTestnet ? "text-yellow-500/50" : "text-muted-foreground/50"
            )}>
              {section.label}
            </p>
            <nav className="space-y-0.5">
              {section.items.map(item => (
                <NavLink key={item.href} href={item.href} label={item.label}
                  Icon={item.icon} isActive={isActive(item.href)} onClick={close} />
              ))}
            </nav>
          </div>
        ))}

        {/* AI Section */}
        <div>
          <div className="flex items-center gap-2 px-3 mb-1.5">
            <p className="text-[10px] font-semibold text-fuchsia-500/70 uppercase tracking-widest">AI — ZEP-009</p>
            <span className="flex items-center gap-1 text-[9px] font-mono text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 rounded-full">
              <span className="h-1 w-1 rounded-full bg-fuchsia-400 animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="rounded-lg border border-fuchsia-500/15 bg-fuchsia-500/5 p-1 space-y-0.5">
            {AI_ITEMS.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={close}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-fuchsia-500/15 text-fuchsia-300"
                      : "text-fuchsia-400/70 hover:bg-fuchsia-500/10 hover:text-fuchsia-300"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-fuchsia-300" : "text-fuchsia-500")} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-fuchsia-400 opacity-60" />}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="px-3 pb-4 space-y-3 border-t border-border/60 pt-4">
        <div className={cn(
          "rounded-lg border p-3 space-y-2",
          isTestnet ? "bg-yellow-500/5 border-yellow-500/20" : "bg-muted/30 border-border/40"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Network</span>
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isTestnet ? "bg-yellow-400" : "bg-green-500")} />
              <span className={cn("text-[10px] font-medium", isTestnet ? "text-yellow-400" : "text-green-500")}>
                {isTestnet ? "Testnet" : "Operational"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-muted-foreground">Block</p>
              <p className="text-xs font-mono font-semibold text-foreground">#{stats?.latestHeight?.toLocaleString() ?? "—"}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">TPS</p>
              <p className="text-xs font-mono font-semibold text-foreground">{stats?.tps ?? "—"}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">ZBX Price</p>
              <p className={cn("text-xs font-mono font-semibold", isTestnet ? "text-yellow-400" : "text-primary")}>
                ${Number(stats?.zbxPriceUsd ?? 0).toFixed(isTestnet ? 5 : 3)}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Validators</p>
              <p className="text-xs font-mono font-semibold text-foreground">{stats?.activeValidators ?? "—"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-fuchsia-500/8 border border-fuchsia-500/20 px-3 py-2 flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-fuchsia-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-fuchsia-300">0xCA AIINFER</p>
            <p className="text-[9px] text-muted-foreground font-mono truncate">12 models · ZEP-009</p>
          </div>
          <span className="text-[9px] font-mono text-fuchsia-400 bg-fuchsia-500/15 px-1.5 py-0.5 rounded">ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
