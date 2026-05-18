import React from "react";
import { Link, useParams } from "wouter";
import { useGetBlock } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZbx, formatAge, truncateHash } from "@/lib/format";
import { Box, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

export default function BlockDetail() {
  const { height } = useParams();
  const heightNum = height ? parseInt(height) : 0;
  
  const { data: block, isLoading } = useGetBlock(heightNum, {
    query: { enabled: !!heightNum }
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/blocks" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-max">
          <ArrowLeft className="h-4 w-4" /> Back to blocks
        </Link>
        <div className="flex items-center gap-3">
          <Box className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight font-mono">
            Block #{height}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium">Block Height</div>
              <div className="md:col-span-2 font-mono font-bold text-lg">{block?.height || <Skeleton className="w-24 h-6" />}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Timestamp</div>
              <div className="md:col-span-2 flex items-center gap-2">
                {block ? (
                  <><span>{new Date(block.timestamp).toLocaleString()}</span> <span className="text-muted-foreground">({formatAge(block.timestamp)})</span></>
                ) : <Skeleton className="w-48 h-6" />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Transactions</div>
              <div className="md:col-span-2">{block?.txCount ?? <Skeleton className="w-12 h-6" />}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Validator</div>
              <div className="md:col-span-2 flex items-center gap-2">
                {block ? (
                  <>
                    <Link href={`/validators/${block.validator}`} className="font-mono text-primary hover:underline">
                      {block.validator}
                    </Link>
                    <CopyButton value={block.validator} iconOnly />
                  </>
                ) : <Skeleton className="w-64 h-6" />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4">
              <div className="text-muted-foreground font-medium flex items-center">Block Reward</div>
              <div className="md:col-span-2 font-mono">{block ? `${formatZbx(block.reward)} ZBX` : <Skeleton className="w-32 h-6" />}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">Block Hash</div>
              <div className="md:col-span-2 flex items-center gap-2 font-mono break-all">
                {block?.hash} {block && <CopyButton value={block.hash} iconOnly />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">Parent Hash</div>
              <div className="md:col-span-2 flex items-center gap-2 font-mono break-all">
                {block?.parentHash} {block && <CopyButton value={block.parentHash} iconOnly />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 p-4 bg-muted/20">
              <div className="text-muted-foreground font-medium flex items-center">Gas Used / Limit</div>
              <div className="md:col-span-2 font-mono">
                {block ? `${block.gasUsed.toLocaleString()} / ${block.gasLimit.toLocaleString()}` : <Skeleton className="w-48 h-6" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Transactions ({block?.txCount || 0})</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Hash</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">From</th>
                    <th className="px-6 py-4 font-medium">To</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {block?.transactions?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        No transactions in this block
                      </td>
                    </tr>
                  )}
                  {block?.transactions?.map((tx) => (
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
                        {formatZbx(tx.amount)} ZBX
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
