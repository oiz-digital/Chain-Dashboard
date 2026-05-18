import React, { useState } from "react";
import { Vote, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ProposalStatus = "all" | "voting_period" | "passed" | "rejected" | "deposit_period" | "failed";

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposalType: string;
  status: string;
  proposerAddress: string;
  submitTime: string;
  depositEndTime: string;
  votingStartTime: string | null;
  votingEndTime: string | null;
  totalDeposit: string;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  noWithVetoVotes: string;
  totalVotingPower: string;
  quorumReached: boolean;
  contentSummary: string | null;
}

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 12, title: "ZEP-012: Enable Dynamic Gas Pricing", description: "Introduce EIP-1559 style base fee mechanism for ZBX chain to improve fee predictability and reduce spam.", proposalType: "parameter_change", status: "voting_period", proposerAddress: "zbx1val0x7a3f9e2c4b8d1a6f0e5c9b2d7", submitTime: "2026-05-10T09:00:00Z", depositEndTime: "2026-05-24T09:00:00Z", votingStartTime: "2026-05-12T09:00:00Z", votingEndTime: "2026-05-26T09:00:00Z", totalDeposit: "50000", yesVotes: "28420000", noVotes: "4180000", abstainVotes: "2100000", noWithVetoVotes: "380000", totalVotingPower: "49440000", quorumReached: true, contentSummary: "Adjust base_fee_change_denominator to 8, max_fee_per_gas cap at 500 gwei.",
  },
  {
    id: 11, title: "ZEP-011: Expand AI Inference Precompile (0xCA)", description: "Add 4 new large language model slots to the AI precompile, enabling on-chain inference for vision models.", proposalType: "software_upgrade", status: "passed", proposerAddress: "zbx1val0x2b5f8d1e4c9a3f7e0b6d2c5", submitTime: "2026-04-20T12:00:00Z", depositEndTime: "2026-05-04T12:00:00Z", votingStartTime: "2026-04-22T12:00:00Z", votingEndTime: "2026-05-06T12:00:00Z", totalDeposit: "80000", yesVotes: "41200000", noVotes: "1800000", abstainVotes: "900000", noWithVetoVotes: "120000", totalVotingPower: "49440000", quorumReached: true, contentSummary: "Upgrade block height: 8,200,000. New model types: vision-7b, code-13b, multimodal-34b, audio-7b.",
  },
  {
    id: 10, title: "ZEP-010: Reduce Validator Commission Cap to 20%", description: "Lower the maximum allowed validator commission rate from 30% to 20% to protect delegators.", proposalType: "parameter_change", status: "passed", proposerAddress: "zbx1val0x9c4e7b2f5a8d3e1c6b0f9", submitTime: "2026-04-01T08:00:00Z", depositEndTime: "2026-04-15T08:00:00Z", votingStartTime: "2026-04-03T08:00:00Z", votingEndTime: "2026-04-17T08:00:00Z", totalDeposit: "60000", yesVotes: "38700000", noVotes: "7200000", abstainVotes: "1400000", noWithVetoVotes: "200000", totalVotingPower: "49440000", quorumReached: true, contentSummary: "max_commission: 0.30 → 0.20, effective at block 7,900,000.",
  },
  {
    id: 9, title: "ZEP-009: Treasury Fund for Ecosystem Grants Q2 2026", description: "Allocate 2,000,000 ZBX from community pool for developer grants in Q2 2026.", proposalType: "community_pool_spend", status: "passed", proposerAddress: "zbx1val0x7a3f9e2c4b8d1a6f0e5c9b2d7", submitTime: "2026-03-15T10:00:00Z", depositEndTime: "2026-03-29T10:00:00Z", votingStartTime: "2026-03-17T10:00:00Z", votingEndTime: "2026-03-31T10:00:00Z", totalDeposit: "100000", yesVotes: "45100000", noVotes: "2100000", abstainVotes: "800000", noWithVetoVotes: "140000", totalVotingPower: "49440000", quorumReached: true, contentSummary: "Recipient: zbx1grants0000000000. Amount: 2,000,000 ZBX.",
  },
  {
    id: 8, title: "ZEP-008: Increase Block Gas Limit to 60M", description: "Raise per-block gas limit from 40M to 60M to accommodate growing DeFi activity.", proposalType: "parameter_change", status: "rejected", proposerAddress: "zbx1val0x2b5f8d1e4c9a3f7e0b6d2c5", submitTime: "2026-02-28T06:00:00Z", depositEndTime: "2026-03-13T06:00:00Z", votingStartTime: "2026-03-02T06:00:00Z", votingEndTime: "2026-03-16T06:00:00Z", totalDeposit: "30000", yesVotes: "14200000", noVotes: "28900000", abstainVotes: "3100000", noWithVetoVotes: "1800000", totalVotingPower: "49440000", quorumReached: true, contentSummary: "Proposed block_gas_limit: 60,000,000. Rejected due to node hardware concerns.",
  },
  {
    id: 13, title: "ZEP-013: IBC Wasm Light Client Support", description: "Enable Wasm-based light client verification for enhanced IBC interoperability with Cosmos ecosystem.", proposalType: "software_upgrade", status: "deposit_period", proposerAddress: "zbx1val0x9c4e7b2f5a8d3e1c6b0f9", submitTime: "2026-05-17T14:00:00Z", depositEndTime: "2026-05-31T14:00:00Z", votingStartTime: null, votingEndTime: null, totalDeposit: "8000", yesVotes: "0", noVotes: "0", abstainVotes: "0", noWithVetoVotes: "0", totalVotingPower: "49440000", quorumReached: false, contentSummary: "Requires 10,000 ZBX deposit. Current: 8,000 ZBX.",
  },
];

const PARAMS = {
  minDepositAmount: "10,000", maxDepositPeriodDays: 14, votingPeriodDays: 14,
  quorum: "33.40%", threshold: "50.00%", vetoThreshold: "33.40%",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  voting_period:  { label: "Voting",    color: "text-blue-400",   icon: Vote,          bg: "bg-blue-500/15 border-blue-500/30" },
  passed:         { label: "Passed",    color: "text-green-400",  icon: CheckCircle2,  bg: "bg-green-500/15 border-green-500/30" },
  rejected:       { label: "Rejected",  color: "text-red-400",    icon: XCircle,       bg: "bg-red-500/15 border-red-500/30" },
  deposit_period: { label: "Deposit",   color: "text-yellow-400", icon: AlertCircle,   bg: "bg-yellow-500/15 border-yellow-500/30" },
  failed:         { label: "Failed",    color: "text-zinc-400",   icon: XCircle,       bg: "bg-zinc-500/15 border-zinc-500/30" },
};

const TYPE_LABELS: Record<string, string> = {
  text: "Text", parameter_change: "Param Change", software_upgrade: "Upgrade",
  community_pool_spend: "Treasury Spend", cancel_software_upgrade: "Cancel Upgrade",
};

function VoteBar({ yes, no, abstain, veto, total }: { yes: string; no: string; abstain: string; veto: string; total: string }) {
  const t = Number(total) || 1;
  const yP = (Number(yes) / t) * 100;
  const nP = (Number(no) / t) * 100;
  const aP = (Number(abstain) / t) * 100;
  const vP = (Number(veto) / t) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        <div className="bg-green-500 transition-all" style={{ width: `${yP}%` }} />
        <div className="bg-red-500 transition-all"   style={{ width: `${nP}%` }} />
        <div className="bg-zinc-500 transition-all"  style={{ width: `${aP}%` }} />
        <div className="bg-orange-500 transition-all" style={{ width: `${vP}%` }} />
      </div>
      <div className="flex gap-3 text-[10px]">
        {[
          { label: "Yes", val: yP, color: "text-green-400" },
          { label: "No",  val: nP, color: "text-red-400" },
          { label: "Abstain", val: aP, color: "text-zinc-400" },
          { label: "Veto", val: vP, color: "text-orange-400" },
        ].map(x => (
          <span key={x.label} className={cn("flex items-center gap-1", x.color)}>
            <span className="font-semibold">{x.val.toFixed(1)}%</span>
            <span className="text-muted-foreground">{x.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const FILTER_TABS: { key: ProposalStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "voting_period", label: "Voting" },
  { key: "passed", label: "Passed" },
  { key: "rejected", label: "Rejected" },
  { key: "deposit_period", label: "Deposit" },
];

export default function GovernancePage() {
  const [filter, setFilter] = useState<ProposalStatus>("all");
  const [selected, setSelected] = useState<Proposal | null>(null);

  const proposals = filter === "all"
    ? MOCK_PROPOSALS
    : MOCK_PROPOSALS.filter(p => p.status === filter);

  const counts = {
    all: MOCK_PROPOSALS.length,
    voting_period: MOCK_PROPOSALS.filter(p => p.status === "voting_period").length,
    passed: MOCK_PROPOSALS.filter(p => p.status === "passed").length,
    rejected: MOCK_PROPOSALS.filter(p => p.status === "rejected").length,
    deposit_period: MOCK_PROPOSALS.filter(p => p.status === "deposit_period").length,
    failed: 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">On-chain proposals and protocol parameter changes</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
          <Vote className="h-4 w-4" />
          New Proposal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Proposals", value: String(MOCK_PROPOSALS.length), sub: "All time" },
          { label: "Active Voting",   value: String(counts.voting_period), sub: "In progress" },
          { label: "Passed",          value: String(counts.passed), sub: "Implemented" },
          { label: "Voting Period",   value: "14 days", sub: "33.4% quorum required" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className="text-2xl font-bold mt-2">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Proposals List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-muted/40 border border-border/40 rounded-xl p-1 w-fit flex-wrap">
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  filter === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                  filter === t.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {proposals.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.failed;
              const Icon = cfg.icon;
              const totalVotes = Number(p.yesVotes) + Number(p.noVotes) + Number(p.abstainVotes) + Number(p.noWithVetoVotes);
              const turnout = Number(p.totalVotingPower) > 0
                ? (totalVotes / Number(p.totalVotingPower) * 100).toFixed(1)
                : "0";
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  className={cn(
                    "bg-card border rounded-2xl p-5 cursor-pointer transition-all shadow-sm space-y-3",
                    selected?.id === p.id ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("text-xs font-mono px-2 py-1 rounded-full border flex-shrink-0 mt-0.5", cfg.bg, cfg.color)}>
                      #{p.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug">{p.title}</p>
                        <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0", cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded mt-1 inline-block">
                        {TYPE_LABELS[p.proposalType] ?? p.proposalType}
                      </span>
                    </div>
                  </div>

                  {p.status !== "deposit_period" && Number(p.totalVotingPower) > 0 && (
                    <VoteBar yes={p.yesVotes} no={p.noVotes} abstain={p.abstainVotes} veto={p.noWithVetoVotes} total={p.totalVotingPower} />
                  )}

                  {p.status === "deposit_period" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Deposit Progress</span>
                        <span>{Number(p.totalDeposit).toLocaleString()} / 10,000 ZBX</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min(100, Number(p.totalDeposit) / 100)}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{p.proposerAddress.slice(0, 20)}…</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {p.status === "voting_period" && p.votingEndTime
                        ? `Ends ${new Date(p.votingEndTime).toLocaleDateString()}`
                        : new Date(p.submitTime).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel + params */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Proposal #{selected.id}</h3>
                <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
              {selected.contentSummary && (
                <div className="bg-muted/30 border border-border/40 rounded-xl p-3 text-xs font-mono text-muted-foreground leading-relaxed">
                  {selected.contentSummary}
                </div>
              )}
              <div className="space-y-2 text-xs">
                {[
                  { label: "Submit Time",   value: new Date(selected.submitTime).toLocaleString() },
                  { label: "Deposit End",   value: new Date(selected.depositEndTime).toLocaleString() },
                  selected.votingStartTime && { label: "Voting Start", value: new Date(selected.votingStartTime).toLocaleString() },
                  selected.votingEndTime   && { label: "Voting End",   value: new Date(selected.votingEndTime).toLocaleString() },
                  { label: "Total Deposit", value: `${Number(selected.totalDeposit).toLocaleString()} ZBX` },
                  selected.status !== "deposit_period" && { label: "Quorum Reached", value: selected.quorumReached ? "Yes" : "No" },
                ].filter(Boolean).map((row: any) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
              {selected.status === "voting_period" && (
                <div className="grid grid-cols-2 gap-2">
                  <button className="w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/25 transition-colors">Vote Yes</button>
                  <button className="w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors">Vote No</button>
                  <button className="py-2.5 rounded-xl bg-zinc-500/15 border border-zinc-500/30 text-zinc-400 text-sm font-semibold hover:bg-zinc-500/25 transition-colors">Abstain</button>
                  <button className="py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-semibold hover:bg-orange-500/25 transition-colors">Veto</button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
              <Vote className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground text-center">Click a proposal to see details and vote</p>
            </div>
          )}

          {/* Governance Params */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Governance Parameters</h3>
            </div>
            {Object.entries(PARAMS).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground font-mono">{k}</span>
                <span className="font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
