import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Box, 
  ArrowRightLeft, 
  Users, 
  Wallet, 
  Coins, 
  Landmark,
  Search,
  Activity,
  Menu,
  X,
  Code2,
  ClipboardList,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/blocks", label: "Blocks", icon: Box },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/validators", label: "Validators", icon: Users },
  { href: "/wallet", label: "Wallet Lookup", icon: Wallet },
  { href: "/tokens", label: "Tokens", icon: Coins },
  { href: "/defi", label: "DeFi", icon: Landmark },
  { href: "/chain-code", label: "Chain Code", icon: Code2 },
  { href: "/audit", label: "Feature Audit", icon: ClipboardList },
  { href: "/patches", label: "Gap Fixes", icon: Wrench },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card text-card-foreground">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="font-bold tracking-tight text-lg">ZBX Explorer</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-muted rounded-md transition-colors">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Content */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex md:flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex items-center gap-3 p-6 border-b border-border">
          <Activity className="h-8 w-8 text-primary" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-xl leading-none">ZBX Explorer</span>
            <span className="text-xs text-muted-foreground font-mono mt-1">MAINNET-8989</span>
          </div>
        </div>

        <div className="flex-1 py-6 overflow-y-auto px-4">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-border">
          <div className="bg-muted/50 rounded-lg p-4 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Network Status</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">Operational</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">150M ZBX Cap</span>
          </div>
        </div>
      </div>
      
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
