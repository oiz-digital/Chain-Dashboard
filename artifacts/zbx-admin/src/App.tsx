import { useEffect, useState, createContext, useContext } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Validators from "@/pages/validators";
import Tokens from "@/pages/tokens";
import AiModels from "@/pages/ai-models";
import AdminUsers from "@/pages/users";
import SystemSettings from "@/pages/settings";
import AppUsers from "@/pages/app-users";
import FeatureFlags from "@/pages/feature-flags";
import Invites from "@/pages/invites";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Menu, X, Activity } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

interface MobileNavCtx { isOpen: boolean; toggle: () => void; close: () => void }
export const MobileNavContext = createContext<MobileNavCtx>({ isOpen: false, toggle: () => {}, close: () => {} });
export function useMobileNav() { return useContext(MobileNavContext); }

function MobileHeader() {
  const { toggle, isOpen } = useMobileNav();
  const { user } = useAuth();
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/60 bg-sidebar flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <button onClick={toggle} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-wide">ZBX ADMIN</span>
        </div>
      </div>
      {user && (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">
            {(user.displayName ?? user.username ?? "A").slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(s => !s);
  const close  = () => setIsOpen(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 rounded bg-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground font-mono animate-pulse">Loading ZBX Admin...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;

  return (
    <MobileNavContext.Provider value={{ isOpen, toggle, close }}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-col md:flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile overlay sidebar */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={close} />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden overflow-y-auto">
              <Sidebar />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
              <Switch>
                <Route path="/"             component={Dashboard} />
                <Route path="/validators"   component={Validators} />
                <Route path="/tokens"       component={Tokens} />
                <Route path="/ai-models"    component={AiModels} />
                <Route path="/users"        component={AdminUsers} />
                <Route path="/settings"     component={SystemSettings} />
                <Route path="/app-users"    component={AppUsers} />
                <Route path="/feature-flags" component={FeatureFlags} />
                <Route path="/invites"      component={Invites} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route>
        <ProtectedLayout />
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
