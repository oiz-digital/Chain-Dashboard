import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Shield, Coins, Brain, Users, Settings, ChevronRight, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/validators", icon: Shield, label: "Validators" },
  { path: "/tokens", icon: Coins, label: "Token Registry" },
  { path: "/ai-models", icon: Brain, label: "AI Models" },
  { path: "/users", icon: Users, label: "Admin Users" },
  { path: "/settings", icon: Settings, label: "System Settings" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground tracking-wide">ZBX ADMIN</p>
            <p className="text-xs text-muted-foreground font-mono">Control Room</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-widest mb-2">Navigation</p>
        {nav.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-all group",
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3 h-3 text-primary" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">superadmin</p>
            <p className="text-xs text-muted-foreground truncate">super@zbx.io</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
