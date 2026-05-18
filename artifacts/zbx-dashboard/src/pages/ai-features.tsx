import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bot, Cpu, Zap, ShieldCheck, TrendingUp, CheckCircle2,
  ChevronDown, ChevronRight, ExternalLink, Code2, AlertTriangle,
  GitPullRequest, Layers, Activity, Database, Network
} from "lucide-react";

const MODELS = [
  { id: "M-00", name: "ZBX-Sentiment-v2",   category: "NLP",       gas: 8_000,   inputBytes: 512,  desc: "Classifies on-chain text (DAO proposals, social) as positive/negative/neutral. Used by governance contracts." },
  { id: "M-01", name: "ZBX-Risk-Score-v1",  category: "DeFi",      gas: 12_000,  inputBytes: 256,  desc: "Per-address risk score 0–100 from tx history, velocity, mixer exposure. Used by lending pools." },
  { id: "M-02", name: "ZBX-PricePredict",   category: "Oracle",    gas: 15_000,  inputBytes: 128,  desc: "Short-horizon price direction model. 64-feature feed → bullish/bearish/flat. Supplements TWAP oracle." },
  { id: "M-03", name: "ZBX-AnomalyDetect",  category: "Security",  gas: 10_000,  inputBytes: 384,  desc: "Detects anomalous tx patterns (flash loan attacks, reentrancy precursors). Triggers circuit breaker." },
  { id: "M-04", name: "ZBX-TextGen-7B",     category: "LLM",       gas: 180_000, inputBytes: 2048, desc: "7B parameter on-chain LLM inference for AI Agent messages. Quantized INT4 via GGUF. Highest gas model." },
  { id: "M-05", name: "ZBX-Classifier-NER", category: "NLP",       gas: 6_000,   inputBytes: 512,  desc: "Named entity recognition for contract addresses, amounts, tokens in free-text governance proposals." },
  { id: "M-06", name: "ZBX-FraudDetect",    category: "Security",  gas: 9_500,   inputBytes: 256,  desc: "Binary fraud classifier: rug pull probability per new token contract. Trained on 40k+ historical rugs." },
  { id: "M-07", name: "ZBX-Embeddings-v1",  category: "Semantic",  gas: 11_000,  inputBytes: 1024, desc: "384-dim sentence embeddings for on-chain semantic search, proposal similarity, RAG retrieval." },
  { id: "M-08", name: "ZBX-VolatilityML",   category: "DeFi",      gas: 8_500,   inputBytes: 128,  desc: "Realized-volatility prediction for AMM fee tier selection and options pricing contracts." },
  { id: "M-09", name: "ZBX-ImageHash",      category: "Vision",    gas: 7_000,   inputBytes: 4096, desc: "Perceptual hash + NFT duplicate detection. Called by ZNS to flag trademark violations." },
  { id: "M-10", name: "ZBX-VoiceID",        category: "Audio",     gas: 14_000,  inputBytes: 8192, desc: "Speaker biometrics for DAO multi-sig authentication via voice proof (ZEP-031)." },
  { id: "M-11", name: "ZBX-AgentRouter",    category: "Agent",     gas: 20_000,  inputBytes: 512,  desc: "Routes natural language intent to on-chain action (swap, stake, vote). Used by AI Agent (ZEP-042)." },
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
    desc: "Wrap every AIINFER call in a ZK proof (using EZKL or Risc0). Callers can verify model output without re-running inference. Critical for trust-minimized DeFi AI.",
    deps: ["ZEP-022 (zkEVM Light Client)", "FIX-001 tx_root"],
  },
  {
    id: "UP-003",
    title: "AI Agent v2 — persistent memory + tool calls",
    status: "IN PROGRESS",
    eta: "Q3 2026",
    desc: "Upgrade AI Agent from stateless to persistent cross-session memory (stored as ZBX-Embeddings in on-chain key-value). Add tool-call interface: swap, stake, vote, bridge actions.",
    deps: ["ZBX-AgentRouter (M-11)", "ZBX-Embeddings-v1 (M-07)"],
  },
  {
    id: "UP-004",
    title: "Multi-modal input — image + audio AIINFER",
    status: "PLANNED",
    eta: "Q1 2027",
    desc: "Extend AIINFER precompile to accept multi-modal inputs (image bytes, audio PCM) for M-09 and M-10. Requires calldata compression via KZG blobs to stay within block gas limit.",
    deps: ["ZEP-003 (DA Blobs)"],
  },
  {
    id: "UP-005",
    title: "Federated fine-tuning — on-chain LoRA updates",
    status: "RESEARCH",
    eta: "2027",
    desc: "Community can submit LoRA adapter patches for existing models via governance. Validators vote to apply. Fine-tunes improve model accuracy without full retraining on-chain.",
    deps: ["ZbxGovernor.sol", "ZBX-TextGen (M-04)"],
  },
];

const STATUS_STYLE: Record<string, string> = {
  PLANNED:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "IN PROGRESS": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  RESEARCH:    "bg-purple-500/10 text-purple-400 border-purple-500/20",
  DEPLOYED:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const CAT_COLORS: Record<string, string> = {
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

function GasBar({ gas }: { gas: number }) {
  const max = 180_000;
  const pct = Math.round((gas / max) * 100);
  const color = pct > 70 ? "bg-red-500" : pct > 35 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
        {gas.toLocaleString()} gas
      </span>
    </div>
  );
}

export default function AIFeatures() {
  const [openModel, setOpenModel] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("ALL");

  const categories = ["ALL", ...Array.from(new Set(MODELS.map(m => m.category)))];
  const filteredModels = catFilter === "ALL" ? MODELS : MODELS.filter(m => m.category === catFilter);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-fuchsia-400" />
            AI Features — ZEP-009
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            On-chain AI inference via precompile 0xCA · AIINFER opcode · 12 models
          </p>
        </div>
        <a href="/ai-agent"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors flex-shrink-0">
          <Bot className="h-3.5 w-3.5" /> Try AI Agent
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Precompile Address", value: "0xCA", icon: Cpu, color: "text-fuchsia-400", border: "border-fuchsia-500/30" },
          { label: "Models On-Chain", value: "12",    icon: Database, color: "text-blue-400",    border: "border-blue-500/30" },
          { label: "Activation Block", value: "300K", icon: Zap, color: "text-yellow-400",  border: "border-yellow-500/30" },
          { label: "Min Inference Gas", value: "6K",  icon: Activity, color: "text-emerald-400", border: "border-emerald-500/30" },
        ].map(s => (
          <div key={s.label} className={cn("bg-card border rounded-xl p-4", s.border)}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <span className={cn("text-xs font-mono", s.color)}>{s.label}</span>
            </div>
            <span className={cn("text-3xl font-bold font-mono", s.color)}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* How AIINFER works */}
      <div className="p-5 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20">
        <p className="text-sm font-semibold text-fuchsia-400 mb-2 flex items-center gap-2">
          <Code2 className="h-4 w-4" /> How on-chain AI works
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Any Solidity contract can call AI inference by making a low-level call to precompile address <code className="font-mono bg-fuchsia-900/30 px-1 rounded">0x00...00CA</code>. The calldata encodes the model ID and input bytes. The EVM processes it like any precompile — fixed gas table, deterministic output, verified by every validator.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#0d1117] border border-border/40 p-3">
            <p className="text-[10px] font-mono text-fuchsia-400 mb-1.5">Solidity — call AIINFER from any contract</p>
            <pre className="text-[11px] font-mono text-[#e6edf3] leading-5 overflow-x-auto">{`// Any contract can call on-chain AI
interface IAIInfer {
    function infer(
        uint8  modelId,   // 0-11 model index
        bytes  calldata input
    ) external view returns (bytes memory output);
}

contract RiskGate {
    IAIInfer constant AI =
        IAIInfer(address(0xCA));

    function checkRisk(address user)
        external view returns (uint8 score)
    {
        bytes memory inp = abi.encode(user);
        bytes memory out = AI.infer(1, inp); // M-01 Risk
        score = abi.decode(out, (uint8));
        require(score < 75, "High risk blocked");
    }
}`}</pre>
          </div>
          <div className="rounded-lg bg-[#0d1117] border border-border/40 p-3">
            <p className="text-[10px] font-mono text-fuchsia-400 mb-1.5">Rust — AIINFER precompile implementation</p>
            <pre className="text-[11px] font-mono text-[#e6edf3] leading-5 overflow-x-auto">{`// crates/zbx-ai-precompile/src/lib.rs
pub struct AIInferPrecompile;

impl Precompile for AIInferPrecompile {
    fn call(input: &[u8], gas_limit: u64,
            ctx: &Context) -> PrecompileResult {
        let (model_id, payload) = parse(input)?;
        let model = MODEL_TABLE
            .get(model_id as usize)
            .ok_or(PrecompileError::InvalidInput)?;
        // Gas check
        let gas_cost = GAS_TABLE[model_id as usize];
        if gas_limit < gas_cost {
            return Err(PrecompileError::OutOfGas);
        }
        // Run deterministic inference
        let output = model.infer(payload)?;
        Ok(PrecompileOutput { output, gas_used: gas_cost })
    }
}`}</pre>
          </div>
        </div>
      </div>

      {/* Model table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">12 On-Chain Models</h2>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={cn("text-[10px] font-mono px-2 py-1 rounded border transition-colors",
                  catFilter === c
                    ? "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30"
                    : "bg-muted/20 text-muted-foreground border-border hover:text-foreground"
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredModels.map(m => (
            <div key={m.id}
              className="border border-border/50 rounded-xl overflow-hidden bg-card/40 hover:bg-card/70 transition-colors">
              <button
                onClick={() => setOpenModel(openModel === m.id ? null : m.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className="text-[10px] font-mono text-muted-foreground w-10 flex-shrink-0">{m.id}</span>
                <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0", CAT_COLORS[m.category] || "bg-muted/20 text-muted-foreground")}>
                  {m.category}
                </span>
                <span className="text-sm font-medium flex-1 text-left">{m.name}</span>
                <div className="w-36 hidden sm:block">
                  <GasBar gas={m.gas} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 hidden sm:block w-16 text-right">
                  {m.inputBytes}B input
                </span>
                {openModel === m.id
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </button>
              {openModel === m.id && (
                <div className="px-4 pb-3 pt-0 border-t border-border/30">
                  <div className="flex gap-4 mt-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                    </div>
                    <div className="flex-shrink-0 text-right space-y-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Gas cost</span>
                        <p className="text-sm font-mono font-semibold text-fuchsia-400">{m.gas.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Max input</span>
                        <p className="text-sm font-mono font-semibold">{m.inputBytes} bytes</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 sm:hidden">
                    <GasBar gas={m.gas} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gas table */}
      <div className="border border-border/60 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" /> Per-Model Gas Table (GAS_TABLE[0..11])
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {MODELS.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 border border-border/30">
              <span className="text-[11px] font-mono text-muted-foreground">{m.name.replace("ZBX-", "")}</span>
              <span className="text-[11px] font-mono font-semibold text-yellow-400">{m.gas.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Gas deducted from caller's gas_limit. OutOfGas error if insufficient. Table updatable via governance (ZbxGovernor.sol).
        </p>
      </div>

      {/* Upgrade roadmap */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-400" /> AI Upgrade Roadmap
        </h2>
        <div className="space-y-3">
          {UPGRADES.map(u => (
            <div key={u.id} className="border border-border/50 rounded-xl p-4 bg-card/40">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground">{u.id}</span>
                <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", STATUS_STYLE[u.status])}>
                  {u.status}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                  ETA: {u.eta}
                </span>
              </div>
              <p className="text-sm font-semibold mb-1">{u.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{u.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {u.deps.map(d => (
                  <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
                    dep: {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
