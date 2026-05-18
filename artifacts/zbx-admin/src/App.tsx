import { useEffect } from "react";
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
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/validators" component={Validators} />
            <Route path="/tokens" component={Tokens} />
            <Route path="/ai-models" component={AiModels} />
            <Route path="/users" component={AdminUsers} />
            <Route path="/settings" component={SystemSettings} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
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
