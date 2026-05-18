import React from "react";
import { Link, useParams } from "wouter";
import { useGetTransaction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZbx, formatAge } from "@/lib/format";
import { ArrowRightLeft, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

export default function TransactionDetail() {
  const { hash } = useParams();
  
  const { data: tx, isLoading } = useGetTransaction(hash || "", {
    query: { enabled: !!hash }
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transactions" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-max">
          <ArrowLeft className="h-4 w-4" /> Back to transactions
        </Link>
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Transaction Details</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Transaction Hash</div>
              <div className="md:col-span-2 flex items-center gap-2 font-mono break-all font-bold text-lg">
                {tx?.hash || <Skeleton className="w-full h-6" />}
                {tx && <CopyButton value={tx.hash} iconOnly />}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Status</div>
              <div className="md:col-span-2">
                {tx ? <StatusBadge status={tx.status} /> : <Skeleton className="w-24 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Block Height</div>
              <div className="md:col-span-2 font-mono">
                {tx ? (
                  <Link href={`/blocks/${tx.blockHeight}`} className="text-primary hover:underline font-bold">
                    {tx.blockHeight}
                  </Link>
                ) : <Skeleton className="w-24 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Timestamp</div>
              <div className="md:col-span-2 flex items-center gap-2">
                {tx ? (
                  <><span>{new Date(tx.timestamp).toLocaleString()}</span> <span className="text-muted-foreground">({formatAge(tx.timestamp)})</span></>
                ) : <Skeleton className="w-48 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Transaction Type</div>
              <div className="md:col-span-2">
                {tx ? <Badge variant="outline" className="uppercase tracking-wider">{tx.type}</Badge> : <Skeleton className="w-24 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">From</div>
              <div className="md:col-span-2 flex items-center gap-2">
                {tx ? (
                  <>
                    <Link href={`/wallet?address=${tx.from}`} className="font-mono text-primary hover:underline break-all">
                      {tx.from}
                    </Link>
                    <CopyButton value={tx.from} iconOnly />
                  </>
                ) : <Skeleton className="w-64 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">To</div>
              <div className="md:col-span-2 flex items-center gap-2">
                {tx ? (
                  tx.to ? (
                    <>
                      <Link href={`/wallet?address=${tx.to}`} className="font-mono text-primary hover:underline break-all">
                        {tx.to}
                      </Link>
                      <CopyButton value={tx.to} iconOnly />
                    </>
                  ) : <span className="text-muted-foreground italic">Contract Creation</span>
                ) : <Skeleton className="w-64 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Value</div>
              <div className="md:col-span-2 font-mono font-bold text-lg">
                {tx ? `${formatZbx(tx.amount)} ZBX` : <Skeleton className="w-32 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Transaction Fee</div>
              <div className="md:col-span-2 font-mono">
                {tx ? `${formatZbx(tx.fee)} ZBX` : <Skeleton className="w-32 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">Gas Used / Limit</div>
              <div className="md:col-span-2 font-mono text-sm">
                {tx ? `${tx.gasUsed.toLocaleString()} / ${tx.gasLimit.toLocaleString()}` : <Skeleton className="w-48 h-6" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">Nonce</div>
              <div className="md:col-span-2 font-mono text-sm">
                {tx?.nonce ?? <Skeleton className="w-12 h-6" />}
              </div>
            </div>

            {tx?.data && tx.data !== "0x" && (
              <div className="grid grid-cols-1 md:grid-cols-3 p-4">
                <div className="text-muted-foreground font-medium flex items-start pt-1">Input Data</div>
                <div className="md:col-span-2">
                  <div className="bg-background rounded-md border p-3 max-h-48 overflow-y-auto font-mono text-xs text-muted-foreground break-all">
                    {tx.data}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
