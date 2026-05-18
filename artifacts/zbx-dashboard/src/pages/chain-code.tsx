import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Code2, X, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const REPO = "servicefree310-ctrl/Chain-Dashboard";
const BASE_PATH = "zbx-chain-source/zbx-chain";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/${BASE_PATH}`;
const GITHUB_BASE = `https://github.com/${REPO}/blob/main/${BASE_PATH}`;

type TreeNode = {
  name: string;
  type: "file" | "dir";
  path: string;
  size?: number;
  children?: TreeNode[];
  description?: string;
};

const CRATE_DESCRIPTIONS: Record<string, string> = {
  "zbx-types": "Core primitives & types — addresses, hashes, U256",
  "zbx-primitives": "Low-level blockchain primitives",
  "zbx-crypto": "Ed25519 signing, Keccak256, Blake3 hashing",
  "zbx-codec": "Binary encoding/decoding for network messages",
  "zbx-rlp": "RLP encoding (Ethereum-compatible)",
  "zbx-abi": "ABI encoding for EVM-compatible contracts",
  "zbx-consensus": "BFT consensus engine (v0.2 multi-validator)",
  "zbx-block": "Block structure, validation, production",
  "zbx-finality": "Finality gadget & confirmation logic",
  "zbx-sequencer": "Transaction sequencing & ordering",
  "zbx-executor": "Block execution coordinator",
  "zbx-rewards": "Block reward calculation & halving",
  "zbx-network": "Noise XX encrypted P2P networking",
  "zbx-net": "Low-level network transport abstractions",
  "zbx-gossip": "Gossip protocol for tx & block propagation",
  "zbx-sync": "Chain sync & fast-sync protocol",
  "zbx-mempool": "Transaction mempool with priority queue",
  "zbx-tx": "Transaction types, signing & validation",
  "zbx-fee": "Fee estimation & gas price oracle",
  "zbx-bundler": "EIP-4337 account abstraction bundler",
  "zbx-mev": "MEV protection & fair ordering",
  "zbx-state": "Global state trie & account storage",
  "zbx-state-rent": "State rent mechanism (ZEP-018)",
  "zbx-storage": "RocksDB storage backend",
  "zbx-trie": "Modified Merkle Patricia Trie",
  "zbx-verkle": "Verkle tree implementation (ZEP-020)",
  "zbx-pruner": "State & history pruning",
  "zbx-snapshot": "Snapshot sync support",
  "zbx-execution": "Transaction execution engine",
  "zbx-evm": "EVM-compatible execution layer (revm)",
  "zbx-vm": "Native ZBX VM",
  "zbx-zvm": "Zero-knowledge VM",
  "zbx-wasm": "WASM smart contract runtime",
  "zbx-zk": "ZK proof generation & verification",
  "zbx-prover": "zkSNARK/STARK prover integration",
  "zbx-rpc": "JSON-RPC server (Ethereum-style)",
  "zbx-jsonrpc": "JSON-RPC method handlers",
  "zbx-xcl": "Native cross-chain layer (no bridges)",
  "zbx-staking": "Validator staking & delegation",
  "zbx-bridge": "Cross-chain bridge protocol",
  "zbx-genesis": "Genesis block creation & configuration",
  "zbx-config": "Node configuration management",
  "zbx-oracle": "Price oracle aggregator",
  "zbx-oracle-optimistic": "Optimistic oracle (ZEP-022)",
  "zbx-oracle-twap": "TWAP price oracle",
  "zbx-oracle-zk": "ZK-verified oracle feeds",
  "zbx-pool": "AMM liquidity pool — 20M ZBX seed",
  "zbx-payid": "PayID human-readable address protocol",
  "zbx-contracts": "Built-in system contracts",
  "zbx-lending": "DeFi lending protocol",
  "zbx-perp": "Perpetual futures protocol",
  "zbx-yield": "Yield aggregator & farming",
  "zbx-nft": "NFT minting & marketplace",
  "zbx-launchpad": "Token launchpad protocol",
  "zbx-gaming": "Gaming SDK & on-chain game state (ZEP-031)",
  "zbx-payment": "Payment gateway integration (ZEP-032)",
  "zbx-metrics": "Prometheus metrics & observability",
  "zbx-telemetry": "OpenTelemetry tracing",
  "zbx-trace": "Transaction trace & debug",
  "zbx-indexer": "On-chain data indexer",
  "zbx-explorer": "Block explorer API backend",
  "zbx-admin": "Node admin interface",
  "zbx-ai-precompile": "AI inference precompile",
  "zbx-ai-sdk": "AI model SDK for smart contracts",
  "zbx-ai-registry": "On-chain AI model registry",
  "zbx-threshold": "Threshold signature scheme",
  "zbx-keystore": "Encrypted keystore management",
  "zbx-pq": "Post-quantum cryptography (ZEP-015)",
  "zbx-confidential": "Confidential transactions (ZEP-025)",
  "zbx-sdk": "Developer SDK — the ZBX toolkit",
  "zbx-wallet": "Wallet implementation",
  "zbx-cli": "Command-line interface (zebvix-node)",
  "zbx-light": "Light client protocol",
  "zbx-da": "Data availability layer",
};

const CRATE_NAMES = Object.keys(CRATE_DESCRIPTIONS);

function makeCrateNode(name: string): TreeNode {
  return {
    name,
    type: "dir",
    path: `crates/${name}`,
    description: CRATE_DESCRIPTIONS[name],
    children: [
      { name: "Cargo.toml", type: "file", path: `crates/${name}/Cargo.toml`, size: 800 },
      {
        name: "src",
        type: "dir",
        path: `crates/${name}/src`,
        children: [{ name: "lib.rs", type: "file", path: `crates/${name}/src/lib.rs`, size: 1200 }],
      },
    ],
  };
}

const TREE: TreeNode = {
  name: "zbx-chain",
  type: "dir",
  path: "",
  children: [
    {
      name: "crates",
      type: "dir",
      path: "crates",
      description: `${CRATE_NAMES.length} Rust workspace crates`,
      children: CRATE_NAMES.map(makeCrateNode),
    },
    {
      name: "node",
      type: "dir",
      path: "node",
      description: "zebvix-node binary entry point",
      children: [
        { name: "Cargo.toml", type: "file", path: "node/Cargo.toml" },
        { name: "src", type: "dir", path: "node/src", children: [{ name: "main.rs", type: "file", path: "node/src/main.rs" }] },
      ],
    },
    {
      name: "contracts",
      type: "dir",
      path: "contracts",
      description: "Solidity / native system contracts",
      children: [],
    },
    {
      name: "sdk",
      type: "dir",
      path: "sdk",
      description: "Developer SDK & client libraries",
      children: [],
    },
    {
      name: "proto",
      type: "dir",
      path: "proto",
      description: "Protocol Buffer / gRPC definitions",
      children: [],
    },
    {
      name: "deploy",
      type: "dir",
      path: "deploy",
      description: "Deployment scripts & configs",
      children: [],
    },
    {
      name: "docker",
      type: "dir",
      path: "docker",
      description: "Docker images & compose files",
      children: [],
    },
    {
      name: "k8s",
      type: "dir",
      path: "k8s",
      description: "Kubernetes manifests",
      children: [],
    },
    {
      name: "monitoring",
      type: "dir",
      path: "monitoring",
      description: "Prometheus / Grafana dashboards",
      children: [],
    },
    {
      name: "docs",
      type: "dir",
      path: "docs",
      description: "Architecture docs & ZEPs",
      children: [],
    },
    {
      name: "tests",
      type: "dir",
      path: "tests",
      description: "Integration & e2e tests",
      children: [],
    },
    {
      name: "benches",
      type: "dir",
      path: "benches",
      description: "Criterion benchmarks",
      children: [],
    },
    {
      name: "scripts",
      type: "dir",
      path: "scripts",
      description: "Utility & devops scripts",
      children: [],
    },
    { name: "Cargo.toml", type: "file", path: "Cargo.toml", size: 4471 },
    { name: "Cargo.lock", type: "file", path: "Cargo.lock", size: 197036 },
    { name: "build.rs", type: "file", path: "build.rs", size: 1422 },
    { name: "README.md", type: "file", path: "README.md", size: 4690 },
    { name: "CHANGELOG.md", type: "file", path: "CHANGELOG.md", size: 72095 },
    { name: "SECURITY.md", type: "file", path: "SECURITY.md", size: 1199 },
    { name: "CONTRIBUTING.md", type: "file", path: "CONTRIBUTING.md", size: 292 },
    { name: "AUDIT_2026-04-30.md", type: "file", path: "AUDIT_2026-04-30.md", size: 680386 },
    { name: "PRODUCTION_AUDIT.md", type: "file", path: "PRODUCTION_AUDIT.md", size: 16402 },
    { name: "HARDENING_TODO.md", type: "file", path: "HARDENING_TODO.md", size: 95969 },
    { name: "deny.toml", type: "file", path: "deny.toml", size: 903 },
  ],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLanguage(name: string): string {
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".toml")) return "toml";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".sh")) return "bash";
  return "text";
}

function TreeNodeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isDir = node.type === "dir";
  const isSelected = selectedPath === node.path;
  const hasChildren = isDir && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isDir) {
      if (hasChildren) setExpanded((e) => !e);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <div
        data-testid={`tree-node-${node.path}`}
        className={cn(
          "flex items-center gap-1.5 py-[3px] px-2 rounded cursor-pointer select-none group transition-colors",
          isSelected ? "bg-primary/15 text-primary" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <span className="w-3.5 flex-shrink-0">
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )
            ) : null}
          </span>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {isDir ? (
          expanded ? (
            <FolderOpen className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-yellow-400" : "text-yellow-500/80")} />
          ) : (
            <Folder className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-yellow-400" : "text-yellow-500/80")} />
          )
        ) : (
          <File className="h-4 w-4 flex-shrink-0 text-blue-400/70" />
        )}

        <span className={cn("text-xs font-mono truncate", isSelected && "text-primary font-semibold")}>
          {node.name}
        </span>

        {node.size && !isDir && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 flex-shrink-0 pr-1">
            {formatBytes(node.size)}
          </span>
        )}
        {node.description && isDir && depth > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground/50 truncate hidden group-hover:block">
            {node.description}
          </span>
        )}
      </div>

      {isDir && expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CrateCard({ name, desc }: { name: string; desc: string }) {
  const categories: Record<string, string> = {
    "zbx-types": "Core", "zbx-primitives": "Core", "zbx-crypto": "Core", "zbx-codec": "Core",
    "zbx-rlp": "Core", "zbx-abi": "Core",
    "zbx-consensus": "Consensus", "zbx-block": "Consensus", "zbx-finality": "Consensus",
    "zbx-sequencer": "Consensus", "zbx-executor": "Consensus", "zbx-rewards": "Consensus",
    "zbx-network": "Network", "zbx-net": "Network", "zbx-gossip": "Network", "zbx-sync": "Network",
    "zbx-mempool": "Txs", "zbx-tx": "Txs", "zbx-fee": "Txs", "zbx-bundler": "Txs", "zbx-mev": "Txs",
    "zbx-state": "State", "zbx-state-rent": "State", "zbx-storage": "State", "zbx-trie": "State",
    "zbx-verkle": "State", "zbx-pruner": "State", "zbx-snapshot": "State",
    "zbx-execution": "VM", "zbx-evm": "VM", "zbx-vm": "VM", "zbx-zvm": "VM",
    "zbx-wasm": "VM", "zbx-zk": "VM", "zbx-prover": "VM",
    "zbx-rpc": "RPC", "zbx-jsonrpc": "RPC",
    "zbx-xcl": "Bridge", "zbx-bridge": "Bridge",
    "zbx-staking": "Econ", "zbx-genesis": "Econ", "zbx-config": "Econ",
    "zbx-oracle": "Oracle", "zbx-oracle-optimistic": "Oracle", "zbx-oracle-twap": "Oracle", "zbx-oracle-zk": "Oracle",
    "zbx-pool": "DeFi", "zbx-lending": "DeFi", "zbx-perp": "DeFi", "zbx-yield": "DeFi",
    "zbx-payid": "DeFi", "zbx-contracts": "DeFi", "zbx-nft": "DeFi", "zbx-launchpad": "DeFi",
    "zbx-gaming": "App", "zbx-payment": "App",
    "zbx-metrics": "Obs", "zbx-telemetry": "Obs", "zbx-trace": "Obs",
    "zbx-indexer": "Tools", "zbx-explorer": "Tools", "zbx-admin": "Tools",
    "zbx-ai-precompile": "AI", "zbx-ai-sdk": "AI", "zbx-ai-registry": "AI",
    "zbx-threshold": "Crypto", "zbx-keystore": "Crypto", "zbx-pq": "Crypto", "zbx-confidential": "Crypto",
    "zbx-sdk": "Client", "zbx-wallet": "Client", "zbx-cli": "Client", "zbx-light": "Client", "zbx-da": "Client",
  };

  const catColors: Record<string, string> = {
    Core: "text-cyan-400 bg-cyan-400/10",
    Consensus: "text-purple-400 bg-purple-400/10",
    Network: "text-blue-400 bg-blue-400/10",
    Txs: "text-orange-400 bg-orange-400/10",
    State: "text-green-400 bg-green-400/10",
    VM: "text-red-400 bg-red-400/10",
    RPC: "text-yellow-400 bg-yellow-400/10",
    Bridge: "text-pink-400 bg-pink-400/10",
    Econ: "text-emerald-400 bg-emerald-400/10",
    Oracle: "text-violet-400 bg-violet-400/10",
    DeFi: "text-teal-400 bg-teal-400/10",
    App: "text-indigo-400 bg-indigo-400/10",
    Obs: "text-amber-400 bg-amber-400/10",
    Tools: "text-slate-400 bg-slate-400/10",
    AI: "text-fuchsia-400 bg-fuchsia-400/10",
    Crypto: "text-rose-400 bg-rose-400/10",
    Client: "text-sky-400 bg-sky-400/10",
  };

  const cat = categories[name] ?? "Core";
  const color = catColors[cat] ?? "text-gray-400 bg-gray-400/10";

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border/40 hover:border-border hover:bg-muted/30 transition-colors">
      <Code2 className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-foreground truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{desc}</div>
      </div>
      <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0", color)}>{cat}</span>
    </div>
  );
}

export default function ChainCode() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "crates">("tree");

  const handleSelect = useCallback(async (node: TreeNode) => {
    setSelectedNode(node);
    setFileContent(null);
    setError(null);
    setLoading(true);

    try {
      const url = `${RAW_BASE}/${node.path}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          setError("File not available in repository (may be generated or excluded).");
        } else {
          setError(`HTTP ${res.status}: Could not load file.`);
        }
        return;
      }
      const text = await res.text();
      setFileContent(text);
    } catch {
      setError("Network error loading file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const lang = selectedNode ? fileLanguage(selectedNode.name) : "text";
  const githubUrl = selectedNode ? `${GITHUB_BASE}/${selectedNode.path}` : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chain Code</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">
            zbx-chain-source/zbx-chain &mdash; {CRATE_NAMES.length} crates &mdash; Rust 2021 Edition
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://github.com/${REPO}/tree/main/${BASE_PATH}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:border-border/80 hover:bg-muted/40"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border flex-shrink-0 px-6">
        <button
          data-testid="tab-tree"
          onClick={() => setActiveTab("tree")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "tree"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          File Tree
        </button>
        <button
          data-testid="tab-crates"
          onClick={() => setActiveTab("crates")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "crates"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Crate Map ({CRATE_NAMES.length})
        </button>
      </div>

      {activeTab === "crates" ? (
        /* Crate Map Grid */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {CRATE_NAMES.map((name) => (
              <CrateCard key={name} name={name} desc={CRATE_DESCRIPTIONS[name]} />
            ))}
          </div>
        </div>
      ) : (
        /* Tree + File Viewer */
        <div className="flex flex-1 overflow-hidden">
          {/* Tree Panel */}
          <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto bg-card/30 py-2">
            <TreeNodeRow
              node={TREE}
              depth={0}
              selectedPath={selectedNode?.path ?? null}
              onSelect={handleSelect}
            />
          </div>

          {/* File Viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedNode ? (
              <>
                {/* File header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/20 flex-shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-foreground truncate">{selectedNode.path}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded flex-shrink-0">
                      {lang}
                    </span>
                    {selectedNode.size && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatBytes(selectedNode.size)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {githubUrl && (
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      data-testid="close-file"
                      onClick={() => { setSelectedNode(null); setFileContent(null); setError(null); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* File content */}
                <div className="flex-1 overflow-auto bg-[#0d1117] relative">
                  {loading && (
                    <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading file...</span>
                    </div>
                  )}
                  {error && !loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-8 text-center">
                      <File className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{error}</p>
                      {githubUrl && (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on GitHub instead
                        </a>
                      )}
                    </div>
                  )}
                  {fileContent && !loading && (
                    <pre className="text-xs font-mono leading-5 p-4 text-[#e6edf3] whitespace-pre overflow-auto h-full">
                      <code>{fileContent}</code>
                    </pre>
                  )}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <div className="p-6 rounded-2xl bg-muted/20 border border-border/40">
                  <Code2 className="h-12 w-12 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-foreground/60">Select a file to view</p>
                  <p className="text-sm mt-1">
                    Browse the ZBX chain source tree on the left
                  </p>
                  <p className="text-xs mt-3 font-mono text-muted-foreground/60">
                    {CRATE_NAMES.length} Rust crates &bull; Cargo workspace &bull; Ed25519 + EVM
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
