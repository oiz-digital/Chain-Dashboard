import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Shield, Cpu, Network, Database, Zap, Coins, Lock, Globe, FlaskConical,
  FileCode2, GitBranch, BarChart3, Layers, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronRight, ExternalLink, BookOpen, Code2, TrendingUp, Bot, Wrench
} from "lucide-react";

type Status = "DEPLOYED" | "IMPLEMENTED" | "ACCEPTED" | "DRAFT" | "FINAL" | "REVIEW";

const STATUS_STYLE: Record<Status, string> = {
  DEPLOYED: "bg-green-500/15 text-green-400 border-green-500/30",
  IMPLEMENTED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ACCEPTED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DRAFT: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  FINAL: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  REVIEW: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function Badge({ status }: { status: Status }) {
  return (
    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", STATUS_STYLE[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-card/60 hover:bg-card/80 transition-colors text-left"
      >
        <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
        <span className="font-semibold text-base flex-1">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

function Row({ label, value, mono = false, badge }: { label: string; value: string; mono?: boolean; badge?: Status }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 gap-4">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {badge && <Badge status={badge} />}
        <span className={cn("text-sm text-right", mono ? "font-mono text-foreground" : "text-foreground")}>{value}</span>
      </div>
    </div>
  );
}

function FeatureGrid({ items }: { items: { name: string; desc: string; status?: Status }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
      {items.map(item => (
        <div key={item.name} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-foreground">{item.name}</span>
              {item.status && <Badge status={item.status} />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const ZEPS = [
  { id: "ZEP-001", title: "PayID — UPI-style addresses", status: "ACCEPTED" as Status, cat: "Standard" },
  { id: "ZEP-002", title: "ZUSD — Native USD Stablecoin", status: "DEPLOYED" as Status, cat: "Standard" },
  { id: "ZEP-003", title: "DA Layer — Blob Transactions (EIP-4844-style)", status: "ACCEPTED" as Status, cat: "Core" },
  { id: "ZEP-005", title: "ZUSD Redemption — hint-based peg floor", status: "DEPLOYED" as Status, cat: "DeFi" },
  { id: "ZEP-006", title: "ZRC-20 Advanced Token Standard (v1.1)", status: "FINAL" as Status, cat: "Standard" },
  { id: "ZEP-007", title: "TWAP Oracle", status: "ACCEPTED" as Status, cat: "Oracle" },
  { id: "ZEP-008", title: "State Rent", status: "ACCEPTED" as Status, cat: "Core" },
  { id: "ZEP-009", title: "AI Precompile — 0xCA AIINFER (12 models)", status: "IMPLEMENTED" as Status, cat: "AI" },
  { id: "ZEP-010", title: "Threshold Signatures (FROST / BLS)", status: "ACCEPTED" as Status, cat: "Crypto" },
  { id: "ZEP-011", title: "Decentralized Price Oracle (Chainlink-style)", status: "DEPLOYED" as Status, cat: "Oracle" },
  { id: "ZEP-014", title: "AMM Pool Security — 10-layer canonical ZBX/ZUSD", status: "DEPLOYED" as Status, cat: "DeFi" },
  { id: "ZEP-015", title: "Post-Quantum Crypto (Dilithium + Kyber hybrid)", status: "IMPLEMENTED" as Status, cat: "Crypto" },
  { id: "ZEP-017", title: "Account Abstraction (ERC-4337)", status: "IMPLEMENTED" as Status, cat: "Standard" },
  { id: "ZEP-018", title: "MEV Protection — PBS + commit-reveal", status: "IMPLEMENTED" as Status, cat: "Core" },
  { id: "ZEP-019", title: "ZK Rollup — PLONK / STARK prover", status: "IMPLEMENTED" as Status, cat: "ZK" },
  { id: "ZEP-020", title: "Verkle Tree + Stateless Clients", status: "IMPLEMENTED" as Status, cat: "Core" },
  { id: "ZEP-022", title: "HotStuff-2 Consensus — full driver upgrade", status: "IMPLEMENTED" as Status, cat: "Consensus" },
  { id: "ZEP-023", title: "Slashing — inactivity + equivocation", status: "IMPLEMENTED" as Status, cat: "Consensus" },
  { id: "ZEP-024", title: "Light Client — IBC-style SPV header chain", status: "IMPLEMENTED" as Status, cat: "Network" },
  { id: "ZEP-025", title: "Confidential Transactions — Pedersen + range proofs", status: "IMPLEMENTED" as Status, cat: "Crypto" },
  { id: "ZEP-026", title: "Native Cross-Chain Layer (XCL) — trustless BLS proofs", status: "IMPLEMENTED" as Status, cat: "Bridge" },
  { id: "ZEP-031", title: "Gaming SDK — VRF, escrow, items, leaderboard", status: "IMPLEMENTED" as Status, cat: "App" },
  { id: "ZEP-032", title: "Payment Gateway — invoice, merchant, webhook", status: "IMPLEMENTED" as Status, cat: "App" },
  { id: "ZEP-033", title: "Liquid Staking — stZBX derivatives", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-034", title: "Perpetual Futures — 200× leverage, unlimited markets", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-035", title: "Yield Aggregator — farm, gauge, distributor", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-036", title: "Token Launchpad — fair launch, vesting, whitelist", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-037", title: "ZNS — Zebvix Name Service (.zbx domains)", status: "IMPLEMENTED" as Status, cat: "Standard" },
  { id: "ZEP-038", title: "Contract Factory — deterministic deploys", status: "IMPLEMENTED" as Status, cat: "Standard" },
  { id: "ZEP-039", title: "On-Chain Raffle — VRF-based", status: "IMPLEMENTED" as Status, cat: "App" },
  { id: "ZEP-040", title: "Prediction Market", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-041", title: "Card Game — on-chain collectibles", status: "IMPLEMENTED" as Status, cat: "App" },
  { id: "ZEP-042", title: "Spot Order Book — central limit order book", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-043", title: "Dated Futures", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-044", title: "Options — on-chain puts/calls", status: "IMPLEMENTED" as Status, cat: "DeFi" },
  { id: "ZEP-045", title: "Meme Factory — token creator + bonding curve", status: "IMPLEMENTED" as Status, cat: "App" },
];

const CAT_COLORS: Record<string, string> = {
  Standard: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Core: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  DeFi: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Oracle: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  AI: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
  Crypto: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  Consensus: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  ZK: "bg-red-500/10 text-red-400 border-red-500/20",
  Network: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Bridge: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  App: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const SECURITY_FIXES = [
  { id: "C-01", loc: "staking_escrow.rs", desc: "MIN_STAKE set to 32 ZBX — anyone could join validator set", fixed: true },
  { id: "S7-VM3", loc: "precompiles.rs", desc: "bn128_pairing returned true for ANY input — ZK proofs always passed", fixed: true },
  { id: "S7-ZVM", loc: "ZVM interpreter", desc: "Silent catch-all NOP instead of InvalidOpcode revert", fixed: true },
  { id: "S33/N-01", loc: "block_producer.rs", desc: "receipts_root, logs_bloom, transactions_root hardcoded zero", fixed: true },
  { id: "C-11", loc: "safety_rules.rs", desc: "advance_epoch() reset locked_qc — finality reversion possible", fixed: true },
  { id: "S4-B3", loc: "genesis.rs", desc: "No genesis hash mismatch check — silent fork possible", fixed: true },
  { id: "S6-V2", loc: "zusd_vault.rs", desc: "redeem() only decremented totalDebt not per-CDP records — vault drain", fixed: true },
  { id: "S38", loc: "zbx-trie/node.rs", desc: "MPT Branch/Extension RLP-decoder bug + non-canonical encoding", fixed: true },
  { id: "S7-EVM3", loc: "interpreter.rs", desc: "CALL/DELEGATECALL gas stipend wrong — open blocker", fixed: false },
  { id: "S7-PROD1", loc: "block header", desc: "tx_root uses flat SHA-256 not Keccak-256 MPT — ETH-incompatible", fixed: false },
];

type FilterType = "ALL" | "DEPLOYED" | "IMPLEMENTED" | "ACCEPTED" | "DRAFT" | "FINAL";

export default function Audit() {
  const [zepFilter, setZepFilter] = useState<FilterType>("ALL");
  const [catFilter, setCatFilter] = useState<string>("ALL");

  const cats = ["ALL", ...Array.from(new Set(ZEPS.map(z => z.cat))).sort()];
  const filteredZeps = ZEPS.filter(z => {
    const matchStatus = zepFilter === "ALL" || z.status === zepFilter;
    const matchCat = catFilter === "ALL" || z.cat === catFilter;
    return matchStatus && matchCat;
  });

  const deployedCount = ZEPS.filter(z => z.status === "DEPLOYED" || z.status === "IMPLEMENTED").length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto pb-16">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chain Feature Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full technical breakdown — 74 crates &bull; {ZEPS.length} ZEPs &bull; 8 security passes &bull; Rust 2021
          </p>
        </div>
        <a
          href="https://github.com/servicefree310-ctrl/Chain-Dashboard/tree/main/zbx-chain-source/zbx-chain/docs"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:bg-muted/40 flex-shrink-0"
        >
          <BookOpen className="h-3.5 w-3.5" /> Docs
        </a>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Rust Crates", value: "74", icon: Code2, color: "text-orange-400" },
          { label: "ZEPs", value: ZEPS.length.toString(), icon: BookOpen, color: "text-blue-400" },
          { label: "Live ZEPs", value: deployedCount.toString(), icon: CheckCircle2, color: "text-green-400" },
          { label: "Source Files", value: "1,427", icon: FileCode2, color: "text-violet-400" },
          { label: "Security Passes", value: "8+", icon: Shield, color: "text-cyan-400" },
          { label: "Solidity Contracts", value: "67+", icon: GitBranch, color: "text-pink-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <s.icon className={cn("h-5 w-5", s.color)} />
            <span className="text-2xl font-bold font-mono mt-1">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chain Specs */}
      <Section icon={Layers} title="Chain Specifications" color="text-cyan-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="Chain ID (Mainnet)" value="8989" mono />
            <Row label="Chain ID (Testnet)" value="8990" mono />
            <Row label="Native Token" value="ZBX (18 decimals)" mono />
            <Row label="Total Supply Cap" value="150,000,000 ZBX" mono />
            <Row label="Foundation Pre-mine" value="9,990,000 ZBX (6.66%)" mono />
            <Row label="AMM Genesis Seed" value="20,000,000 ZBX (13.33%)" mono />
            <Row label="Block Mined Supply" value="120,010,000 ZBX (80.01%)" mono />
          </div>
          <div>
            <Row label="Block Time" value="5 seconds" mono />
            <Row label="Initial Block Reward" value="3 ZBX" mono />
            <Row label="Halving Interval" value="25,000,000 blocks (~3.97 yrs)" mono />
            <Row label="Min Validator Stake" value="100 ZBX" mono />
            <Row label="Min Delegator Stake" value="10 ZBX" mono />
            <Row label="Unbonding Period" value="7 days" mono />
            <Row label="Staking APY" value="12–15%" mono />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <Row label="Address format" value="20-byte EVM (Keccak256(pubkey)[12..])" mono />
            <Row label="Transaction signatures" value="Ed25519" mono />
            <Row label="Consensus signatures" value="BLS12-381 aggregate" mono />
          </div>
          <div>
            <Row label="Storage backend" value="RocksDB" mono />
            <Row label="RPC interface" value="Ethereum JSON-RPC compatible" mono />
            <Row label="Smart contract language" value="Solidity + Rust WASM" mono />
          </div>
        </div>
      </Section>

      {/* Consensus */}
      <Section icon={Zap} title="Consensus — HotStuff-BFT v2" color="text-purple-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="Algorithm" value="HotStuff-BFT (same family: Aptos, Diem, Jolteon)" />
            <Row label="Phases" value="Prepare → PreCommit → Commit (3-phase)" />
            <Row label="Fault tolerance" value="f < n/3 Byzantine" />
            <Row label="Finality" value="Single block (5 s)" />
            <Row label="Message complexity" value="O(n) per round" />
          </div>
          <div>
            <Row label="Signature scheme" value="BLS12-381 (G1 pubkeys, G2 sigs)" />
            <Row label="Leader election" value="VRF (Verifiable Random Function)" />
            <Row label="Quorum" value="2f+1 (BLS aggregate)" />
            <Row label="Epoch rotation" value="EpochManager — epoch_manager.rs" />
            <Row label="Slashing" value="Equivocation + inactivity (ZEP-023)" />
          </div>
        </div>
        <FeatureGrid items={[
          { name: "hotstuff2.rs", desc: "Core 3-phase BFT engine with locked-QC safety rule" },
          { name: "proposer.rs", desc: "VRF-based leader election per round" },
          { name: "epoch_manager.rs", desc: "Validator set rotation at epoch boundaries" },
          { name: "gossip.rs", desc: "Fan-out vote/proposal gossip protocol" },
          { name: "peer_score.rs", desc: "Reputation scoring — penalise lazy/Byzantine peers" },
          { name: "slashing/inactivity.rs", desc: "Inactivity leak — 5% stake burn for offline validators" },
          { name: "pacemaker.rs", desc: "View-change timeout with TC aggregation" },
          { name: "bls/signing.rs", desc: "BLS12-381 key gen, sign, verify, aggregate" },
        ]} />
      </Section>

      {/* Execution / VM */}
      <Section icon={Cpu} title="Execution & Virtual Machines" color="text-red-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="EVM compatibility" value="London + Shanghai (EIP-3855, EIP-1153, EIP-5656)" />
            <Row label="Parallel execution" value="Block-STM (Rayon) with MVCC conflict detection" />
            <Row label="Fallback" value="Sequential executor on conflict" />
            <Row label="Precompiles" value="9 EVM + AI precompile (ZEP-009) + ZK verifier" />
          </div>
          <div>
            <Row label="Native ZBX-VM" value="zbx-vm — journaled state, EIP-1153 transient storage" />
            <Row label="ZK-VM" value="zbx-zvm — custom zero-knowledge VM" />
            <Row label="WASM runtime" value="zbx-wasm — sandboxed WASM smart contracts" />
            <Row label="ZK proofs" value="Groth16 (BN254) + PLONK + STARK (Goldilocks) + Plonky2" />
          </div>
        </div>
        <FeatureGrid items={[
          { name: "zbx-execution", desc: "Block-STM parallel scheduler — Rayon thread pool, MVCC" },
          { name: "zbx-evm", desc: "Full EVM interpreter — London/Shanghai opcodes, gas metering" },
          { name: "zbx-vm", desc: "Native ZBX VM — host interface, journal, precompiles" },
          { name: "zbx-zvm", desc: "ZK-VM — custom opcodes, gas schedule, tracer" },
          { name: "zbx-wasm", desc: "WASM contract runtime sandbox" },
          { name: "zbx-zk", desc: "ZK verifier — PLONK, STARK circuit" },
          { name: "zbx-prover", desc: "zkSNARK/STARK prover — Groth16, Plonky2, fraud proofs" },
          { name: "zbx-ai-precompile", desc: "0xCA AIINFER — 12 AI models as EVM precompile (ZEP-009)" },
        ]} />
      </Section>

      {/* State & Storage */}
      <Section icon={Database} title="State & Storage" color="text-green-400">
        <FeatureGrid items={[
          { name: "zbx-state", desc: "World-state DB with MPT — compute_state_root, snapshot/revert" },
          { name: "zbx-trie", desc: "Modified Merkle Patricia Trie — RLP-correct, Patricia-consensus-safe" },
          { name: "zbx-verkle", desc: "Verkle tree — stateless clients (ZEP-020)" },
          { name: "zbx-storage", desc: "RocksDB backend — blocks, state, receipts, genesis, metadata" },
          { name: "zbx-state-rent", desc: "State rent — ZEP-018, accounts pay rent or get pruned" },
          { name: "zbx-pruner", desc: "State + history pruning — configurable retention window" },
          { name: "zbx-snapshot", desc: "Snapshot export/restore for fast-sync bootstrap" },
          { name: "zbx-da", desc: "Data availability — KZG blob commitments (ZEP-003)" },
        ]} />
      </Section>

      {/* Networking */}
      <Section icon={Network} title="Networking & P2P" color="text-blue-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="Transport" value="Noise XX (mutual authenticated encryption)" />
            <Row label="Peer discovery" value="discv5 (Ethereum-compatible DHT)" />
            <Row label="Message propagation" value="GossipSub with peer scoring" />
          </div>
          <div>
            <Row label="Sync modes" value="Fast-sync, Snap-sync, Warp-sync" />
            <Row label="Light client" value="IBC-style SPV header chain (ZEP-024)" />
            <Row label="Cross-chain" value="Native XCL — trustless BLS proofs (ZEP-026)" />
          </div>
        </div>
        <FeatureGrid items={[
          { name: "zbx-network", desc: "P2P TCP transport, Noise XX handshake, JSON framing, peer registry" },
          { name: "zbx-net", desc: "discv5 DHT, RLPX, NAT traversal, connection pool" },
          { name: "zbx-gossip", desc: "GossipSub — fan-out, peer scoring, topic management" },
          { name: "zbx-sync", desc: "Multi-mode chain sync — fast/snap/warp with backfill" },
          { name: "zbx-light", desc: "Light client — SPV, header chain, IBC finality proofs" },
          { name: "zbx-xcl", desc: "Native cross-chain — channels, packets, relay (no bridge needed)" },
          { name: "zbx-bridge", desc: "Ethereum/BSC/Polygon bridge — 3-of-5 multisig, Merkle proofs" },
        ]} />
      </Section>

      {/* DeFi */}
      <Section icon={TrendingUp} title="DeFi Protocol Suite" color="text-teal-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="Native AMM" value="Uniswap v2 formula + 10-layer security stack" badge="DEPLOYED" />
            <Row label="AMM pool" value="ZBX/ZUSD (0.30% fee, genesis seeded 20M ZBX)" mono />
            <Row label="Stablecoin" value="ZUSD — backed by ZBX collateral (max 50%)" badge="DEPLOYED" />
            <Row label="Stablecoin ZINR" value="Indian Rupee stablecoin" badge="DRAFT" />
            <Row label="Lending" value="zbx-lending — collateral, interest, liquidation" badge="IMPLEMENTED" />
          </div>
          <div>
            <Row label="Perpetuals" value="200× leverage, unlimited markets, SL/TP" badge="IMPLEMENTED" />
            <Row label="Yield" value="Farm, gauge, distributor — zbx-yield" badge="IMPLEMENTED" />
            <Row label="Launchpad" value="Fair launch, vesting schedule, whitelist" badge="IMPLEMENTED" />
            <Row label="NFT" value="ZRC-721 mint, marketplace, royalties" badge="IMPLEMENTED" />
            <Row label="Order book" value="CLOB spot + dated futures + options" badge="IMPLEMENTED" />
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30">
          <p className="text-xs text-muted-foreground font-mono">AMM Security: circuit breaker → reentrancy → deadline → zero-amount → oracle deviation → slippage → price impact → k-invariant → fee deduction → overflow checks</p>
        </div>
      </Section>

      {/* Oracles */}
      <Section icon={BarChart3} title="Oracle Infrastructure" color="text-violet-400">
        <FeatureGrid items={[
          { name: "zbx-oracle", desc: "Decentralized price oracle — USD/INR feed, VWAP aggregation, circuit breaker", status: "DEPLOYED" },
          { name: "zbx-oracle-twap", desc: "TWAP oracle — on-chain accumulator, AMM pool observer (ZEP-007)", status: "ACCEPTED" },
          { name: "zbx-oracle-optimistic", desc: "Optimistic oracle — UMA-style DVM dispute resolution", status: "IMPLEMENTED" },
          { name: "zbx-oracle-zk", desc: "ZK-verified oracle feeds — provably correct price data", status: "IMPLEMENTED" },
          { name: "Bank Oracle Protocol", desc: "Validator-coordinated auto-settlement with signed bank API responses" },
          { name: "TVL Oracle", desc: "On-chain TVL tracking — pool reserves, staking, lending" },
        ]} />
      </Section>

      {/* Cryptography */}
      <Section icon={Lock} title="Cryptography & Security Primitives" color="text-rose-400">
        <FeatureGrid items={[
          { name: "BLS12-381", desc: "Aggregate signatures for consensus — G1 pubkeys, G2 sigs" },
          { name: "secp256k1", desc: "ECDSA — Ethereum-compatible tx signing" },
          { name: "Ed25519", desc: "Primary user transaction signatures" },
          { name: "KZG Commitments", desc: "Polynomial commitments for DA blobs (ZEP-003)" },
          { name: "VRF", desc: "Verifiable Random Function — leader election, gaming" },
          { name: "Merkle + MPT", desc: "State root, receipt root, tx root proofs" },
          { name: "Keccak-256", desc: "Address derivation, Ethereum-compatible hashing" },
          { name: "FROST Threshold BLS", desc: "Distributed key generation, VSS, key shares (ZEP-010)" },
          { name: "Post-Quantum (Dilithium)", desc: "zbx-pq — Dilithium + Kyber hybrid scheme (ZEP-015)", status: "IMPLEMENTED" },
          { name: "Confidential Txs", desc: "Pedersen commitments + range proofs + stealth addresses (ZEP-025)", status: "IMPLEMENTED" },
          { name: "Encrypted Keystore", desc: "zbx-keystore — keyfile, manager, HD wallet" },
          { name: "RLP + Borsh + SCALE + SSZ", desc: "Multi-codec support — Ethereum-compat + cross-chain" },
        ]} />
      </Section>

      {/* AI */}
      <Section icon={Bot} title="AI Features (ZEP-009)" color="text-fuchsia-400">
        <div className="mt-2 mb-3">
          <Row label="Precompile address" value="0xCA — AIINFER opcode" mono />
          <Row label="Activation block" value="300,000 (mainnet planned)" mono />
          <Row label="On-chain models" value="12 AI models as EVM precompile" />
          <Row label="Gas metering" value="Per-model inference gas table" />
        </div>
        <FeatureGrid items={[
          { name: "zbx-ai-precompile", desc: "EVM precompile 0xCA — call AI inference from any Solidity contract" },
          { name: "zbx-ai-sdk", desc: "AI model SDK — agent, executor, oracle integration, risk scoring" },
          { name: "zbx-ai-registry", desc: "On-chain AI model registry — verifiable model hashes" },
        ]} />
      </Section>

      {/* RPC & Developer Tools */}
      <Section icon={Globe} title="RPC & Developer Tools" color="text-yellow-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="JSON-RPC HTTP" value="Ethereum-compatible eth_* / zbx_* / net_* / web3_*" />
            <Row label="WebSocket" value="eth_subscribe — newHeads, logs, pendingTxs" />
            <Row label="Custom methods" value="zbx_chainInfo, zbx_getValidator, zbx_getStake, ..." />
          </div>
          <div>
            <Row label="JavaScript SDK" value="zebvix-js + ethers-zbx (sdk/)" />
            <Row label="CLI" value="zebvix-node CLI — wallet, stake, DeFi, governance" />
            <Row label="Indexer" value="zbx-indexer — schema, TVL, search API" />
          </div>
        </div>
        <FeatureGrid items={[
          { name: "zbx-rpc", desc: "JSON-RPC 2.0 HTTP + WebSocket server" },
          { name: "zbx-jsonrpc", desc: "Transport layer — HTTP, pubsub, router" },
          { name: "zbx-trace", desc: "Transaction trace — call trace, opcode-level debug trace" },
          { name: "zbx-indexer", desc: "On-chain data indexer — schema, TVL, activity" },
          { name: "zbx-explorer", desc: "Block explorer API — search, pagination, WebSocket" },
          { name: "zbx-admin", desc: "Node admin — auth, backup, validator management" },
          { name: "zbx-sdk (Rust)", desc: "Developer SDK — provider, signer, multicall, ABI utils" },
          { name: "zbx-wallet", desc: "HD wallet — BIP-32, EIP-712, PQ wallet, multisig" },
          { name: "zbx-cli", desc: "CLI — wallet, stake, governance, DeFi, RPC commands" },
        ]} />
      </Section>

      {/* Observability */}
      <Section icon={BarChart3} title="Observability & Operations" color="text-amber-400">
        <FeatureGrid items={[
          { name: "zbx-metrics", desc: "Prometheus /metrics endpoint (port 9001) — counters, histograms" },
          { name: "zbx-telemetry", desc: "OpenTelemetry OTLP export — distributed tracing" },
          { name: "zbx-trace", desc: "Per-tx call trace + opcode-level trace for debugging" },
          { name: "Grafana dashboards", desc: "monitoring/ — pre-built node dashboards" },
          { name: "Alertmanager rules", desc: "monitoring/ — alert on missed blocks, slash events" },
          { name: "Kubernetes manifests", desc: "k8s/ — full node, archive, validator, light node" },
          { name: "Docker compose", desc: "docker/ — node + metrics + indexer stack" },
          { name: "Systemd units", desc: "deploy/ — systemd service + nginx proxy" },
        ]} />
      </Section>

      {/* Fuzz & Tests */}
      <Section icon={FlaskConical} title="Testing & Fuzzing" color="text-emerald-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
          <div>
            <Row label="Integration tests" value="tests/ — full E2E blockchain scenarios" />
            <Row label="Property tests" value="Proptest — MPT, RLP, consensus invariants" />
            <Row label="Fuzz targets" value="fuzz/ — cargo-fuzz for RLP, ZVM, trie, block import" />
          </div>
          <div>
            <Row label="Benchmarks" value="benches/ — Criterion benchmarks" />
            <Row label="ZVM integration tests" value="20 pass/fail test files in zbx-zvm/tests/" />
            <Row label="MPT tests" value="17/17 pass — trie_basic, proptest, order independence" />
          </div>
        </div>
      </Section>

      {/* JS / API Layer Fixes */}
      <Section icon={Wrench} title="API Layer Audit — Fixes Applied (2026-05-18)" color="text-orange-400">
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          Full audit of the JavaScript simulation & API server layer (Express 5 + Drizzle ORM). All P0 and P1 issues resolved.
        </p>
        <div className="space-y-1.5">
          {[
            { id: "JS-01", severity: "P0", loc: "analytics.ts:67",   desc: "totalSupply hardcoded to 500M (3× wrong). Fixed → 150M cap per chain spec. circulating now derived from real mined supply formula.", fixed: true },
            { id: "JS-02", severity: "P0", loc: "blocks.ts:138",      desc: "Math.random() used for tx amounts inside block — same block returned different data on every request. Fixed → seededRandom(height×31+i×7).", fixed: true },
            { id: "JS-03", severity: "P0", loc: "wallet.ts:38",       desc: "Math.random() for lastSeen — same address returned different last-seen timestamp each call. Fixed → seededRandom(seed) deterministic.", fixed: true },
            { id: "JS-04", severity: "P0", loc: "chain.ts:69",        desc: "Math.random() for avgBlockTime — network stats changed randomly per request. Fixed → seededRandom(Math.floor(nowSec/60)).", fixed: true },
            { id: "JS-05", severity: "P0", loc: "blocks.ts:27-38",    desc: "LCG (32-bit linear congruential) used for block hashes — NOT a real cryptographic hash. Fixed → SHA-256 via Node.js crypto.createHash().", fixed: true },
            { id: "JS-06", severity: "P1", loc: "blocks.ts:11-17",    desc: "Only 5 validator addresses rotated as block producers — 16 validators never proposed blocks. Fixed → 21-validator list matching full active set.", fixed: true },
            { id: "JS-07", severity: "P1", loc: "analytics.ts",       desc: "No DB-backed supply. circulating used magic number 0.62 with no source. Fixed → formula from FOUNDATION_PREMINE + AMM_POOL_SEED + mined×0.62.", fixed: true },
            { id: "JS-08", severity: "P1", loc: "wallet.ts",          desc: "Wallet balances derived from addrSeed() only — no persistence. Fixed → accounts table with DB upsert. First access creates record, subsequent updates persist.", fixed: true },
            { id: "JS-09", severity: "P1", loc: "staking.ts",         desc: "No delegation write APIs. Fixed → POST /staking/delegate and POST /staking/undelegate with staking_delegations table, balance debit, validator stake update.", fixed: true },
            { id: "JS-10", severity: "P1", loc: "governance.ts",      desc: "No vote write API. Fixed → POST /governance/vote with governance_votes table, duplicate-vote prevention, proposal tally update.", fixed: true },
            { id: "JS-11", severity: "P1", loc: "transactions.ts",    desc: "No send transaction API. Fixed → POST /transactions/send with chain_transactions table, balance check, account debit/credit, deterministic txHash.", fixed: true },
            { id: "JS-12", severity: "P1", loc: "—",                  desc: "No global search endpoint. Fixed → GET /search?q= searching blocks, transactions, validators, proposals, pools, addresses in parallel.", fixed: true },
            { id: "JS-13", severity: "P2", loc: "dex.ts:65",          desc: "DEX swap quote fallback used Math.sin(Date.now()) for live price — value changed 180s period. Kept sin-wave but made seed time-quantized to minute boundary.", fixed: true },
          ].map(f => (
            <div key={f.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-green-500/5 border-green-500/20 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-foreground">{f.id}</span>
                  <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded border",
                    f.severity === "P0" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                    f.severity === "P1" ? "bg-orange-500/15 text-orange-400 border-orange-500/30" :
                    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                  )}>{f.severity}</span>
                  <span className="font-mono text-muted-foreground">{f.loc}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30">FIXED</span>
            </div>
          ))}
        </div>

        {/* New DB tables */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">New DB Tables Added</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { name: "chain_blocks",        desc: "Persisted block records — height, hash, parentHash, stateRoot, txRoot, validator, gasUsed, reward" },
              { name: "chain_transactions",  desc: "Real TX persistence — hash, from/to, amount, fee, status, type, gasUsed, data. Populated via POST /transactions/send" },
              { name: "accounts",            desc: "Wallet state — balance, stakedAmount, nonce, txCount, totalSent/Received. Created on first wallet lookup" },
              { name: "staking_delegations", desc: "Delegation records — delegator, validator, amount, status (active/unbonding/unbonded), txHash, unbondingAt" },
              { name: "governance_votes",    desc: "On-chain vote records — proposalId, voterAddress, option, votingPower, txHash. Prevents double-voting" },
            ].map(t => (
              <div key={t.name} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <span className="text-xs font-mono text-foreground">{t.name}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* New write APIs */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">New Write APIs</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { method: "POST", path: "/api/transactions/send",       desc: "Send ZBX transfer — validates balance, inserts TX record, updates accounts" },
              { method: "POST", path: "/api/governance/vote",          desc: "Cast vote on proposal — prevents duplicates, updates yes/no/abstain tallies" },
              { method: "POST", path: "/api/staking/delegate",         desc: "Delegate ZBX to validator — debits account, updates validator totalStaked" },
              { method: "POST", path: "/api/staking/undelegate",       desc: "Undelegate with 21-day unbonding — creates unbonding record" },
              { method: "GET",  path: "/api/staking/delegations/:addr",desc: "List all delegations for an address" },
              { method: "GET",  path: "/api/governance/:id/votes",     desc: "List all votes for a governance proposal" },
              { method: "GET",  path: "/api/search?q=",                desc: "Global search — blocks, txs, validators, proposals, pools, addresses" },
            ].map(a => (
              <div key={a.path} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border/30">
                <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5",
                  a.method === "POST" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "bg-green-500/15 text-green-400 border border-green-500/20"
                )}>{a.method}</span>
                <div>
                  <span className="text-[11px] font-mono text-foreground">{a.path}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section icon={Shield} title="Security Audit Log" color="text-cyan-400">
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          8+ internal security passes completed (Sessions 1–52, 2026-04-30 → 2026-05-09). External audit targeting Q3 2026.
          <a href="https://github.com/servicefree310-ctrl/Chain-Dashboard/blob/main/zbx-chain-source/zbx-chain/AUDIT_2026-04-30.md"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 ml-1.5 text-primary hover:underline">
            Full log <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
        <div className="space-y-1.5 mt-2">
          {SECURITY_FIXES.map(f => (
            <div key={f.id} className={cn(
              "flex items-start gap-3 p-2.5 rounded-lg border text-xs",
              f.fixed ? "bg-green-500/5 border-green-500/20" : "bg-yellow-500/5 border-yellow-500/20"
            )}>
              {f.fixed
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <span className="font-mono text-foreground">{f.id}</span>
                <span className="text-muted-foreground mx-1.5">·</span>
                <span className="font-mono text-muted-foreground">{f.loc}</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
              <span className={cn("flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border",
                f.fixed ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
              )}>
                {f.fixed ? "FIXED" : "OPEN"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ZEP Table */}
      <Section icon={BookOpen} title={`ZEP Enhancement Proposals (${ZEPS.length} total)`} color="text-blue-400">
        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          <div className="flex gap-1 flex-wrap">
            {(["ALL", "DEPLOYED", "IMPLEMENTED", "ACCEPTED", "DRAFT", "FINAL"] as const).map(f => (
              <button key={f} onClick={() => setZepFilter(f)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  zepFilter === f ? "bg-primary/20 text-primary border-primary/40" : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                )}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap ml-auto">
            {cats.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  catFilter === c ? "bg-primary/20 text-primary border-primary/40"
                    : cn("bg-muted/30 text-muted-foreground border-border hover:text-foreground",
                      c !== "ALL" && CAT_COLORS[c] ? "" : ""
                    )
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {filteredZeps.map(z => (
            <div key={z.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border/40">
              <span className="font-mono text-xs text-muted-foreground w-16 flex-shrink-0">{z.id}</span>
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0", CAT_COLORS[z.cat] ?? "text-muted-foreground bg-muted/30 border-border")}>
                {z.cat}
              </span>
              <span className="text-sm flex-1 text-foreground">{z.title}</span>
              <Badge status={z.status} />
            </div>
          ))}
          {filteredZeps.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No ZEPs match this filter</div>
          )}
        </div>
      </Section>

      {/* Mainnet Readiness */}
      <Section icon={Clock} title="Mainnet Readiness (2026-05-09)" color="text-orange-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {[
            { layer: "Consensus (HotStuff-2 + BLS)", code: true, audited: "internal", battle: false },
            { layer: "EVM + ZVM execution", code: true, audited: "internal", battle: false },
            { layer: "State / MPT / RocksDB", code: true, audited: "internal", battle: false },
            { layer: "P2P transport (Noise XX)", code: true, audited: "internal", battle: false },
            { layer: "RPC layer", code: true, audited: "partial", battle: "partial" },
            { layer: "Mempool", code: true, audited: "internal", battle: false },
            { layer: "Smart contracts (33+ Solidity)", code: true, audited: "internal", battle: false },
            { layer: "Bridge (multi-sig threshold)", code: true, audited: "none", battle: false },
            { layer: "Slashing economics", code: "partial", audited: "none", battle: false },
            { layer: "Governance", code: "partial", audited: "none", battle: false },
            { layer: "Genesis tooling", code: true, audited: "partial", battle: false },
          ].map(item => (
            <div key={item.layer} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
              <div className={cn("h-2 w-2 rounded-full flex-shrink-0",
                item.code === true && item.audited !== "none" ? "bg-yellow-500" : item.code === true ? "bg-green-500/60" : "bg-red-500/60"
              )} />
              <span className="text-xs text-foreground flex-1">{item.layer}</span>
              <div className="flex gap-1 flex-shrink-0">
                <span className={cn("text-[9px] font-mono px-1 py-0.5 rounded",
                  item.code === true ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                )}>
                  {item.code === true ? "CODE✓" : "PARTIAL"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
          <p className="text-xs text-yellow-400 font-medium">Status: NOT MAINNET-READY</p>
          <p className="text-xs text-muted-foreground mt-1">Code-complete. Pending: external security audit (Q3 2026), 3+ months testnet bake, genesis ceremony, validator onboarding.</p>
        </div>
      </Section>
    </div>
  );
}
