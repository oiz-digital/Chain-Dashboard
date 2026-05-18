import React from "react";
import { Globe, ArrowRightLeft, PackageCheck, PackageX, Zap, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const IBC_CHANNELS = [
  { id: 1, channelId: "channel-0", portId: "transfer", counterpartyChain: "Cosmos Hub",  counterpartyChannelId: "channel-391", counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 48_210, packetsReceived: 51_890, totalValueUsd: "12400000", chainColor: "bg-purple-500/20 text-purple-400" },
  { id: 2, channelId: "channel-1", portId: "transfer", counterpartyChain: "Osmosis",     counterpartyChannelId: "channel-9482", counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 124_500, packetsReceived: 119_200, totalValueUsd: "8900000", chainColor: "bg-pink-500/20 text-pink-400" },
  { id: 3, channelId: "channel-2", portId: "transfer", counterpartyChain: "Celestia",    counterpartyChannelId: "channel-71",  counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 19_800, packetsReceived: 21_400, totalValueUsd: "4200000", chainColor: "bg-cyan-500/20 text-cyan-400" },
  { id: 4, channelId: "channel-3", portId: "transfer", counterpartyChain: "Neutron",     counterpartyChannelId: "channel-44",  counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 8_940, packetsReceived: 9_120, totalValueUsd: "1800000", chainColor: "bg-orange-500/20 text-orange-400" },
  { id: 5, channelId: "channel-4", portId: "transfer", counterpartyChain: "Stride",      counterpartyChannelId: "channel-62",  counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 62_100, packetsReceived: 58_400, totalValueUsd: "6300000", chainColor: "bg-blue-500/20 text-blue-400" },
  { id: 6, channelId: "channel-5", portId: "transfer", counterpartyChain: "Axelar",      counterpartyChannelId: "channel-312", counterpartyPortId: "transfer", status: "open", ordering: "unordered", version: "ics20-1", packetsSent: 31_200, packetsReceived: 28_700, totalValueUsd: "3100000", chainColor: "bg-green-500/20 text-green-400" },
  { id: 7, channelId: "channel-6", portId: "transfer", counterpartyChain: "Evmos",       counterpartyChannelId: "channel-83",  counterpartyPortId: "transfer", status: "closed", ordering: "unordered", version: "ics20-1", packetsSent: 4_200, packetsReceived: 4_198, totalValueUsd: "0", chainColor: "bg-red-500/20 text-red-400" },
];

const RECENT_PACKETS = [
  { id: "pkt001", from: "ZBX Chain", to: "Cosmos Hub",  type: "FungibleTokenPacket", token: "1,000 ZBX",   value: "$84.70",  status: "success", time: "30s ago" },
  { id: "pkt002", from: "Osmosis",   to: "ZBX Chain",   type: "FungibleTokenPacket", token: "500 OSMO",    value: "$520",    status: "success", time: "1m ago" },
  { id: "pkt003", from: "ZBX Chain", to: "Stride",      type: "FungibleTokenPacket", token: "50,000 ZBX",  value: "$4,235",  status: "success", time: "3m ago" },
  { id: "pkt004", from: "Celestia",  to: "ZBX Chain",   type: "FungibleTokenPacket", token: "100 TIA",     value: "$660",    status: "pending", time: "5m ago" },
  { id: "pkt005", from: "ZBX Chain", to: "Axelar",      type: "FungibleTokenPacket", token: "200,000 ZBX", value: "$16,940", status: "success", time: "8m ago" },
];

export default function IbcPage() {
  const openChannels   = IBC_CHANNELS.filter(c => c.status === "open").length;
  const totalPackets   = IBC_CHANNELS.reduce((s, c) => s + c.packetsSent + c.packetsReceived, 0);
  const totalValueUsd  = IBC_CHANNELS.reduce((s, c) => s + Number(c.totalValueUsd), 0);
  const connectedChains = new Set(IBC_CHANNELS.filter(c => c.status === "open").map(c => c.counterpartyChain)).size;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-400" />
            IBC Channels
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Inter-Blockchain Communication channels and cross-chain packet activity</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-card border border-border/60 rounded-xl px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-muted-foreground">{openChannels} channels open</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Connected Chains",    value: String(connectedChains), icon: Globe,        color: "bg-cyan-500/15 text-cyan-400" },
          { label: "Open Channels",       value: String(openChannels),   icon: ArrowRightLeft, color: "bg-green-500/15 text-green-400" },
          { label: "Total Packets",       value: `${(totalPackets / 1000).toFixed(0)}K`,       icon: PackageCheck, color: "bg-primary/15 text-primary" },
          { label: "Total Value Bridged", value: `$${(totalValueUsd / 1_000_000).toFixed(2)}M`, icon: Zap, color: "bg-purple-500/15 text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
              <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels table */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="font-semibold text-sm">IBC Channels</h3>
          </div>
          <div className="divide-y divide-border/20">
            {IBC_CHANNELS.map(ch => (
              <div key={ch.id} className="px-5 py-4 hover:bg-muted/20 transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold", ch.chainColor)}>
                      {ch.counterpartyChain[0]}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">{ch.counterpartyChain}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {ch.channelId} ↔ {ch.counterpartyChannelId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border",
                      ch.status === "open"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    )}>
                      {ch.status}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                      {ch.version}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Packets Sent</p>
                    <p className="font-semibold">{ch.packetsSent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Received</p>
                    <p className="font-semibold">{ch.packetsReceived.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Value Bridged</p>
                    <p className="font-semibold text-primary">
                      {ch.status === "open"
                        ? `$${(Number(ch.totalValueUsd) / 1_000_000).toFixed(2)}M`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Packets */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h3 className="font-semibold text-sm">Recent IBC Packets</h3>
            </div>
            <div className="divide-y divide-border/20">
              {RECENT_PACKETS.map(p => (
                <div key={p.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{p.from} → {p.to}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.token} · {p.value}</div>
                      <div className="text-[10px] text-muted-foreground">{p.time}</div>
                    </div>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0",
                      p.status === "success" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                    )}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IBC Version info */}
          <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-2">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">Protocol Info</h3>
            {[
              { k: "IBC Version", v: "IBC v7.1" },
              { k: "Light Client", v: "Tendermint" },
              { k: "Packet Timeout", v: "1 hour" },
              { k: "Relayer Count", v: "8 active" },
            ].map(row => (
              <div key={row.k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{row.k}</span>
                <span className="font-semibold">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
