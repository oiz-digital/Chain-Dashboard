import React from "react";
import { Link, useParams } from "wouter";
import { useGetValidator } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZbx, formatAge } from "@/lib/format";
import { Users, ArrowLeft, Globe, Clock, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";

export default function ValidatorDetail() {
  const { address } = useParams();
  
  const { data: validator, isLoading } = useGetValidator(address || "", {
    query: { enabled: !!address }
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/validators" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-max">
          <ArrowLeft className="h-4 w-4" /> Back to validators
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            {validator?.moniker || <Skeleton className="h-8 w-48 inline-block" />}
          </h1>
          {validator && <StatusBadge status={validator.status} className="ml-2" />}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border w-max">
          {address} <CopyButton value={address || ""} iconOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Validator Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm leading-relaxed">
                    {isLoading ? <Skeleton className="h-16 w-full" /> : validator?.description || "No description provided."}
                  </p>
                </div>
                
                {validator?.website && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Website</h4>
                    <a href={validator.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                      <Globe className="h-4 w-4" /> {validator.website}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Joined {validator ? new Date(validator.joinedAt).toLocaleDateString() : <Skeleton className="h-4 w-24 inline-block" />}
                </div>
              </div>

              <div className="space-y-6 border-l pl-8">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Uptime Performance
                  </h4>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div className="mt-2">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-bold font-mono text-primary">{validator?.uptime.toFixed(2)}%</span>
                        <span className="text-xs text-muted-foreground mb-1">{validator?.blocksSkipped} blocks missed</span>
                      </div>
                      <Progress value={validator?.uptime} className="h-3" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Commission</h4>
                    <div className="text-xl font-bold font-mono">
                      {isLoading ? <Skeleton className="h-6 w-16" /> : `${(validator?.commission || 0) * 100}%`}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Rank</h4>
                    <div className="text-xl font-bold font-mono text-primary">
                      {isLoading ? <Skeleton className="h-6 w-12" /> : `#${validator?.rank}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staking Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Voting Power</h4>
                <div className="text-3xl font-bold font-mono text-primary">
                  {isLoading ? <Skeleton className="h-8 w-full" /> : formatZbx(validator?.votingPower || "0", 0)} <span className="text-sm text-foreground">ZBX</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Self Staked</span>
                    <span className="font-mono font-medium">{isLoading ? <Skeleton className="h-4 w-20" /> : formatZbx(validator?.selfStaked || "0", 0)} ZBX</span>
                  </div>
                  {validator && (
                    <Progress 
                      value={Number(validator.selfStaked) / Number(validator.votingPower) * 100 || 0} 
                      className="h-2"
                    />
                  )}
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Delegated</span>
                    <span className="font-mono font-medium">{isLoading ? <Skeleton className="h-4 w-20" /> : formatZbx(validator?.delegatedStaked || "0", 0)} ZBX</span>
                  </div>
                  {validator && (
                    <Progress 
                      value={Number(validator.delegatedStaked) / Number(validator.votingPower) * 100 || 0} 
                      className="h-2 bg-muted"
                      indicatorClassName="bg-blue-500"
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total Delegators</span>
                  <span className="font-mono font-bold text-lg">{isLoading ? <Skeleton className="h-6 w-12" /> : validator?.delegators}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8">Recent Blocks Proposed</h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Height</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                    </tr>
                  ))
                ) : validator?.recentBlocks?.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-muted-foreground">
                      No recent blocks proposed
                    </td>
                  </tr>
                ) : validator?.recentBlocks?.map((height) => (
                  <tr key={height} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/blocks/${height}`} className="font-mono text-primary hover:underline font-bold">
                        #{height}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Proposer</Badge>
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
