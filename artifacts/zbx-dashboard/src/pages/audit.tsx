import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Info, ChevronDown,
  ChevronRight, ExternalLink, BookOpen, Code2, FileCode2, GitBranch,
  Lock, Zap, Cpu, Database, Network, BarChart3, Bot, Wrench, Bug,
  FlaskConical, Search, Filter, TrendingUp, Layers, AlertCircle,
  ShieldCheck, ShieldAlert, ShieldX, Activity
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Sev    = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type Status = "DEPLOYED" | "IMPLEMENTED" | "ACCEPTED" | "DRAFT" | "FINAL" | "REVIEW";
type AuditStatus = "PASS" | "PASS_WITH_NOTES" | "FAIL" | "OPEN";

interface Finding {
  id:     string;
  sev:    Sev;
  cwe?:   string;
  loc:    string;
  title:  string;
  desc:   string;
  status: AuditStatus;
  fix?:   string;
}

interface CrateAudit {
  name:         string;
  category:     string;
  linesEst:     number;
  unsafeBlocks: number;
  unwraps:      number;
  status:       AuditStatus;
  critical:     number;
  high:         number;
  medium:       number;
  low:          number;
  info:         number;
  notes?:       string;
}

// ─── Colour helpers ────────────────────────────────────────────────────────────

const SEV_COLOR: Record<Sev, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  INFO:     "bg-muted/40 text-muted-foreground border-border/50",
};
const SEV_DOT: Record<Sev, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-yellow-500",
  LOW:      "bg-blue-500",
  INFO:     "bg-muted-foreground",
};
const AUDIT_COLOR: Record<AuditStatus, string> = {
  PASS:            "text-green-400",
  PASS_WITH_NOTES: "text-yellow-400",
  FAIL:            "text-red-400",
  OPEN:            "text-muted-foreground",
};
const AUDIT_ICON: Record<AuditStatus, React.ElementType> = {
  PASS:            ShieldCheck,
  PASS_WITH_NOTES: ShieldAlert,
  FAIL:            ShieldX,
  OPEN:            Shield,
};

// ─── All Findings ─────────────────────────────────────────────────────────────

const FINDINGS: Finding[] = [
  // ── CRITICAL ──
  {
    id: "ZRS-001", sev: "CRITICAL", cwe: "CWE-362", loc: "zbx-consensus/src/hotstuff2.rs:214",
    title: "Double-vote possible if pacemaker view-change races commit phase",
    desc:  "Under concurrent pacemaker timeout and commit message delivery, a validator can emit two PREPARE votes for different proposals in the same view due to a missing lock_qc guard in advance_view(). An adversarial coordinator can trigger this to double-vote without equivocation detection firing.",
    status: "OPEN",
    fix:   "Acquire view_lock before emitting any vote; gate advance_view() with locked_qc.view check."
  },
  {
    id: "ZRS-002", sev: "CRITICAL", cwe: "CWE-682", loc: "zbx-evm/src/interpreter.rs:891",
    title: "CALL/DELEGATECALL gas stipend 63/64 rule not applied",
    desc:  "EIP-150 requires child CALL to receive at most 63/64 of available gas. The current implementation passes parent_gas unmodified, allowing deep call stacks to consume more gas than the block limit — a re-entrancy amplification vector that also breaks ETH-compatibility.",
    status: "OPEN",
    fix:   "Apply gas.saturating_sub(gas / 64) before forwarding to child frame."
  },
  {
    id: "ZRS-003", sev: "CRITICAL", cwe: "CWE-347", loc: "zbx-block/src/validation.rs:178",
    title: "tx_root computed as flat SHA-256 instead of Keccak-256 MPT",
    desc:  "Block header tx_root is SHA-256(concat(tx_bytes)) instead of Keccak-256 Merkle Patricia Trie of RLP-encoded transactions. This breaks ETH JSON-RPC compatibility and all bridge proofs that verify transaction membership.",
    status: "OPEN",
    fix:   "Build MPT from RLP(tx) for each tx, root = keccak256(mpt.root()); mirrors Ethereum's derive_transactions_root."
  },
  {
    id: "ZRS-004", sev: "CRITICAL", cwe: "CWE-20", loc: "zbx-staking/src/staking_escrow.rs:43",
    title: "MIN_STAKE threshold allows sybil validator injection",
    desc:  "MIN_STAKE was previously set to 32 ZBX enabling arbitrary validator set flooding. Patched to 100 ZBX in chain spec but the constant was also present in the genesis validator activation path which was not updated — validator join via genesis.json still accepts 32 ZBX.",
    status: "PASS",
    fix:   "MIN_STAKE constant unified in zbx-config/src/chain.rs, genesis activation path now reads from config."
  },
  {
    id: "ZRS-005", sev: "CRITICAL", cwe: "CWE-284", loc: "zbx-evm/src/precompiles.rs:318",
    title: "bn128_pairing precompile returned true for any input",
    desc:  "The BN128 pairing check precompile (addr 0x08) returned Ok(true) unconditionally — all ZK proof verifications passed regardless of proof correctness. Any SNARK-gated function was trivially bypassable.",
    status: "PASS",
    fix:   "Replaced stub with blst::Bls12::pairing_check() call; correct pairing equation verified."
  },
  {
    id: "ZRS-006", sev: "CRITICAL", cwe: "CWE-755", loc: "zbx-zvm/src/interpreter.rs:502",
    title: "InvalidOpcode swallowed as NOP — ZVM contracts never revert",
    desc:  "The ZVM interpreter match arm for unknown opcodes silently emitted a NOP instead of returning Err(ZvmError::InvalidOpcode). Any broken contract deployed to the ZK-VM would silently succeed execution.",
    status: "PASS",
    fix:   "Unknown opcodes now return Err(ZvmError::InvalidOpcode(op)), propagated to executor as ExecutionReverted."
  },
  {
    id: "ZRS-007", sev: "CRITICAL", cwe: "CWE-284", loc: "zbx-consensus/src/safety_rules.rs:112",
    title: "advance_epoch() resets locked_qc — finality reversion",
    desc:  "On epoch boundary, advance_epoch() set locked_qc = None. An adversary controlling the next leader could propose a conflicting block for the last slot of the previous epoch after finality was already reached, reverting a committed block.",
    status: "PASS",
    fix:   "locked_qc is now preserved across epoch boundaries; only updated on new higher-view QC."
  },

  // ── HIGH ──
  {
    id: "ZRS-008", sev: "HIGH", cwe: "CWE-190", loc: "zbx-tx/src/validation.rs:203",
    title: "Gas price overflow: u64 * u64 multiplication unchecked",
    desc:  "fee_amount = gas_limit * gas_price uses u64::wrapping_mul in release builds. With gas_limit=u64::MAX and gas_price=2 the result overflows to a tiny fee, bypassing economic spam protection.",
    status: "PASS",
    fix:   "Replaced with gas_limit.checked_mul(gas_price).ok_or(TxError::GasOverflow)."
  },
  {
    id: "ZRS-009", sev: "HIGH", cwe: "CWE-400", loc: "zbx-mempool/src/pool.rs:89",
    title: "Unbounded mempool allows memory exhaustion",
    desc:  "The pending tx pool uses a BTreeMap with no capacity cap. An attacker can flood the node with minimum-fee transactions, consuming all heap memory. No per-sender limit or global size limit enforced.",
    status: "OPEN",
    fix:   "Add MAX_MEMPOOL_SIZE=50_000 and per_sender_limit=256; evict lowest-fee txs on overflow."
  },
  {
    id: "ZRS-010", sev: "HIGH", cwe: "CWE-367", loc: "zbx-state/src/state_db.rs:291",
    title: "TOCTOU in state root computation during parallel execution",
    desc:  "Block-STM reads state_root before applying the last MVCC write-set batch. Under high contention a thread can read the pre-merge root, compute a wrong state root, and seal the block with an incorrect state commitment.",
    status: "OPEN",
    fix:   "Acquire global write lock before computing state root after all thread write-sets are merged."
  },
  {
    id: "ZRS-011", sev: "HIGH", cwe: "CWE-416", loc: "zbx-network/src/peer_registry.rs:67",
    title: "Use-after-free in peer registry via Arc weak reference race",
    desc:  "PeerRegistry stores Weak<Peer> references. On disconnect the strong Arc is dropped, but the weak pointer is not immediately removed. A background task can upgrade the Weak to a valid Arc, send data to a disconnected socket, and trigger a double-close panic.",
    status: "PASS",
    fix:   "Remove peer entry synchronously in drop handler; background tasks check entry existence before upgrade."
  },
  {
    id: "ZRS-012", sev: "HIGH", cwe: "CWE-295", loc: "zbx-bridge/src/relayer.rs:145",
    title: "Bridge relayer accepts self-signed TLS certificates",
    desc:  "The relayer HTTP client uses reqwest::ClientBuilder without certificate pinning or CA validation (accept_invalid_certs=true left from dev flag). A MITM attacker on the bridge relay path can substitute fraudulent Merkle proofs.",
    status: "OPEN",
    fix:   "Remove accept_invalid_certs; pin expected CA via add_root_certificate or validate against known bridge multisig cert."
  },
  {
    id: "ZRS-013", sev: "HIGH", cwe: "CWE-755", loc: "zbx-genesis/src/genesis.rs:89",
    title: "No genesis hash mismatch check — silent fork possible",
    desc:  "Node startup does not compare stored genesis hash against the compiled-in genesis spec. A node can join and sync from a different genesis without any error — allowing a node to mine on a forked chain undetected.",
    status: "PASS",
    fix:   "compare genesis_hash on startup; abort with ChainIdMismatch error if not equal."
  },
  {
    id: "ZRS-014", sev: "HIGH", cwe: "CWE-352", loc: "zbx-rpc/src/server.rs:234",
    title: "JSON-RPC server missing CORS policy — cross-origin requests unrestricted",
    desc:  "The RPC HTTP server sets Access-Control-Allow-Origin: * without restricting methods or credentials. A malicious web page can call zbx_sendTransaction via fetch() from the browser using a local node's cookie session.",
    status: "OPEN",
    fix:   "Restrict CORS to configured origins; block eth_sendTransaction from browser origins without explicit allowlist."
  },
  {
    id: "ZRS-015", sev: "HIGH", cwe: "CWE-20", loc: "zbx-wasm/src/sandbox.rs:178",
    title: "WASM contract memory limit not enforced per-call",
    desc:  "The sandbox grants a 256MB memory ceiling at module instantiation but does not re-apply the limit per message/call context. Repeated reentrant calls within a WASM contract can grow memory cumulatively beyond the limit.",
    status: "OPEN",
    fix:   "Track memory_pages per call frame; return Err(MemoryExceeded) when cumulative delta exceeds per-call budget."
  },
  {
    id: "ZRS-016", sev: "HIGH", cwe: "CWE-770", loc: "zbx-da/src/blobs.rs:56",
    title: "KZG blob size not validated before proof generation",
    desc:  "submit_blob() accepts arbitrary-length input before checking byte length against MAX_BLOB_SIZE (4096×32 bytes). The prover panics with index-out-of-bounds on oversized input in release builds (no panic hook).",
    status: "OPEN",
    fix:   "Validate blob.len() <= MAX_BLOB_BYTES before calling kzg_commit(); return BlobTooLarge error."
  },
  {
    id: "ZRS-017", sev: "HIGH", cwe: "CWE-755", loc: "zbx-trie/src/node.rs:312",
    title: "MPT Branch/Extension RLP-decoder bug + non-canonical encoding",
    desc:  "The trie decoder used incorrect nibble-path ordering for extension nodes, producing non-canonical RLP that did not match Ethereum's encoding. Any cross-client state root verification failed.",
    status: "PASS",
    fix:   "Fixed nibble ordering to match Ethereum Yellow Paper §D; added 17 conformance tests."
  },
  {
    id: "ZRS-018", sev: "HIGH", cwe: "CWE-682", loc: "zbx-rewards/src/halving.rs:67",
    title: "Halving interval off-by-one causes extra block reward epoch",
    desc:  "halving_count = height / HALVING_INTERVAL uses integer division without subtracting genesis height. At exactly height=HALVING_INTERVAL the node pays pre-halving reward for one extra block, inflating supply by 3 ZBX per node.",
    status: "PASS",
    fix:   "halving_count = (height.saturating_sub(genesis_height)) / HALVING_INTERVAL."
  },
  {
    id: "ZRS-019", sev: "HIGH", cwe: "CWE-400", loc: "zbx-gossip/src/gossipsub.rs:201",
    title: "GossipSub fan-out mesh unbounded — eclipse attack surface",
    desc:  "The gossip mesh has no maximum peer count per topic. A Sybil attacker can fill the mesh with controlled peers, stopping honest validator vote propagation. Peer scoring exists but does not cap mesh size.",
    status: "OPEN",
    fix:   "Enforce mesh_n_high=12 and mesh_n_low=6; eject lowest-scored peers when mesh exceeds high watermark."
  },
  {
    id: "ZRS-020", sev: "HIGH", cwe: "CWE-338", loc: "zbx-mev/src/commit_reveal.rs:78",
    title: "Commit-reveal scheme uses block hash as randomness seed",
    desc:  "The MEV commit-reveal implementation seeds the reveal opening with the previous block hash. Block proposers can grind block hashes to influence MEV bundle ordering — defeating the purpose of the PBS scheme.",
    status: "OPEN",
    fix:   "Use VRF output (zbx-crypto/src/vrf.rs) as randomness source; block hash must not be the sole entropy input."
  },

  // ── MEDIUM ──
  {
    id: "ZRS-021", sev: "MEDIUM", cwe: "CWE-190", loc: "zbx-fee/src/eip1559.rs:44",
    title: "Base fee clamped at u128 but elasticity multiplier can overflow i128",
    desc:  "Gas elasticity = (gas_used - gas_target) * BASE_FEE_MAX_CHANGE_DENOMINATOR uses i128 multiplication. With extreme gas_used values the intermediate product overflows on i128, clamping base fee incorrectly.",
    status: "PASS",
    fix:   "Cast to i256 (via uint crate) before multiplication; clamp to u128::MAX after."
  },
  {
    id: "ZRS-022", sev: "MEDIUM", cwe: "CWE-200", loc: "zbx-keystore/src/keyfile.rs:134",
    title: "Keyfile password logged at DEBUG level on decryption error",
    desc:  "On keystore open failure the error path formats the raw password bytes into the debug log message for diagnosis. Any log aggregator (Grafana Loki, Datadog) will capture the plaintext password.",
    status: "PASS",
    fix:   "Replaced password bytes with password.len() in error context; raw password never enters any format string."
  },
  {
    id: "ZRS-023", sev: "MEDIUM", cwe: "CWE-703", loc: "zbx-sync/src/fast_sync.rs:267",
    title: "Fast-sync does not validate pivot block signature",
    desc:  "During fast-sync the pivot block header is accepted and written to disk before validating the BLS aggregate signature of the QC. A malicious peer can supply a fabricated pivot block header.",
    status: "OPEN",
    fix:   "Validate bls_aggregate(qc.signatures, qc.signers) against stored validator set before accepting pivot."
  },
  {
    id: "ZRS-024", sev: "MEDIUM", cwe: "CWE-362", loc: "zbx-pool/src/amm.rs:189",
    title: "AMM k-invariant check not atomic with swap execution",
    desc:  "The k=x*y invariant check runs before updating reserves but a re-entrant call path via ZRC20 transfer hook can modify reserves between the check and the update, allowing the invariant to be violated.",
    status: "OPEN",
    fix:   "Set is_locked=true flag before the check; revert if is_locked is set on re-entry (CEI pattern)."
  },
  {
    id: "ZRS-025", sev: "MEDIUM", cwe: "CWE-476", loc: "zbx-execution/src/parallel.rs:312",
    title: "Unwrap() on empty block during parallel executor setup",
    desc:  "block.transactions.first().unwrap() is called to seed the thread-local MVCCMap. An empty block (valid in consensus) panics the executor thread, crashing the node.",
    status: "PASS",
    fix:   "Guard with if block.transactions.is_empty() { return Ok(ExecutionResult::empty()); }."
  },
  {
    id: "ZRS-026", sev: "MEDIUM", cwe: "CWE-295", loc: "zbx-xcl/src/relay.rs:89",
    title: "XCL relay does not verify IBC client state before processing packet",
    desc:  "Incoming IBC packets are processed without checking that the corresponding light client is not expired or frozen. Expired clients can relay forged state proofs.",
    status: "OPEN",
    fix:   "Check client.status == Active before processing; reject with ClientExpired error otherwise."
  },
  {
    id: "ZRS-027", sev: "MEDIUM", cwe: "CWE-770", loc: "zbx-rpc/src/server.rs:87",
    title: "No per-IP rate limit on JSON-RPC — DoS possible",
    desc:  "RPC server processes requests from all IPs with no rate limiting. A single client can saturate the server with eth_getLogs queries with broad block ranges, blocking legitimate node operators.",
    status: "OPEN",
    fix:   "Apply 100 req/s per-IP leaky bucket; eth_getLogs block range capped at 10_000 blocks."
  },
  {
    id: "ZRS-028", sev: "MEDIUM", cwe: "CWE-693", loc: "zbx-confidential/src/range_proof.rs:45",
    title: "Bulletproof range proof missing final transcript challenge",
    desc:  "The Bulletproof verifier omits the final Fiat-Shamir transcript commitment, allowing a prover to reuse the same inner product argument with a different range claim.",
    status: "OPEN",
    fix:   "Add transcript.append_message(b\"final\", &inner_product_proof.bytes()) before extracting challenge scalar."
  },
  {
    id: "ZRS-029", sev: "MEDIUM", cwe: "CWE-682", loc: "zbx-staking/src/slashing.rs:156",
    title: "Inactivity leak burns exactly 5% but does not account for partial epoch",
    desc:  "Inactivity penalty = stake * 0.05 applied per epoch. For validators that join mid-epoch, a full 5% burn is applied on the partial epoch — disproportionately punishing late joins.",
    status: "OPEN",
    fix:   "Pro-rate penalty: stake * 0.05 * (active_slots / epoch_slots)."
  },
  {
    id: "ZRS-030", sev: "MEDIUM", cwe: "CWE-400", loc: "zbx-indexer/src/schema.rs:234",
    title: "Indexer schema migration has no lock — concurrent restarts corrupt index",
    desc:  "The indexer runs ALTER TABLE without acquiring an advisory lock. Two nodes restarting simultaneously apply the same migration twice, causing duplicate column errors and index corruption.",
    status: "OPEN",
    fix:   "Use SELECT pg_advisory_lock(42) at migration start; release after completion."
  },

  // ── LOW ──
  {
    id: "ZRS-031", sev: "LOW", cwe: "CWE-209", loc: "zbx-jsonrpc/src/router.rs:67",
    title: "Internal error codes leak server stack traces to RPC clients",
    desc:  "Method not found and parse errors propagate the full anyhow error chain (including file:line) to the JSON-RPC error.data field visible to any client.",
    status: "OPEN",
    fix:   "Strip internal error details; log internally, return generic code=-32603 with safe message."
  },
  {
    id: "ZRS-032", sev: "LOW", cwe: "CWE-330", loc: "zbx-wallet/src/hd_wallet.rs:56",
    title: "HD wallet entropy source falls back to OsRng without check",
    desc:  "On platforms where getrandom() fails, the code silently falls back to a weaker PRNG seeded from SystemTime — no error is returned to the caller.",
    status: "OPEN",
    fix:   "Return Err(KeygenError::EntropyUnavailable) if OsRng::try_fill_bytes fails; never fall back silently."
  },
  {
    id: "ZRS-033", sev: "LOW", cwe: "CWE-404", loc: "zbx-storage/src/rocksdb.rs:312",
    title: "RocksDB column family handles not closed on panic unwind",
    desc:  "CF handles stored in a Vec<ColumnFamily> are not wrapped in a Drop-safe guard. On panic during block write, WAL files remain open, potentially corrupting the next startup.",
    status: "OPEN",
    fix:   "Wrap CF handles in a RAII guard; implement Drop to flush and close handles."
  },
  {
    id: "ZRS-034", sev: "LOW", cwe: "CWE-134", loc: "zbx-trace/src/call_trace.rs:89",
    title: "Format string in call tracer accepts user-supplied opcode name",
    desc:  "The debug tracer formats opcode names from the decoded instruction stream into a user-visible string without sanitisation. Long opcode names can cause log line truncation in structured loggers.",
    status: "PASS",
    fix:   "Truncate opcode name to 32 bytes; validate against known opcode table."
  },
  {
    id: "ZRS-035", sev: "LOW", cwe: "CWE-703", loc: "zbx-oracle/src/aggregator.rs:178",
    title: "Price aggregator panics when fewer than 3 feed responses received",
    desc:  "VWAP aggregation uses feeds[2].price.clone() without checking length. With fewer than 3 active oracles (e.g. during startup) the node panics.",
    status: "PASS",
    fix:   "require feeds.len() >= MIN_ORACLES (=3); return Err(InsufficientOracles) if not met."
  },
  {
    id: "ZRS-036", sev: "LOW", cwe: "CWE-613", loc: "zbx-admin/src/auth.rs:78",
    title: "Admin JWT tokens do not expire — no session revocation",
    desc:  "Admin JWTs are signed without an exp claim. A stolen admin token is valid indefinitely with no way to revoke it short of rotating the signing key.",
    status: "OPEN",
    fix:   "Add exp = now + 3600 to JWT claims; implement /admin/logout endpoint that rotates the signing key."
  },
  {
    id: "ZRS-037", sev: "LOW", cwe: "CWE-20", loc: "zbx-pq/src/dilithium.rs:45",
    title: "Dilithium key import does not validate key length before copy",
    desc:  "import_secret_key() copies bytes into a fixed [u8; 2528] buffer without checking input length. Short inputs leave buffer tail uninitialized (filled with zeroed bytes) producing weak keys silently.",
    status: "OPEN",
    fix:   "Return Err(KeyError::InvalidLength) if input.len() != DILITHIUM_SK_BYTES."
  },
  {
    id: "ZRS-038", sev: "LOW", cwe: "CWE-400", loc: "zbx-gossip/src/gossipsub.rs:412",
    title: "Duplicate message cache grows without bound",
    desc:  "The seen_messages BTreeSet that prevents gossip message re-broadcast has no expiry or size cap. Over days of operation it grows to tens of millions of entries consuming gigabytes of memory.",
    status: "OPEN",
    fix:   "Use a time-windowed LRU cache with 60-second TTL and max 100_000 entries."
  },

  // ── INFO ──
  {
    id: "ZRS-039", sev: "INFO", loc: "zbx-codec/src/borsh.rs",
    title: "Borsh encoding not round-trip tested against reference implementation",
    desc:  "Borsh codec has unit tests but no cross-language conformance tests against the Rust borsh crate reference vectors.",
    status: "OPEN",
    fix:   "Add conformance test vectors from borsh-spec; integrate as part of CI."
  },
  {
    id: "ZRS-040", sev: "INFO", loc: "zbx-cli/src/safety.rs",
    title: "CLI --force flag bypasses all safety checks globally",
    desc:  "The --force flag disables all safety prompts including for mainnet send operations. A scripted attacker with CLI access can drain funds without confirmation.",
    status: "OPEN",
    fix:   "Restrict --force to testnet only; require explicit --unsafe-mainnet flag for mainnet force-mode."
  },
  {
    id: "ZRS-041", sev: "INFO", loc: "zbx-telemetry/src/otlp.rs",
    title: "OTLP endpoint configured without authentication",
    desc:  "The telemetry OTLP exporter sends trace data to the configured endpoint without any authentication header. Traces may be intercepted or spoofed.",
    status: "OPEN",
    fix:   "Add OTEL_EXPORTER_OTLP_HEADERS support for bearer token or mTLS client cert."
  },
  {
    id: "ZRS-042", sev: "INFO", loc: "zbx-config/src/chain.rs",
    title: "Chain params not validated on node startup",
    desc:  "Node reads chain config from TOML but does not validate that CHAIN_ID, GENESIS_HASH, MIN_STAKE etc. are self-consistent. Misconfigured nodes join the network silently.",
    status: "OPEN",
    fix:   "Add ChainConfig::validate() called during node initialization."
  },
];

// ─── Per-crate audit table ─────────────────────────────────────────────────────

const CRATE_AUDITS: CrateAudit[] = [
  { name:"zbx-consensus",   category:"Consensus",   linesEst:4800, unsafeBlocks:3,  unwraps:12, status:"FAIL",            critical:2,high:1,medium:2,low:1,info:0, notes:"Double-vote race (ZRS-001) + locked_qc reset (ZRS-007)" },
  { name:"zbx-evm",         category:"VM",          linesEst:6200, unsafeBlocks:8,  unwraps:23, status:"FAIL",            critical:2,high:0,medium:0,low:0,info:0, notes:"CALL gas stipend (ZRS-002) + tx_root hash (ZRS-003)" },
  { name:"zbx-block",       category:"Core",        linesEst:2100, unsafeBlocks:0,  unwraps:6,  status:"FAIL",            critical:1,high:0,medium:0,low:0,info:0, notes:"tx_root MPT (ZRS-003)" },
  { name:"zbx-staking",     category:"DeFi/PoS",    linesEst:3400, unsafeBlocks:1,  unwraps:9,  status:"PASS_WITH_NOTES", critical:1,high:0,medium:1,low:0,info:0, notes:"MIN_STAKE fixed; inactivity pro-rate open" },
  { name:"zbx-mempool",     category:"Core",        linesEst:1800, unsafeBlocks:0,  unwraps:4,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"Unbounded pool (ZRS-009)" },
  { name:"zbx-state",       category:"State",       linesEst:3100, unsafeBlocks:5,  unwraps:11, status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"TOCTOU in state root (ZRS-010)" },
  { name:"zbx-network",     category:"Network",     linesEst:2400, unsafeBlocks:2,  unwraps:7,  status:"PASS_WITH_NOTES", critical:0,high:1,medium:0,low:0,info:0, notes:"Weak Arc race fixed (ZRS-011)" },
  { name:"zbx-bridge",      category:"Bridge",      linesEst:2900, unsafeBlocks:1,  unwraps:8,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"TLS cert bypass (ZRS-012)" },
  { name:"zbx-gossip",      category:"Network",     linesEst:1900, unsafeBlocks:0,  unwraps:3,  status:"FAIL",            critical:0,high:1,medium:0,low:2,info:0, notes:"Mesh eclipse (ZRS-019) + dup cache (ZRS-038)" },
  { name:"zbx-mev",         category:"Core",        linesEst:1600, unsafeBlocks:0,  unwraps:5,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"Block hash as RNG seed (ZRS-020)" },
  { name:"zbx-da",          category:"Core",        linesEst:1400, unsafeBlocks:0,  unwraps:3,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"Blob size not validated (ZRS-016)" },
  { name:"zbx-rpc",         category:"API",         linesEst:3600, unsafeBlocks:0,  unwraps:14, status:"FAIL",            critical:0,high:1,medium:1,low:0,info:0, notes:"CORS bypass + RPC DoS open" },
  { name:"zbx-wasm",        category:"VM",          linesEst:2200, unsafeBlocks:7,  unwraps:9,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"Per-call memory limit (ZRS-015)" },
  { name:"zbx-da",          category:"Core",        linesEst:1400, unsafeBlocks:0,  unwraps:3,  status:"FAIL",            critical:0,high:1,medium:0,low:0,info:0, notes:"KZG blob size (ZRS-016)" },
  { name:"zbx-trie",        category:"State",       linesEst:2700, unsafeBlocks:2,  unwraps:8,  status:"PASS",            critical:0,high:1,medium:0,low:0,info:0, notes:"MPT RLP fixed (ZRS-017)" },
  { name:"zbx-rewards",     category:"Core",        linesEst:900,  unsafeBlocks:0,  unwraps:2,  status:"PASS",            critical:0,high:1,medium:0,low:0,info:0, notes:"Halving off-by-one fixed (ZRS-018)" },
  { name:"zbx-tx",          category:"Core",        linesEst:2100, unsafeBlocks:0,  unwraps:7,  status:"PASS",            critical:0,high:1,medium:0,low:0,info:0, notes:"Gas overflow fixed (ZRS-008)" },
  { name:"zbx-fee",         category:"Core",        linesEst:800,  unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:1,low:0,info:0, notes:"EIP-1559 overflow fixed" },
  { name:"zbx-execution",   category:"VM",          linesEst:2600, unsafeBlocks:4,  unwraps:18, status:"PASS",            critical:0,high:0,medium:1,low:0,info:0, notes:"Empty block unwrap fixed (ZRS-025)" },
  { name:"zbx-zvm",         category:"VM",          linesEst:3100, unsafeBlocks:2,  unwraps:11, status:"PASS",            critical:1,high:0,medium:0,low:0,info:0, notes:"InvalidOpcode fixed (ZRS-006)" },
  { name:"zbx-sync",        category:"Network",     linesEst:2200, unsafeBlocks:0,  unwraps:6,  status:"FAIL",            critical:0,high:0,medium:1,low:0,info:0, notes:"Pivot block sig skip (ZRS-023)" },
  { name:"zbx-pool",        category:"DeFi",        linesEst:1800, unsafeBlocks:0,  unwraps:5,  status:"FAIL",            critical:0,high:0,medium:1,low:0,info:0, notes:"AMM k-invariant race (ZRS-024)" },
  { name:"zbx-xcl",         category:"Bridge",      linesEst:2100, unsafeBlocks:0,  unwraps:4,  status:"FAIL",            critical:0,high:0,medium:1,low:0,info:0, notes:"IBC client expiry check (ZRS-026)" },
  { name:"zbx-confidential",category:"Crypto",      linesEst:1700, unsafeBlocks:1,  unwraps:3,  status:"FAIL",            critical:0,high:0,medium:1,low:0,info:0, notes:"Bulletproof transcript (ZRS-028)" },
  { name:"zbx-indexer",     category:"Tools",       linesEst:2800, unsafeBlocks:0,  unwraps:9,  status:"FAIL",            critical:0,high:0,medium:1,low:0,info:0, notes:"Migration advisory lock (ZRS-030)" },
  { name:"zbx-keystore",    category:"Crypto",      linesEst:1200, unsafeBlocks:1,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:1,low:0,info:0, notes:"Password in log fixed (ZRS-022)" },
  { name:"zbx-genesis",     category:"Core",        linesEst:1100, unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:1,medium:0,low:0,info:0, notes:"Genesis hash check added (ZRS-013)" },
  { name:"zbx-oracle",      category:"Oracle",      linesEst:1900, unsafeBlocks:0,  unwraps:7,  status:"PASS",            critical:0,high:0,medium:0,low:1,info:0, notes:"Feed count panic fixed (ZRS-035)" },
  { name:"zbx-admin",       category:"Tools",       linesEst:1800, unsafeBlocks:0,  unwraps:6,  status:"FAIL",            critical:0,high:0,medium:0,low:1,info:0, notes:"JWT expiry open (ZRS-036)" },
  { name:"zbx-wallet",      category:"Crypto",      linesEst:1400, unsafeBlocks:0,  unwraps:5,  status:"FAIL",            critical:0,high:0,medium:0,low:1,info:0, notes:"OsRng fallback (ZRS-032)" },
  { name:"zbx-storage",     category:"State",       linesEst:2100, unsafeBlocks:3,  unwraps:7,  status:"FAIL",            critical:0,high:0,medium:0,low:1,info:0, notes:"RocksDB CF handle leak (ZRS-033)" },
  { name:"zbx-pq",          category:"Crypto",      linesEst:1100, unsafeBlocks:2,  unwraps:3,  status:"FAIL",            critical:0,high:0,medium:0,low:1,info:0, notes:"Dilithium key length (ZRS-037)" },
  { name:"zbx-zk",          category:"ZK",          linesEst:2400, unsafeBlocks:4,  unwraps:8,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:1, notes:"PLONK/STARK verifier reviewed" },
  { name:"zbx-prover",      category:"ZK",          linesEst:3200, unsafeBlocks:6,  unwraps:14, status:"PASS",            critical:0,high:0,medium:0,low:0,info:1, notes:"Groth16/Plonky2 reviewed" },
  { name:"zbx-crypto",      category:"Crypto",      linesEst:2800, unsafeBlocks:7,  unwraps:6,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"BLS/KZG/VRF reviewed" },
  { name:"zbx-types",       category:"Core",        linesEst:1200, unsafeBlocks:1,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-primitives",  category:"Core",        linesEst:900,  unsafeBlocks:2,  unwraps:1,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-codec",       category:"Core",        linesEst:1100, unsafeBlocks:0,  unwraps:2,  status:"PASS_WITH_NOTES", critical:0,high:0,medium:0,low:0,info:1, notes:"Borsh conformance missing (ZRS-039)" },
  { name:"zbx-rlp",         category:"Core",        linesEst:800,  unsafeBlocks:0,  unwraps:1,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-abi",         category:"Core",        linesEst:900,  unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-finality",    category:"Consensus",   linesEst:1100, unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-sequencer",   category:"Consensus",   linesEst:1600, unsafeBlocks:0,  unwraps:5,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-net",         category:"Network",     linesEst:1400, unsafeBlocks:1,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"discv5 reviewed" },
  { name:"zbx-ai-precompile",category:"AI",         linesEst:1800, unsafeBlocks:2,  unwraps:6,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Gas table reviewed" },
  { name:"zbx-ai-sdk",      category:"AI",          linesEst:1200, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-ai-registry", category:"AI",          linesEst:900,  unsafeBlocks:0,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-threshold",   category:"Crypto",      linesEst:1600, unsafeBlocks:3,  unwraps:5,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"FROST DKG reviewed" },
  { name:"zbx-oracle-twap", category:"Oracle",      linesEst:800,  unsafeBlocks:0,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-oracle-optimistic",category:"Oracle", linesEst:1100, unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-oracle-zk",   category:"Oracle",      linesEst:900,  unsafeBlocks:1,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-lending",     category:"DeFi",        linesEst:2200, unsafeBlocks:0,  unwraps:7,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Collateral math reviewed" },
  { name:"zbx-perp",        category:"DeFi",        linesEst:2800, unsafeBlocks:0,  unwraps:9,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Funding rate reviewed" },
  { name:"zbx-yield",       category:"DeFi",        linesEst:1600, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-nft",         category:"DeFi",        linesEst:1100, unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-launchpad",   category:"DeFi",        linesEst:1300, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-gaming",      category:"App",         linesEst:1200, unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"VRF escrow reviewed" },
  { name:"zbx-payment",     category:"App",         linesEst:900,  unsafeBlocks:0,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-metrics",     category:"Tools",       linesEst:600,  unsafeBlocks:0,  unwraps:1,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-telemetry",   category:"Tools",       linesEst:700,  unsafeBlocks:0,  unwraps:2,  status:"PASS_WITH_NOTES", critical:0,high:0,medium:0,low:0,info:1, notes:"OTLP auth missing (ZRS-041)" },
  { name:"zbx-trace",       category:"Tools",       linesEst:900,  unsafeBlocks:0,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:1,info:0, notes:"Format string fixed (ZRS-034)" },
  { name:"zbx-bundler",     category:"Core",        linesEst:2100, unsafeBlocks:0,  unwraps:7,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"ERC-4337 flow reviewed" },
  { name:"zbx-explorer",    category:"Tools",       linesEst:1800, unsafeBlocks:0,  unwraps:5,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-config",      category:"Core",        linesEst:700,  unsafeBlocks:0,  unwraps:2,  status:"PASS_WITH_NOTES", critical:0,high:0,medium:0,low:0,info:1, notes:"Startup validation missing (ZRS-042)" },
  { name:"zbx-sdk",         category:"Tools",       linesEst:1600, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-cli",         category:"Tools",       linesEst:1800, unsafeBlocks:0,  unwraps:6,  status:"PASS_WITH_NOTES", critical:0,high:0,medium:0,low:0,info:1, notes:"--force flag (ZRS-040)" },
  { name:"zbx-light",       category:"Network",     linesEst:1400, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"SPV verified" },
  { name:"zbx-state-rent",  category:"State",       linesEst:800,  unsafeBlocks:0,  unwraps:2,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-pruner",      category:"State",       linesEst:900,  unsafeBlocks:1,  unwraps:3,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-snapshot",    category:"State",       linesEst:1100, unsafeBlocks:0,  unwraps:4,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-jsonrpc",     category:"API",         linesEst:1200, unsafeBlocks:0,  unwraps:3,  status:"FAIL",            critical:0,high:0,medium:0,low:1,info:0, notes:"Stack trace leak (ZRS-031)" },
  { name:"zbx-verkle",      category:"State",       linesEst:2200, unsafeBlocks:3,  unwraps:6,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Verkle proof reviewed" },
  { name:"zbx-payid",       category:"App",         linesEst:600,  unsafeBlocks:0,  unwraps:1,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"Clean" },
  { name:"zbx-contracts",   category:"Core",        linesEst:3200, unsafeBlocks:0,  unwraps:8,  status:"PASS",            critical:0,high:0,medium:0,low:0,info:0, notes:"System contracts reviewed" },
];

// ─── Derived stats ─────────────────────────────────────────────────────────────

const TOTAL_C = FINDINGS.filter(f => f.sev === "CRITICAL").length;
const TOTAL_H = FINDINGS.filter(f => f.sev === "HIGH").length;
const TOTAL_M = FINDINGS.filter(f => f.sev === "MEDIUM").length;
const TOTAL_L = FINDINGS.filter(f => f.sev === "LOW").length;
const TOTAL_I = FINDINGS.filter(f => f.sev === "INFO").length;
const OPEN_C  = FINDINGS.filter(f => f.sev === "CRITICAL" && f.status === "OPEN").length;
const OPEN_H  = FINDINGS.filter(f => f.sev === "HIGH"     && f.status === "OPEN").length;
const PASS_CRATES = CRATE_AUDITS.filter(c => c.status === "PASS" || c.status === "PASS_WITH_NOTES").length;
const TOTAL_UNSAFE = CRATE_AUDITS.reduce((s,c) => s+c.unsafeBlocks, 0);
const TOTAL_UNWRAP = CRATE_AUDITS.reduce((s,c) => s+c.unwraps,      0);
const TOTAL_LINES  = CRATE_AUDITS.reduce((s,c) => s+c.linesEst,     0);

// Security score out of 100
const SCORE = Math.max(0, 100 - OPEN_C*18 - OPEN_H*7 - FINDINGS.filter(f=>f.sev==="MEDIUM"&&f.status==="OPEN").length*2);

// ─── Components ────────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: Sev }) {
  return (
    <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 uppercase", SEV_COLOR[sev])}>
      {sev}
    </span>
  );
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const Icon = AUDIT_ICON[status];
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-mono", AUDIT_COLOR[status])}>
      <Icon className="h-3 w-3" />
      {status.replace("_", " ")}
    </span>
  );
}

function Section({ icon: Icon, title, color, defaultOpen = true, children }: {
  icon: React.ElementType; title: string; color: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-card/60 hover:bg-card/80 transition-colors text-left">
        <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
        <span className="font-semibold text-base flex-1">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-2">{children}</div>}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 44, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SevFilter   = "ALL" | Sev;
type CatFilter   = string;

export default function Audit() {
  const [findingFilter, setFindingFilter] = useState<SevFilter>("ALL");
  const [statusFilter,  setStatusFilter]  = useState<"ALL"|"OPEN"|"PASS">("ALL");
  const [crateFilter,   setCrateFilter]   = useState<CatFilter>("ALL");
  const [crateSearch,   setCrateSearch]   = useState("");
  const [findingSearch, setFindingSearch] = useState("");

  const cats = useMemo(() =>
    ["ALL", ...Array.from(new Set(CRATE_AUDITS.map(c => c.category))).sort()], []);

  const filteredFindings = useMemo(() => FINDINGS.filter(f => {
    const matchSev    = findingFilter === "ALL" || f.sev === findingFilter;
    const matchStatus = statusFilter  === "ALL" || (statusFilter === "OPEN" ? f.status === "OPEN" : f.status !== "OPEN");
    const matchSearch = !findingSearch || f.title.toLowerCase().includes(findingSearch.toLowerCase()) ||
                        f.loc.toLowerCase().includes(findingSearch.toLowerCase()) || f.id.toLowerCase().includes(findingSearch.toLowerCase());
    return matchSev && matchStatus && matchSearch;
  }), [findingFilter, statusFilter, findingSearch]);

  const filteredCrates = useMemo(() => {
    const deduped = CRATE_AUDITS.filter((c, i, a) => a.findIndex(x => x.name === c.name) === i);
    return deduped.filter(c => {
      const matchCat    = crateFilter === "ALL" || c.category === crateFilter;
      const matchSearch = !crateSearch || c.name.toLowerCase().includes(crateSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [crateFilter, crateSearch]);

  const openBlockers = FINDINGS.filter(f => (f.sev === "CRITICAL" || f.sev === "HIGH") && f.status === "OPEN");

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Full Rust Security Audit</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            74 crates &bull; {TOTAL_LINES.toLocaleString()} estimated LOC &bull; {FINDINGS.length} findings &bull; {TOTAL_UNSAFE} unsafe blocks &bull; {TOTAL_UNWRAP} unwrap() calls &bull; Rust 2021 edition &bull; 8+ internal passes (Apr–May 2026)
          </p>
        </div>
        <a href="https://github.com/servicefree310-ctrl/Chain-Dashboard/blob/main/zbx-chain-source/zbx-chain/AUDIT_2026-04-30.md"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-border hover:bg-muted/40 flex-shrink-0">
          <BookOpen className="h-3.5 w-3.5" /> Full Audit Log <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* ── Security Score + Top Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Score ring */}
        <div className="lg:col-span-1 bg-card border border-border/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Security Score</p>
          <div className="relative">
            <ScoreRing score={SCORE} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-black font-mono", SCORE >= 75 ? "text-green-400" : SCORE >= 50 ? "text-yellow-400" : "text-red-400")}>{SCORE}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          </div>
          <p className={cn("text-xs font-semibold", SCORE >= 75 ? "text-green-400" : SCORE >= 50 ? "text-yellow-400" : "text-red-400")}>
            {SCORE >= 75 ? "GOOD" : SCORE >= 50 ? "NEEDS WORK" : "NOT READY"}
          </p>
          <p className="text-[10px] text-muted-foreground text-center">External audit Q3 2026</p>
        </div>

        {/* Finding counts */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { label:"Critical", val: TOTAL_C, open: OPEN_C,  color:"text-red-400",    bg:"bg-red-500/10",    border:"border-red-500/20" },
            { label:"High",     val: TOTAL_H, open: OPEN_H,  color:"text-orange-400", bg:"bg-orange-500/10", border:"border-orange-500/20" },
            { label:"Medium",   val: TOTAL_M, open: FINDINGS.filter(f=>f.sev==="MEDIUM"&&f.status==="OPEN").length, color:"text-yellow-400", bg:"bg-yellow-500/10", border:"border-yellow-500/20" },
            { label:"Low",      val: TOTAL_L, open: FINDINGS.filter(f=>f.sev==="LOW"&&f.status==="OPEN").length,    color:"text-blue-400",   bg:"bg-blue-500/10",   border:"border-blue-500/20" },
          ].map(s => (
            <div key={s.label} className={cn("rounded-xl border p-4 flex flex-col gap-1", s.bg, s.border)}>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", s.color)}>{s.label}</span>
              <span className={cn("text-3xl font-black font-mono", s.color)}>{s.val}</span>
              <span className="text-[10px] text-muted-foreground">{s.open} open · {s.val - s.open} fixed</span>
            </div>
          ))}
        </div>

        {/* Crate health + rust stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { label:"Crates Audited", val: CRATE_AUDITS.filter((c,i,a)=>a.findIndex(x=>x.name===c.name)===i).length.toString(), sub:"of 74 crates",   icon:Code2,     color:"text-primary" },
            { label:"Crates Passing",  val: PASS_CRATES.toString(), sub:"pass or notes",    icon:ShieldCheck, color:"text-green-400" },
            { label:"unsafe blocks",   val: TOTAL_UNSAFE.toString(), sub:"across all crates", icon:AlertTriangle, color:"text-orange-400" },
            { label:"unwrap() calls",  val: TOTAL_UNWRAP.toString(), sub:"potential panics",  icon:Bug,         color:"text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <s.icon className={cn("h-4 w-4", s.color)} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <span className={cn("text-2xl font-black font-mono", s.color)}>{s.val}</span>
              <span className="text-[10px] text-muted-foreground">{s.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mainnet Blockers ── */}
      {openBlockers.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-red-500/20 bg-red-500/8">
            <ShieldX className="h-5 w-5 text-red-400" />
            <span className="font-bold text-red-300">Mainnet Blockers — {openBlockers.length} Open Critical/High Issues</span>
            <span className="ml-auto text-[11px] font-mono text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">NOT MAINNET READY</span>
          </div>
          <div className="divide-y divide-red-500/10">
            {openBlockers.map(f => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <SevBadge sev={f.sev} />
                    <span className="text-xs font-mono text-muted-foreground">{f.id}</span>
                    <span className="text-xs font-semibold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{f.loc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-Crate Table ── */}
      <Section icon={Code2} title={`Per-Crate Audit Results (${filteredCrates.length} shown)`} color="text-orange-400">
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-muted/20 border border-border/40 rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input value={crateSearch} onChange={e => setCrateSearch(e.target.value)}
              placeholder="Search crate…" className="bg-transparent text-xs outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {cats.map(c => (
              <button key={c} onClick={() => setCrateFilter(c)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  crateFilter === c ? "bg-primary/20 text-primary border-primary/40" : "bg-muted/30 text-muted-foreground border-border hover:text-foreground")}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Crate</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Est. LOC</th>
                <th className="text-right px-3 py-2 font-semibold text-red-400">C</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-400">H</th>
                <th className="text-right px-3 py-2 font-semibold text-yellow-400">M</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-400">L</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">unsafe</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">unwrap</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredCrates.map(c => {
                const hasCrit = c.critical > 0 || c.high > 0;
                return (
                  <tr key={c.name} className={cn("transition-colors hover:bg-muted/20", hasCrit && "bg-red-500/3")}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-foreground font-medium">{c.name}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.category}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{c.linesEst.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      {c.critical > 0 ? <span className="font-mono font-bold text-red-400">{c.critical}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.high > 0 ? <span className="font-mono font-bold text-orange-400">{c.high}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.medium > 0 ? <span className="font-mono font-bold text-yellow-400">{c.medium}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.low > 0 ? <span className="font-mono font-bold text-blue-400">{c.low}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-mono", c.unsafeBlocks > 5 ? "text-orange-400" : "text-muted-foreground")}>{c.unsafeBlocks}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", c.unwraps > 10 ? "text-yellow-400" : "text-muted-foreground")}>{c.unwraps}</td>
                    <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{c.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Full Findings ── */}
      <Section icon={Bug} title={`Security Findings (${filteredFindings.length} shown)`} color="text-red-400">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-muted/20 border border-border/40 rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input value={findingSearch} onChange={e => setFindingSearch(e.target.value)}
              placeholder="Search findings…" className="bg-transparent text-xs outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["ALL","CRITICAL","HIGH","MEDIUM","LOW","INFO"] as const).map(f => (
              <button key={f} onClick={() => setFindingFilter(f)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  findingFilter === f
                    ? f === "ALL" ? "bg-primary/20 text-primary border-primary/40"
                      : cn(SEV_COLOR[f as Sev], "border-opacity-60")
                    : "bg-muted/30 text-muted-foreground border-border hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["ALL","OPEN","PASS"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  statusFilter === s ? "bg-primary/20 text-primary border-primary/40" : "bg-muted/30 text-muted-foreground border-border hover:text-foreground")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredFindings.map(f => (
            <FindingCard key={f.id} finding={f} />
          ))}
          {filteredFindings.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">No findings match the current filters</div>
          )}
        </div>
      </Section>

      {/* ── Rust-Specific Pattern Analysis ── */}
      <Section icon={AlertCircle} title="Rust-Specific Risk Patterns" color="text-yellow-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {[
            { label:"unsafe blocks",      val: TOTAL_UNSAFE, limit: 60, desc:"Direct memory manipulation — each reviewed for soundness", color:"text-orange-400", bg:"bg-orange-500/8", border:"border-orange-500/20" },
            { label:"unwrap() calls",     val: TOTAL_UNWRAP, limit: 150, desc:"Potential panics in production — require ? or expect(msg)", color:"text-yellow-400", bg:"bg-yellow-500/8", border:"border-yellow-500/20" },
            { label:"Arc Weak races",     val: 3,  limit: 5,  desc:"Weak reference upgrade races found — 2 fixed, 1 open",     color:"text-red-400",    bg:"bg-red-500/8",    border:"border-red-500/20" },
            { label:"Mutex deadlock risk",val: 5,  limit: 10, desc:"Nested lock acquisitions — reviewed for correct ordering",  color:"text-orange-400", bg:"bg-orange-500/8", border:"border-orange-500/20" },
            { label:"integer overflow sites",val:8,limit: 15, desc:"Arithmetic without checked_* — 6 fixed, 2 open",          color:"text-yellow-400", bg:"bg-yellow-500/8", border:"border-yellow-500/20" },
            { label:"unvalidated inputs", val: 7,  limit: 10, desc:"External data accepted without bounds check",              color:"text-blue-400",   bg:"bg-blue-500/8",   border:"border-blue-500/20" },
            { label:"panic! macros",      val: 12, limit: 20, desc:"Direct panics in library code — should return Result",     color:"text-yellow-400", bg:"bg-yellow-500/8", border:"border-yellow-500/20" },
            { label:"clone-heavy paths",  val: 23, limit: 50, desc:"Unnecessary clones in hot paths — perf issue, not security",color:"text-muted-foreground", bg:"bg-muted/10", border:"border-border/30" },
            { label:"unsafe transmute",   val: 2,  limit: 5,  desc:"Type punning via transmute — both reviewed, soundness OK", color:"text-orange-400", bg:"bg-orange-500/8", border:"border-orange-500/20" },
          ].map(p => {
            const pct = Math.min(100, (p.val / p.limit) * 100);
            return (
              <div key={p.label} className={cn("rounded-lg border p-3.5 space-y-2", p.bg, p.border)}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">{p.label}</span>
                  <span className={cn("text-sm font-bold font-mono", p.color)}>{p.val}</span>
                </div>
                <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", p.val >= p.limit * 0.8 ? "bg-red-500" : p.val >= p.limit * 0.5 ? "bg-yellow-500" : "bg-green-500")}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── CWE Category Breakdown ── */}
      <Section icon={Layers} title="CWE Category Breakdown" color="text-violet-400" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {[
            { cwe:"CWE-190", name:"Integer Overflow",          count:4, sev:"HIGH",   findings:["ZRS-008","ZRS-021","ZRS-018","ZRS-001"] },
            { cwe:"CWE-362", name:"Race Condition (TOCTOU)",   count:3, sev:"CRITICAL",findings:["ZRS-001","ZRS-010","ZRS-024"] },
            { cwe:"CWE-682", name:"Incorrect Calculation",     count:3, sev:"HIGH",   findings:["ZRS-002","ZRS-018","ZRS-029"] },
            { cwe:"CWE-400", name:"Resource Exhaustion",       count:4, sev:"HIGH",   findings:["ZRS-009","ZRS-015","ZRS-027","ZRS-038"] },
            { cwe:"CWE-284", name:"Improper Access Control",   count:2, sev:"CRITICAL",findings:["ZRS-005","ZRS-006"] },
            { cwe:"CWE-347", name:"Improper Verification",     count:2, sev:"CRITICAL",findings:["ZRS-003","ZRS-023"] },
            { cwe:"CWE-295", name:"Improper Cert Validation",  count:2, sev:"HIGH",   findings:["ZRS-012","ZRS-026"] },
            { cwe:"CWE-755", name:"Improper Exception Handling",count:3,sev:"HIGH",   findings:["ZRS-006","ZRS-013","ZRS-025"] },
            { cwe:"CWE-338", name:"Weak PRNG",                 count:1, sev:"HIGH",   findings:["ZRS-020"] },
            { cwe:"CWE-416", name:"Use-After-Free",            count:1, sev:"HIGH",   findings:["ZRS-011"] },
            { cwe:"CWE-200", name:"Info Exposure",             count:2, sev:"MEDIUM", findings:["ZRS-022","ZRS-031"] },
            { cwe:"CWE-703", name:"Improper Check / Exception",count:2, sev:"MEDIUM", findings:["ZRS-023","ZRS-025"] },
            { cwe:"CWE-20",  name:"Improper Input Validation",  count:3, sev:"MEDIUM", findings:["ZRS-004","ZRS-037","ZRS-042"] },
            { cwe:"CWE-352", name:"CSRF",                      count:1, sev:"HIGH",   findings:["ZRS-014"] },
            { cwe:"CWE-770", name:"Uncontrolled Resource Alloc",count:2, sev:"HIGH",   findings:["ZRS-016","ZRS-030"] },
            { cwe:"CWE-693", name:"Protection Mechanism Failure",count:1,sev:"MEDIUM",findings:["ZRS-028"] },
          ].map(c => {
            const sColor = c.sev === "CRITICAL" ? "text-red-400 border-red-500/20 bg-red-500/8" :
                           c.sev === "HIGH"     ? "text-orange-400 border-orange-500/20 bg-orange-500/8" :
                                                  "text-yellow-400 border-yellow-500/20 bg-yellow-500/8";
            return (
              <div key={c.cwe} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10">
                <div className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5", sColor)}>{c.cwe}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{c.findings.join(" · ")}</p>
                </div>
                <span className="font-mono text-sm font-bold text-muted-foreground flex-shrink-0">{c.count}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Audit Pass History ── */}
      <Section icon={Activity} title="Audit Pass History" color="text-cyan-400" defaultOpen={false}>
        <div className="mt-3 relative pl-6">
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border/40" />
          {[
            { date:"2026-05-18", pass:"Pass 10", desc:"Full network-aware testnet/mainnet split — all API routes dual-network. Testnet faucet with 24h cooldown, DB-backed.", findings:"0 new" },
            { date:"2026-05-15", pass:"Pass 9",  desc:"API layer full audit: 13 issues (JS-01→JS-13). Math.random() replaced by seededRandom(). Write APIs for tx/stake/governance.", findings:"13 fixed" },
            { date:"2026-05-10", pass:"Pass 8",  desc:"MPT RLP decoder fix (ZRS-017). 17 trie conformance tests added. Merkle Patricia encoding now Ethereum-compatible.", findings:"1 critical fixed" },
            { date:"2026-05-07", pass:"Pass 7",  desc:"ZVM InvalidOpcode fix (ZRS-006). bn128_pairing stub replaced with blst (ZRS-005). EVM gas stipend identified (ZRS-002).", findings:"2 critical fixed, 1 open" },
            { date:"2026-05-03", pass:"Pass 6",  desc:"Consensus safety: locked_qc reset fix (ZRS-007). HotStuff-2 view-change race identified (ZRS-001) — open blocker.", findings:"1 fixed, 1 open" },
            { date:"2026-04-29", pass:"Pass 5",  desc:"Staking escrow MIN_STAKE fix (ZRS-004). Halving off-by-one fix (ZRS-018). Gas overflow fix (ZRS-008).", findings:"3 fixed" },
            { date:"2026-04-25", pass:"Pass 4",  desc:"Genesis hash check added (ZRS-013). Keyfile password log sanitized (ZRS-022). Oracle panic fix (ZRS-035).", findings:"3 fixed" },
            { date:"2026-04-20", pass:"Pass 3",  desc:"Network layer: Weak Arc race fix (ZRS-011). Empty block executor panic fix (ZRS-025). Format string in tracer fix (ZRS-034).", findings:"3 fixed" },
            { date:"2026-04-15", pass:"Pass 2",  desc:"EIP-1559 base fee overflow fix (ZRS-021). tx_root MPT incompatibility identified (ZRS-003). CORS bypass identified (ZRS-014).", findings:"1 fixed, 2 identified" },
            { date:"2026-04-10", pass:"Pass 1",  desc:"Initial full codebase scan. 42 findings across all 74 crates. Categorized by CWE. Prioritized critical path for consensus + VM.", findings:"42 found" },
          ].map(p => (
            <div key={p.pass} className="relative mb-5 last:mb-0">
              <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
              <div className="rounded-lg border border-border/40 bg-card/50 p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-primary">{p.pass}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{p.date}</span>
                  <span className="ml-auto text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">{p.findings}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pre-Mainnet Checklist ── */}
      <Section icon={ShieldCheck} title="Pre-Mainnet Security Checklist" color="text-green-400" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {[
            { item:"Fix CALL/DELEGATECALL 63/64 gas stipend (ZRS-002)",      done:false, blocker:true },
            { item:"Fix tx_root to use Keccak-256 MPT (ZRS-003)",           done:false, blocker:true },
            { item:"Fix HotStuff-2 double-vote race in advance_view (ZRS-001)", done:false, blocker:true },
            { item:"Add mempool size cap + per-sender limit (ZRS-009)",      done:false, blocker:true },
            { item:"Fix TOCTOU in parallel state root (ZRS-010)",            done:false, blocker:true },
            { item:"Fix bridge TLS cert validation (ZRS-012)",               done:false, blocker:true },
            { item:"Fix CORS policy on RPC server (ZRS-014)",                done:false, blocker:false },
            { item:"Add WASM per-call memory enforcement (ZRS-015)",         done:false, blocker:false },
            { item:"Validate KZG blob size before prover (ZRS-016)",         done:false, blocker:false },
            { item:"Fix GossipSub eclipse attack (ZRS-019)",                 done:false, blocker:false },
            { item:"Fix MEV commit-reveal RNG source (ZRS-020)",             done:false, blocker:false },
            { item:"External audit by tier-1 firm",                          done:false, blocker:true },
            { item:"Formal verification of consensus safety rules",          done:false, blocker:true },
            { item:"All CRITICAL and HIGH findings resolved",                done:false, blocker:true },
            // Done items
            { item:"MPT RLP encoding fixed + conformance tested (ZRS-017)",  done:true,  blocker:false },
            { item:"ZVM InvalidOpcode fixed (ZRS-006)",                      done:true,  blocker:false },
            { item:"bn128_pairing precompile replaced with blst (ZRS-005)",  done:true,  blocker:false },
            { item:"locked_qc reset on epoch boundary fixed (ZRS-007)",      done:true,  blocker:false },
            { item:"MIN_STAKE constant unified in config (ZRS-004)",         done:true,  blocker:false },
            { item:"Gas overflow replaced with checked_mul (ZRS-008)",       done:true,  blocker:false },
            { item:"Genesis hash mismatch check added (ZRS-013)",            done:true,  blocker:false },
            { item:"Network peer registry Weak Arc race fixed (ZRS-011)",    done:true,  blocker:false },
            { item:"Keystore password removed from logs (ZRS-022)",          done:true,  blocker:false },
            { item:"Oracle feed count panic fixed (ZRS-035)",                done:true,  blocker:false },
          ].map(c => (
            <div key={c.item} className={cn(
              "flex items-start gap-2.5 p-2.5 rounded-lg border",
              c.done ? "bg-green-500/5 border-green-500/20" : c.blocker ? "bg-red-500/5 border-red-500/20" : "bg-yellow-500/5 border-yellow-500/15"
            )}>
              {c.done
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                : c.blocker
                  ? <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />}
              <span className={cn("text-xs flex-1 leading-relaxed",
                c.done ? "text-muted-foreground line-through" : c.blocker ? "text-red-300" : "text-yellow-300")}>
                {c.item}
              </span>
              {!c.done && c.blocker && (
                <span className="text-[9px] font-mono text-red-400 bg-red-500/15 border border-red-500/30 px-1 py-0.5 rounded flex-shrink-0">BLOCKER</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">External Audit Target:</span> Q3 2026 — targeting Trail of Bits or Sigma Prime. 
          Full audit scope: consensus engine (zbx-consensus), EVM interpreter (zbx-evm), state DB (zbx-state, zbx-trie), bridge (zbx-bridge), and all DeFi contracts.
        </div>
      </Section>

    </div>
  );
}

// ─── FindingCard ───────────────────────────────────────────────────────────────

function FindingCard({ finding: f }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const isOpen = f.status === "OPEN";
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-all",
      f.sev === "CRITICAL" ? isOpen ? "border-red-500/40 bg-red-500/5" : "border-green-500/20 bg-green-500/3"
      : f.sev === "HIGH"   ? isOpen ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/20 bg-green-500/3"
      : "border-border/40 bg-card/40"
    )}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/20 transition-colors">
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", SEV_DOT[f.sev])} />
        <SevBadge sev={f.sev} />
        <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">{f.id}</span>
        {f.cwe && <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:block flex-shrink-0">{f.cwe}</span>}
        <span className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">{f.title}</span>
        <span className={cn("text-[10px] font-mono flex-shrink-0 px-1.5 py-0.5 rounded border",
          isOpen ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {isOpen ? "OPEN" : "FIXED"}
        </span>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{f.loc}</code>
            {f.cwe && <code className="text-[11px] font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">{f.cwe}</code>}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          {f.fix && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
              <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">Fix / Recommendation</p>
              <p className="text-xs text-green-300/80 leading-relaxed font-mono">{f.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
