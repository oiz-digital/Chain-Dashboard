import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Bot, Cpu, Zap, ShieldCheck, TrendingUp, CheckCircle2,
  ChevronDown, ChevronRight, Code2, AlertTriangle,
  Layers, Activity, Database, Network, DollarSign,
  Flame, Lock, Globe, Braces, ArrowRight, Star, Info
} from "lucide-react";

const MODELS = [
  { id: "M-00", name: "ZBX-Sentiment-v2",   category: "NLP",      gas: 8_000,   inputBytes: 512,  quantize: "INT8",  desc: "Classifies on-chain text (DAO proposals, social) as positive/negative/neutral. Used by governance contracts for automated quorum sentiment." },
  { id: "M-01", name: "ZBX-Risk-Score-v1",  category: "DeFi",     gas: 12_000,  inputBytes: 256,  quantize: "INT8",  desc: "Per-address risk score 0–100 derived from tx history, velocity, mixer exposure, and flash loan interactions. Used by lending pools for deposit gating." },
  { id: "M-02", name: "ZBX-PricePredict",   category: "Oracle",   gas: 15_000,  inputBytes: 128,  quantize: "INT8",  desc: "Short-horizon price direction model using 64-feature on-chain feed → bullish/bearish/flat signal. Supplements TWAP oracle, not a replacement." },
  { id: "M-03", name: "ZBX-AnomalyDetect",  category: "Security", gas: 10_000,  inputBytes: 384,  quantize: "INT8",  desc: "Detects anomalous tx patterns: flash loan attacks, reentrancy precursors, sandwich setups. Triggers circuit breaker at 99.99th percentile." },
  { id: "M-04", name: "ZBX-TextGen-7B",     category: "LLM",      gas: 180_000, inputBytes: 2048, quantize: "INT4",  desc: "7B parameter on-chain LLM for AI Agent messages. Quantized INT4 via GGUF. Highest gas cost — 180K. Powers natural language responses in ZEP-042 AI Agent." },
  { id: "M-05", name: "ZBX-Classifier-NER", category: "NLP",      gas: 6_000,   inputBytes: 512,  quantize: "INT8",  desc: "Named entity recognition for contract addresses, amounts, and token names in governance proposals. Cheapest model at 6K gas." },
  { id: "M-06", name: "ZBX-FraudDetect",    category: "Security", gas: 9_500,   inputBytes: 256,  quantize: "INT8",  desc: "Binary fraud classifier: rug pull probability per new token contract. Trained on 40k+ historical rugs. Returns 0–100 rug probability score." },
  { id: "M-07", name: "ZBX-Embeddings-v1",  category: "Semantic", gas: 11_000,  inputBytes: 1024, quantize: "INT8",  desc: "384-dim sentence embeddings for on-chain semantic search, proposal similarity scoring, and RAG retrieval in AI Agent memory." },
  { id: "M-08", name: "ZBX-VolatilityML",   category: "DeFi",     gas: 8_500,   inputBytes: 128,  quantize: "INT8",  desc: "Realized-volatility prediction for AMM fee tier selection and options pricing contracts. Uses 30-day on-chain price history." },
  { id: "M-09", name: "ZBX-ImageHash",      category: "Vision",   gas: 7_000,   inputBytes: 4096, quantize: "INT8",  desc: "Perceptual hash + NFT duplicate detection. Called by ZNS name service to flag trademark violations and DMCA-infringing artwork." },
  { id: "M-10", name: "ZBX-VoiceID",        category: "Audio",    gas: 14_000,  inputBytes: 8192, quantize: "INT8",  desc: "Speaker biometrics for DAO multi-sig authentication via voice proof (ZEP-031). Identifies speaker with 97.3% accuracy on 3-second clips." },
  { id: "M-11", name: "ZBX-AgentRouter",    category: "Agent",    gas: 20_000,  inputBytes: 512,  quantize: "INT8",  desc: "Routes natural language intent to on-chain action (swap, stake, vote, transfer). Used by AI Agent (ZEP-042). Classifies intent + routes to correct model." },
];

const UPGRADES = [
  {
    id: "UP-001",
    title: "ZBX-TextGen-7B → 13B parameter upgrade",
    status: "PLANNED",
    eta: "Q4 2026",
    desc: "Upgrade ZBX-TextGen from 7B to 13B parameters. Requires KZG blob DA for model weights (ZEP-003). Gas: 180k → 420k. Needs DA blob pricing adjustment.",
    deps: ["ZEP-003 (DA Blobs)", "ZEP-042 (AI Agent)"],
  },
  {
    id: "UP-002",
    title: "ZKML — verifiable AI inference proofs",
    status: "RESEARCH",
    eta: "2027",
    desc: "Wrap every AIINFER call in a ZK proof (EZKL or Risc0). Callers can verify model output without re-running inference. Critical for trust-minimized DeFi AI.",
    deps: ["ZEP-022 (zkEVM Light Client)", "FIX-001 tx_root"],
  },
  {
    id: "UP-003",
    title: "AI Agent v2 — persistent memory + tool calls",
    status: "IN PROGRESS",
    eta: "Q3 2026",
    desc: "Upgrade AI Agent from stateless to persistent cross-session memory (ZBX-Embeddings key-value). Add tool-call interface: swap, stake, vote, bridge actions.",
    deps: ["ZBX-AgentRouter (M-11)", "ZBX-Embeddings-v1 (M-07)"],
  },
  {
    id: "UP-004",
    title: "Multi-modal input — image + audio AIINFER",
    status: "PLANNED",
    eta: "Q1 2027",
    desc: "Extend AIINFER precompile to accept multi-modal inputs (image bytes, audio PCM) for M-09 and M-10. Requires calldata compression via KZG blobs.",
    deps: ["ZEP-003 (DA Blobs)"],
  },
  {
    id: "UP-005",
    title: "Federated fine-tuning — on-chain LoRA updates",
    status: "RESEARCH",
    eta: "2027",
    desc: "Community submits LoRA adapter patches for existing models via governance. Validators vote to apply. Fine-tunes improve accuracy without full retraining.",
    deps: ["ZbxGovernor.sol", "ZBX-TextGen (M-04)"],
  },
];

const STATUS_STYLE: Record<string, string> = {
  "PLANNED":     "bg-blue-500/10 text-blue-400 border-blue-500/25",
  "IN PROGRESS": "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "RESEARCH":    "bg-violet-500/10 text-violet-400 border-violet-500/25",
  "DEPLOYED":    "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  "PLANNED":     TrendingUp,
  "IN PROGRESS": Activity,
  "RESEARCH":    Database,
  "DEPLOYED":    CheckCircle2,
};

const CAT_STYLE: Record<string, string> = {
  NLP:      "bg-blue-500/10 text-blue-400",
  DeFi:     "bg-emerald-500/10 text-emerald-400",
  Oracle:   "bg-yellow-500/10 text-yellow-400",
  Security: "bg-red-500/10 text-red-400",
  LLM:      "bg-fuchsia-500/10 text-fuchsia-400",
  Semantic: "bg-cyan-500/10 text-cyan-400",
  Vision:   "bg-orange-500/10 text-orange-400",
  Audio:    "bg-pink-500/10 text-pink-400",
  Agent:    "bg-violet-500/10 text-violet-400",
};

const QUANTIZE_STYLE: Record<string, string> = {
  INT4: "bg-red-500/10 text-red-400 border-red-500/20",
  INT8: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function GasBar({ gas }: { gas: number }) {
  const max = 180_000;
  const pct = Math.round((gas / max) * 100);
  const color = pct > 70 ? "bg-red-500" : pct > 30 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-16 text-right shrink-0">
        {gas >= 1000 ? `${(gas / 1000).toFixed(gas % 1000 === 0 ? 0 : 1)}K` : gas} gas
      </span>
    </div>
  );
}

function RevenueDistribution() {
  const slices = [
    { label: "Model Publishers", pct: 60, color: "#a855f7", desc: "Paid per inference call to the model creator" },
    { label: "ZBX DAO Treasury", pct: 25, color: "#22d3ee", desc: "Funds grants, audits, and protocol development" },
    { label: "Validators",       pct: 15, color: "#22c55e", desc: "Extra reward for running inference nodes" },
  ];

  return (
    <div className="border border-border/60 rounded-xl p-5 bg-card/40">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-emerald-400" /> AI Inference Revenue Distribution
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Bar chart */}
        <div className="space-y-3">
          {slices.map(s => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.pct}%</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
        {/* Info */}
        <div className="space-y-2">
          <div className="rounded-lg bg-muted/20 border border-border/40 p-3">
            <p className="text-xs font-semibold text-foreground mb-1">How billing works</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When a contract calls <code className="font-mono bg-muted/40 px-1 rounded text-[10px]">AIINFER(modelId, input)</code>, the gas fee is deducted from the caller's gas limit. After block finalization, gas revenue is split automatically by the fee distributor contract (<code className="font-mono bg-muted/40 px-1 rounded text-[10px]">0xFE</code>).
            </p>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/40 p-3">
            <p className="text-xs font-semibold text-foreground mb-1">Publishing a model</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Publish quantized GGUF weights to the ZBX AI Registry (<code className="font-mono bg-muted/40 px-1 rounded text-[10px]">zbx-ai-registry</code> crate). Governance approves via ZbxGovernor.sol. Once activated, 60% of all inference revenue flows to your wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SDKSection() {
  const [tab, setTab] = useState<"solidity" | "rust" | "sdk">("solidity");

  const CODE: Record<string, string> = {
    solidity: `// Any contract can call on-chain AI
interface IAIInfer {
    function infer(
        uint8  modelId,   // 0-11 model index
        bytes  calldata input
    ) external view returns (bytes memory output);
}

contract RiskGate {
    IAIInfer constant AI = IAIInfer(address(0xCA));

    function checkRisk(address user)
        external view returns (uint8 score)
    {
        bytes memory inp = abi.encode(user);
        bytes memory out = AI.infer(1, inp); // M-01
        score = abi.decode(out, (uint8));
        require(score < 75, "High risk blocked");
    }
}`,
    rust: `// crates/zbx-ai-precompile/src/lib.rs
pub struct AIInferPrecompile;

impl Precompile for AIInferPrecompile {
    fn call(input: &[u8], gas_limit: u64,
            ctx: &Context) -> PrecompileResult {
        let (model_id, payload) = parse(input)?;
        let model = MODEL_TABLE
            .get(model_id as usize)
            .ok_or(PrecompileError::InvalidInput)?;
        let gas_cost = GAS_TABLE[model_id as usize];
        if gas_limit < gas_cost {
            return Err(PrecompileError::OutOfGas);
        }
        let output = model.infer(payload)?;
        Ok(PrecompileOutput { output, gas_used: gas_cost })
    }
}`,
    sdk: `// zbx-ai-sdk — TypeScript client
import { ZbxAI } from "@zbx/ai-sdk";

const ai = new ZbxAI({ rpc: "https://rpc.zbx.network" });

// Risk score for an address
const score = await ai.infer("risk-score", {
  address: "0x1234...",
});
console.log(score); // { score: 71, flags: [...] }

// Fraud detection for a token
const fraud = await ai.infer("fraud-detect", {
  contract: "0xABC...",
});
console.log(fraud); // { rugProbability: 89.3 }`,
  };

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card/30">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Braces className="h-4 w-4 text-cyan-400" /> SDK & Integration
        </h2>
        <div className="flex gap-1">
          {(["solidity", "rust", "sdk"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("text-[10px] font-mono px-2.5 py-1 rounded transition-colors",
                tab === t
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {t === "sdk" ? "TypeScript SDK" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-[#0d1117] p-4">
        <p className="text-[9px] font-mono text-cyan-400/70 mb-2">
          {tab === "solidity" && "Solidity — call AIINFER from any EVM contract"}
          {tab === "rust" && "Rust — AIINFER precompile implementation (crates/zbx-ai-precompile)"}
          {tab === "sdk" && "TypeScript — zbx-ai-sdk client library"}
        </p>
        <pre className="text-[11px] font-mono text-[#e6edf3] leading-5 overflow-x-auto whitespace-pre">{CODE[tab]}</pre>
      </div>
    </div>
  );
}

export default function AIFeatures() {
  const [openModel, setOpenModel] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("ALL");

  const categories = ["ALL", ...Array.from(new Set(MODELS.map(m => m.category)))];
  const filteredModels = catFilter === "ALL" ? MODELS : MODELS.filter(m => m.category === catFilter);
  const totalGasSpent = MODELS.reduce((s, m) => s + m.gas, 0);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center">
              <Bot className="h-4 w-4 text-fuchsia-400" />
            </div>
            AI Features — ZEP-009 AIINFER
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-mono">
            On-chain deterministic AI inference · Precompile 0xCA · 12 quantized models · Validator-verified
          </p>
        </div>
        <Link href="/ai-agent"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors flex-shrink-0">
          <Bot className="h-4 w-4" /> Try AI Agent
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Precompile Address", value: "0xCA",  sub: "EVM-native",      icon: Cpu,      color: "text-fuchsia-400", border: "border-fuchsia-500/25", bg: "bg-fuchsia-500/5" },
          { label: "Models On-Chain",    value: "12",    sub: "INT4/INT8 quant", icon: Database, color: "text-blue-400",    border: "border-blue-500/25",   bg: "bg-blue-500/5" },
          { label: "Activation Block",   value: "300K",  sub: "HotStuff-BFT",    icon: Zap,      color: "text-yellow-400", border: "border-yellow-500/25", bg: "bg-yellow-500/5" },
          { label: "Min Inference Gas",  value: "6K",    sub: "per call",        icon: Flame,    color: "text-emerald-400",border: "border-emerald-500/25",bg: "bg-emerald-500/5" },
        ].map(s => (
          <div key={s.label} className={cn("border rounded-xl p-4", s.border, s.bg)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-muted-foreground">{s.label}</span>
              <s.icon className={cn("h-3.5 w-3.5", s.color)} />
            </div>
            <span className={cn("text-3xl font-bold font-mono", s.color)}>{s.value}</span>
            <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* SDK section */}
      <SDKSection />

      {/* Revenue distribution */}
      <RevenueDistribution />

      {/* Model table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">Model Registry</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {MODELS.length} models · avg {Math.round(totalGasSpent / MODELS.length / 1000)}K gas · all quantized for determinism
            </p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded-md border transition-colors",
                  catFilter === c
                    ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25"
                    : "bg-muted/20 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/40"
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          {filteredModels.map(m => (
            <div key={m.id}
              className="border border-border/50 rounded-xl overflow-hidden bg-card/30 hover:bg-card/60 transition-all duration-150">
              <button
                onClick={() => setOpenModel(openModel === m.id ? null : m.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className="text-[10px] font-mono text-muted-foreground/60 w-9 shrink-0">{m.id}</span>
                <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0", CAT_STYLE[m.category] || "bg-muted/20 text-muted-foreground")}>
                  {m.category}
                </span>
                <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0", QUANTIZE_STYLE[m.quantize])}>
                  {m.quantize}
                </span>
                <span className="text-sm font-medium flex-1 text-left">{m.name}</span>
                <div className="w-32 hidden md:block shrink-0">
                  <GasBar gas={m.gas} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:block w-14 text-right">
                  {m.inputBytes}B
                </span>
                {openModel === m.id
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                }
              </button>
              {openModel === m.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border/30 bg-muted/10">
                  <div className="flex gap-4 mt-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                      <div className="mt-3 md:hidden">
                        <GasBar gas={m.gas} />
                      </div>
                    </div>
                    <div className="shrink-0 space-y-2 text-right">
                      <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground">Gas cost</p>
                        <p className="text-sm font-mono font-bold text-fuchsia-400">{m.gas.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground">Max input</p>
                        <p className="text-sm font-mono font-bold">{m.inputBytes}B</p>
                      </div>
                      <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground">Quantization</p>
                        <p className={cn("text-sm font-mono font-bold", QUANTIZE_STYLE[m.quantize].split(" ")[1])}>{m.quantize}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gas table */}
      <div className="border border-border/60 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" /> GAS_TABLE[0..11] — Precompile Gas Schedule
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Fixed gas costs per model index. Deducted from caller's gas_limit. Updatable via governance (ZbxGovernor.sol).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {MODELS.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/15 border border-border/30 hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">{m.id}</p>
                <p className="text-[11px] font-mono text-foreground">{m.name.replace("ZBX-", "")}</p>
              </div>
              <span className="text-[12px] font-mono font-bold text-yellow-400">{m.gas >= 1000 ? `${m.gas / 1000}K` : m.gas}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade roadmap */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-400" /> AI Upgrade Roadmap
        </h2>
        <div className="space-y-2">
          {UPGRADES.map((u, i) => {
            const StatusIcon = STATUS_ICON[u.status] || Info;
            return (
              <div key={u.id} className="border border-border/50 rounded-xl p-4 bg-card/30 hover:bg-card/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center mt-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground/60">{u.id}</span>
                      <span className={cn("flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border", STATUS_STYLE[u.status])}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {u.status}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/40">
                        ETA: {u.eta}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{u.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{u.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {u.deps.map(d => (
                        <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground border border-border/40">
                          dep:{" "}{d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security model */}
      <div className="rounded-xl border border-border/60 p-5 bg-card/30">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Security & Determinism Guarantees
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Lock, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Deterministic Output", desc: "Same input + model always produces identical output across all 67 validators. No randomness." },
            { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10", title: "Validator Consensus", desc: "Every AIINFER result is verified by all validators before block finalization. Disagrement causes slashing." },
            { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", title: "Gas Protection", desc: "Each model has a fixed GAS_TABLE entry. OutOfGas prevents DoS attacks on the inference node." },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 rounded-lg bg-muted/15 border border-border/40">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <item.icon className={cn("h-4 w-4", item.color)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-0.5">{item.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
