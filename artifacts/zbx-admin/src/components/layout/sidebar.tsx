import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Shield, Coins, Brain, Users, Settings,
  ChevronRight, Activity, LogOut, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const nav = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/validators", icon: Shield, label: "Validators" },
  { path: "/tokens", icon: Coins, label: "Token Registry" },
  { path: "/ai-models", icon: Brain, label: "AI Models" },
  { path: "/users", icon: Users, label: "Admin Users" },
  { path: "/settings", icon: Settings, label: "System Settings" },
];

const roleColors: Record<string, string> = {
  superadmin: "bg-primary/20 text-primary border-primary/30",
  admin: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  moderator: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  viewer: "bg-muted text-muted-foreground border-border",
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "SA";

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
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

      {/* Network status pill */}
      <div className="px-4 py-2.5 border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/8 border border-emerald-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-xs text-emerald-400 font-mono">Network Online</span>
        </div>
      </div>

      {/* Nav */}
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

      {/* User section */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-sidebar-accent transition-colors group"
              data-testid="button-user-menu"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{initials}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors rotate-90 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <Badge variant="outline" className={cn("text-xs w-fit", roleColors[user?.role ?? "viewer"])}>
                  {user?.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-muted-foreground cursor-default">
              <User className="w-3.5 h-3.5" />
              <div className="flex flex-col">
                <span className="text-xs">Logged in</span>
                <span className="text-xs font-mono text-muted-foreground/60">
                  {user?.loginTime ? new Date(user.loginTime).toLocaleTimeString() : "—"}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
