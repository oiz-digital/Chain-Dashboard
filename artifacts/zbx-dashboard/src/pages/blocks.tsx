import React, { useState } from "react";
import { Link } from "wouter";
import { useListBlocks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAge, formatZbx, truncateHash } from "@/lib/format";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Blocks() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListBlocks({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Box className="h-8 w-8 text-primary" />
          Blocks
        </h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Height</th>
                  <th className="px-6 py-4 font-medium">Hash</th>
                  <th className="px-6 py-4 font-medium">Age</th>
                  <th className="px-6 py-4 font-medium">Tx Count</th>
                  <th className="px-6 py-4 font-medium">Validator</th>
                  <th className="px-6 py-4 font-medium text-right">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-12"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : data?.blocks.map((block) => (
                  <tr key={block.height} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/blocks/${block.height}`} className="font-mono text-primary hover:underline font-bold">
                        {block.height}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono">
                      {truncateHash(block.hash, 10, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {formatAge(block.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {block.txCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-primary hover:underline">
                      <Link href={`/validators/${block.validator}`}>{truncateHash(block.validator, 8, 6)}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-right">
                      {formatZbx(block.reward, 0)} ZBX
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
                disabled={!data || data.blocks.length < 20}
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
