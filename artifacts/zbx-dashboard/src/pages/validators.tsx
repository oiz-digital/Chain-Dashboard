import React from "react";
import { Link } from "wouter";
import { useListValidators } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatZbx, truncateHash } from "@/lib/format";
import { Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";

export default function Validators() {
  const { data: validators, isLoading } = useListValidators();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Validators
        </h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium w-16">Rank</th>
                  <th className="px-6 py-4 font-medium">Validator</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Voting Power</th>
                  <th className="px-6 py-4 font-medium text-right">Commission</th>
                  <th className="px-6 py-4 font-medium text-right">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-8"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : validators?.map((validator) => (
                  <tr key={validator.address} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-muted-foreground">
                      {validator.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <Link href={`/validators/${validator.address}`} className="font-bold text-primary hover:underline">
                          {validator.moniker}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground mt-1">
                          {truncateHash(validator.address, 10, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={validator.status} className="text-[10px]" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="font-mono font-medium">{formatZbx(validator.votingPower, 0)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{validator.delegators} delegators</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-right">
                      {(validator.commission * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right w-48">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-mono">{validator.uptime.toFixed(2)}%</span>
                        <Progress value={validator.uptime} className="h-2 w-16" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
