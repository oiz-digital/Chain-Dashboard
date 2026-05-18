import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetWallet, useGetWalletTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZbx, formatAge, truncateHash } from "@/lib/format";
import { Wallet as WalletIcon, Search, ArrowRightLeft, Send, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

export default function Wallet() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const addressParam = searchParams.get("address") || "";
  
  const [searchInput, setSearchInput] = useState(addressParam);

  const { data: wallet, isLoading: walletLoading, error: walletError } = useGetWallet(addressParam, {
    query: { enabled: !!addressParam, retry: false }
  });

  const { data: txs, isLoading: txsLoading } = useGetWalletTransactions(addressParam, {
    query: { enabled: !!addressParam }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setLocation(`/wallet?address=${searchInput.trim()}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <WalletIcon className="h-8 w-8 text-primary" />
          Wallet Lookup
        </h1>
        <form onSubmit={handleSearch} className="flex max-w-2xl gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter ZBX address (0x...)"
              className="pl-10 font-mono"
            />
          </div>
          <Button type="submit" disabled={!searchInput.trim()}>Search</Button>
        </form>
      </div>

      {!addressParam ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="bg-muted p-6 rounded-full mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Search for an Address</h2>
          <p className="text-muted-foreground max-w-md">
            Enter a Zebvix Chain address above to view its balance, token holdings, and complete transaction history.
          </p>
        </div>
      ) : walletError ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-6 text-center text-destructive flex flex-col items-center">
            <h3 className="font-bold text-lg mb-2">Address not found</h3>
            <p>We couldn't find any information for this address on the network.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Address Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-8 bg-muted/30 p-4 rounded-lg border">
                  <div className="bg-primary/20 p-3 rounded-full">
                    <WalletIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-lg truncate break-all">
                      {addressParam}
                    </div>
                  </div>
                  <CopyButton value={addressParam} />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Balance</div>
                    <div className="text-3xl font-bold font-mono text-primary">
                      {walletLoading ? <Skeleton className="h-8 w-32" /> : formatZbx(wallet?.balance || "0")} <span className="text-lg text-foreground ml-1">ZBX</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Staked Amount</div>
                    <div className="text-xl font-bold font-mono">
                      {walletLoading ? <Skeleton className="h-6 w-24" /> : formatZbx(wallet?.stakedAmount || "0")} <span className="text-sm text-muted-foreground ml-1">ZBX</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Activity Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-muted-foreground">Transactions</span>
                    <span className="font-mono font-bold">{walletLoading ? <Skeleton className="h-5 w-8" /> : wallet?.txCount}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-muted-foreground flex items-center gap-2"><Download className="h-4 w-4" /> Received</span>
                    <span className="font-mono">{walletLoading ? <Skeleton className="h-5 w-16" /> : formatZbx(wallet?.totalReceived || "0", 0)} ZBX</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-muted-foreground flex items-center gap-2"><Send className="h-4 w-4" /> Sent</span>
                    <span className="font-mono">{walletLoading ? <Skeleton className="h-5 w-16" /> : formatZbx(wallet?.totalSent || "0", 0)} ZBX</span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-muted-foreground">Nonce</span>
                    <span className="font-mono">{walletLoading ? <Skeleton className="h-5 w-8" /> : wallet?.nonce}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <h2 className="text-xl font-bold mt-8 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Recent Transactions
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-medium">Hash</th>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Age</th>
                      <th className="px-6 py-4 font-medium">From/To</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {txsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></td>
                        </tr>
                      ))
                    ) : txs?.transactions?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No transactions found for this address.
                        </td>
                      </tr>
                    ) : txs?.transactions?.map((tx) => {
                      const isOutgoing = tx.from.toLowerCase() === addressParam.toLowerCase();
                      
                      return (
                        <tr key={tx.hash} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link href={`/transactions/${tx.hash}`} className="font-mono text-primary hover:underline font-medium">
                              {truncateHash(tx.hash, 8, 8)}
                            </Link>
                            {tx.status !== "success" && (
                              <StatusBadge status={tx.status} className="ml-2 text-[10px]" />
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary" className="uppercase text-[10px]">{tx.type}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            {formatAge(tx.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                            <div className="flex flex-col gap-1">
                              {isOutgoing ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground uppercase text-[10px] w-6">To</span>
                                  <Link href={`/wallet?address=${tx.to}`} className="hover:text-primary hover:underline">
                                    {truncateHash(tx.to, 8, 6)}
                                  </Link>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground uppercase text-[10px] w-6">From</span>
                                  <Link href={`/wallet?address=${tx.from}`} className="hover:text-primary hover:underline">
                                    {truncateHash(tx.from, 8, 6)}
                                  </Link>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-right">
                            <span className={isOutgoing ? "text-foreground" : "text-green-500 font-bold"}>
                              {isOutgoing ? "-" : "+"}{formatZbx(tx.amount)} ZBX
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
