import React, { useState } from "react";
import { Link } from "wouter";
import { useListTransactions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatAge, formatZbx, truncateHash } from "@/lib/format";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListTransactions({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          Transactions
        </h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Hash</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Age</th>
                  <th className="px-6 py-4 font-medium">From</th>
                  <th className="px-6 py-4 font-medium">To</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : data?.transactions.map((tx) => (
                  <tr key={tx.hash} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/transactions/${tx.hash}`} className="font-mono text-primary hover:underline font-medium">
                        {truncateHash(tx.hash, 8, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="secondary" className="uppercase text-[10px]">{tx.type}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={tx.status} className="text-[10px]" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {formatAge(tx.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-muted-foreground">
                      <Link href={`/wallet?address=${tx.from}`} className="hover:text-primary hover:underline">
                        {truncateHash(tx.from, 6, 4)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-muted-foreground">
                      {tx.to ? (
                        <Link href={`/wallet?address=${tx.to}`} className="hover:text-primary hover:underline">
                          {truncateHash(tx.to, 6, 4)}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-right">
                      {formatZbx(tx.amount)} <span className="text-muted-foreground text-xs">ZBX</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing page {page} of {Math.ceil((data?.total || 0) / 20) || 1}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!data || data.transactions.length < 20}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
