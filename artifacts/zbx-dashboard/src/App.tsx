import React from "react";
import { AppLayout } from "./components/layout/app-layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NetworkProvider } from "@/contexts/NetworkContext";
import NotFound from "@/pages/not-found";

// Pages
import Overview from "@/pages/overview";
import Blocks from "@/pages/blocks";
import BlockDetail from "@/pages/block-detail";
import Transactions from "@/pages/transactions";
import TransactionDetail from "@/pages/transaction-detail";
import Validators from "@/pages/validators";
import ValidatorDetail from "@/pages/validator-detail";
import Wallet from "@/pages/wallet";
import Tokens from "@/pages/tokens";
import Defi from "@/pages/defi";
import Swap from "@/pages/swap";
import Pools from "@/pages/pools";
import Staking from "@/pages/staking";
import Governance from "@/pages/governance";
import Analytics from "@/pages/analytics";
import Bridge from "@/pages/bridge";
import Ibc from "@/pages/ibc";
import Leaderboard from "@/pages/leaderboard";
import ChainCode from "@/pages/chain-code";
import Audit from "@/pages/audit";
import Patches from "@/pages/patches";
import AIFeatures from "@/pages/ai-features";
import AIAgent from "@/pages/ai-agent";
import SearchPage from "@/pages/search";
import TestnetFaucet from "@/pages/testnet-faucet";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/blocks" component={Blocks} />
        <Route path="/blocks/:height" component={BlockDetail} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/transactions/:hash" component={TransactionDetail} />
        <Route path="/validators" component={Validators} />
        <Route path="/validators/:address" component={ValidatorDetail} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/tokens" component={Tokens} />
        <Route path="/defi" component={Defi} />
        <Route path="/swap" component={Swap} />
        <Route path="/pools" component={Pools} />
        <Route path="/staking" component={Staking} />
        <Route path="/governance" component={Governance} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/bridge" component={Bridge} />
        <Route path="/ibc" component={Ibc} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/chain-code" component={ChainCode} />
        <Route path="/audit" component={Audit} />
        <Route path="/patches" component={Patches} />
        <Route path="/ai-features" component={AIFeatures} />
        <Route path="/ai-agent" component={AIAgent} />
        <Route path="/search" component={SearchPage} />
        <Route path="/testnet-faucet" component={TestnetFaucet} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </NetworkProvider>
    </QueryClientProvider>
  );
}

export default App;
