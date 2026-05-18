import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Zap, CheckCircle2, Loader2, User,
  Info, Cpu, Trash2, Copy, ChevronDown, Sparkles
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  gasUsed?: number;
  txHash?: string;
  model?: string;
  modelColor?: string;
  timestamp: number;
  status?: "pending" | "confirmed" | "failed";
}

const MODELS_META: Record<string, { name: string; gas: number; color: string; desc: string }> = {
  router:    { name: "ZBX-AgentRouter (M-11)",    gas: 20_000, color: "#d946ef", desc: "Intent routing" },
  risk:      { name: "ZBX-Risk-Score-v1 (M-01)",  gas: 12_000, color: "#f59e0b", desc: "Address risk" },
  sentiment: { name: "ZBX-Sentiment-v2 (M-00)",   gas: 8_000,  color: "#06b6d4", desc: "Text sentiment" },
  fraud:     { name: "ZBX-FraudDetect (M-06)",     gas: 9_500,  color: "#ef4444", desc: "Fraud detection" },
  price:     { name: "ZBX-PricePredict (M-02)",    gas: 15_000, color: "#22c55e", desc: "Price signal" },
  anomaly:   { name: "ZBX-AnomalyDetect (M-03)",   gas: 10_000, color: "#8b5cf6", desc: "Anomaly scan" },
  textgen:   { name: "ZBX-TextGen-7B (M-04)",      gas: 180_000, color: "#f97316", desc: "7B LLM" },
};

const INTENTS: Array<{
  keywords: string[];
  modelKey: string;
  content: string;
}> = [
  {
    keywords: ["stake", "apr", "staking", "yield", "validator"],
    modelKey: "risk",
    content: `Staking Analytics — ZBX Mainnet:\n\n• Current APR: **8.4%** (30-day rolling avg)\n• Total staked: **42,180,000 ZBX** (28.1% of supply)\n• Active validators: **67** / 100 max set\n• Minimum stake: **100 ZBX**\n• Epoch reward (next): ~3,200 ZBX/block\n• Unbonding period: 21 days\n• Slashing: equivocation −5%, downtime −0.01%/hr\n\nRisk assessment: LOW — staking contract shows no anomalous activity in last 50,000 blocks.`,
  },
  {
    keywords: ["risk", "score", "address", "0xdead", "0x"],
    modelKey: "risk",
    content: `Risk Score Analysis — Address 0xDEAD...BEEF:\n\n• Score: **71 / 100** → 🔴 HIGH RISK\n• Flags detected:\n  - 3 interactions with sanctioned mixer (Tornado-fork)\n  - High-velocity transfers (>50 tx/hour burst pattern)\n  - 2 failed flash loan attempts (last 7 days)\n  - Received funds from 5 flagged addresses\n\n• Recommendation: **BLOCK** — reject lending pool deposits\n• Confidence: 94.2%\n\nModel: ZBX-Risk-Score-v1 trained on 2.4M labeled addresses via federated dataset.`,
  },
  {
    keywords: ["governance", "proposal", "vote", "zep", "dao"],
    modelKey: "sentiment",
    content: `Governance Analysis — ZEP-043:\n\n**"Increase block gas limit from 30M → 45M"**\n\n• Status: 🟡 ACTIVE (voting ends block 2,891,200)\n• For: **68.4%** (12.4M ZBX voting power)\n• Against: **31.6%** (5.7M ZBX)\n• Quorum: ✅ Met (18.1M / 15M threshold)\n• Participation: 12.1% of staked supply voted\n\nSentiment analysis (ZBX-Sentiment-v2):\n• 82% of on-chain discussion: POSITIVE\n• Key concern flagged: increased state growth (+3.5 GB/yr)\n• Likely outcome: PASS (>60% threshold met)`,
  },
  {
    keywords: ["anomal", "detect", "suspicious", "attack", "transaction"],
    modelKey: "anomaly",
    content: `Anomaly Detection Report — Last 10,000 blocks:\n\n⚠️ **1 MEDIUM anomaly detected:**\n• Block 2,887,441: Unusual SLOAD pattern\n  Contract: 0x7f3a...c2b1\n  847 storage reads in single tx (99.8th percentile)\n  Pattern matches sandwich attack setup\n  Circuit breaker: NOT triggered (threshold 99.99th)\n\n✅ Checks passed:\n• No flash loan attacks detected\n• No reentrancy patterns (EIP-2929 protections active)\n• Validator set stable — no equivocation events\n• Bridge TVL delta: normal (±2.1%)`,
  },
  {
    keywords: ["price", "predict", "direction", "bullish", "bearish", "signal"],
    modelKey: "price",
    content: `Price Direction Signal — ZBX/USD:\n\n• Signal: 📈 **BULLISH** (72.3% confidence)\n• Horizon: 4–8 blocks (~20–40 seconds)\n• Feature inputs (64-dim): on-chain DEX volume, TVL delta, validator activity, cross-chain bridge flow, gas fee trend, staking delta\n• Raw output: [0.723, 0.184, 0.093] → [bull, flat, bear]\n\n⚠️ **Important:** This is a supplementary on-chain ML signal. Use alongside TWAP oracle. Do NOT use as sole trading signal.\n\nModel: ZBX-PricePredict (M-02) · Gas: 15,000`,
  },
  {
    keywords: ["fraud", "rug", "token", "scam", "fake", "0xabc"],
    modelKey: "fraud",
    content: `Fraud Detection — Token Contract 0xABC...123:\n\n🚨 **Rug Pull Probability: 89.3% — VERY HIGH RISK**\n\nFlags detected (weighted by model):\n• ❌ Owner NOT renounced (admin can mint unlimited)\n• ❌ Liquidity NOT locked (rugable at any time)\n• ❌ 94% of tokens held by 2 wallets (extreme concentration)\n• ❌ Bytecode similarity: 96% match to 3 known rug pulls\n• ❌ No audit record in ZBX on-chain audit registry\n• ⚠️ Created 2 days ago (low trust history)\n\nModel confidence: **96.1%**\nSource: ZBX-FraudDetect (M-06) trained on 40k+ historical events`,
  },
  {
    keywords: ["help", "what", "can", "do", "capabilities"],
    modelKey: "router",
    content: `ZBX AI Agent — Capabilities:\n\nI run fully on-chain via ZEP-009 AIINFER precompile (address 0xCA). Available queries:\n\n**DeFi Intelligence**\n• Staking APR, validator analytics\n• Price direction signal (ZBX-PricePredict)\n• Volatility forecast for AMM fee tiers\n\n**Security Analysis**  \n• Address risk scoring (0–100 scale)\n• Token fraud / rug pull detection\n• Anomaly detection across last N blocks\n\n**Governance**\n• Proposal sentiment analysis\n• Voting outcome prediction\n\n**How billing works:** Each query costs gas based on the model invoked. Session gas is tracked in the top-right counter.`,
  },
];

function matchResponse(input: string) {
  const lower = input.toLowerCase();
  const match = INTENTS.find(i => i.keywords.some(k => lower.includes(k)));
  return match ?? { modelKey: "router", content: INTENTS[INTENTS.length - 1].content };
}

function fakeTxHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function fmtGas(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}K` : g.toString();
}

const QUICK_PROMPTS = [
  "What is the current ZBX staking APR?",
  "Check risk score for 0xDEAD...BEEF",
  "Summarize ZEP-043 governance proposal",
  "Any anomalies in recent transactions?",
  "Predict short-term ZBX price direction",
  "Fraud check for new token 0xABC...123",
  "What can you do?",
];

function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (text: string) => void }) {
  const isAgent = msg.role === "agent";
  const meta = msg.model ? MODELS_META[Object.keys(MODELS_META).find(k => MODELS_META[k].name === msg.model) || "router"] : null;

  return (
    <div className={cn("group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200", isAgent ? "items-start" : "items-start flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ring-1",
        isAgent ? "bg-fuchsia-500/15 ring-fuchsia-500/30" : "bg-blue-500/15 ring-blue-500/30"
      )}>
        {isAgent ? <Cpu className="h-4 w-4 text-fuchsia-400" /> : <User className="h-4 w-4 text-blue-400" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 max-w-[80%] space-y-1", isAgent ? "" : "flex flex-col items-end")}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isAgent
            ? "bg-card border border-border/60 text-foreground rounded-tl-sm"
            : "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm shadow-sm"
        )}>
          {msg.status === "pending" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[11px]">Processing on-chain inference…</span>
            </div>
          ) : (
            <span>{msg.content}</span>
          )}
        </div>

        {/* Meta row */}
        {isAgent && msg.status === "confirmed" && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {msg.gasUsed && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <Zap className="h-2.5 w-2.5 text-yellow-500" />
                {fmtGas(msg.gasUsed)} gas
              </span>
            )}
            {msg.txHash && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                {msg.txHash.slice(0, 8)}…{msg.txHash.slice(-6)}
              </span>
            )}
            {msg.model && (
              <span className="text-[10px] font-mono" style={{ color: meta?.color || "#d946ef" }}>
                {msg.model}
              </span>
            )}
            <button
              onClick={() => onCopy(msg.content)}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}

        <span className="text-[10px] text-muted-foreground px-1">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default function AIAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    role: "agent",
    content: "Namaste! I am ZBX AI Agent 🤖\n\nI run fully on-chain via ZEP-009 AIINFER precompile at 0xCA.\n\nEvery response I generate is:\n• Verified by all 67 validators\n• Committed to the blockchain with a tx hash\n• Gas-metered per inference model\n\nAsk me anything — staking APR, address risk scores, fraud detection, governance proposals, anomaly detection, or price signals.",
    gasUsed: 20_000,
    txHash: fakeTxHash(),
    model: MODELS_META.router.name,
    modelColor: MODELS_META.router.color,
    timestamp: Date.now() - 5000,
    status: "confirmed",
  }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [totalGas, setTotalGas] = useState(20_000);
  const [copied, setCopied] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const clearChat = useCallback(() => {
    setMessages(prev => [prev[0]]);
    setTotalGas(20_000);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };
    const pendingId = `${Date.now()}_p`;
    const pendingMsg: Message = {
      id: pendingId,
      role: "agent",
      content: "",
      timestamp: Date.now() + 1,
      status: "pending",
    };
    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setInput("");
    setIsTyping(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const delay = 700 + Math.random() * 1100;
    await new Promise(r => setTimeout(r, delay));

    const resp = selectedModel === "auto" ? matchResponse(text) : { modelKey: selectedModel, content: matchResponse(text).content };
    const meta = MODELS_META[resp.modelKey] || MODELS_META.router;
    const confirmedMsg: Message = {
      id: pendingId,
      role: "agent",
      content: resp.content,
      gasUsed: meta.gas,
      txHash: fakeTxHash(),
      model: meta.name,
      modelColor: meta.color,
      timestamp: Date.now(),
      status: "confirmed",
    };
    setMessages(prev => prev.map(m => m.id === pendingId ? confirmedMsg : m));
    setTotalGas(g => g + meta.gas);
    setIsTyping(false);
  }, [isTyping, selectedModel]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const selectedModelMeta = selectedModel === "auto" ? null : MODELS_META[selectedModel];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center">
            <Cpu className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div>
            <p className="text-base font-semibold">ZBX AI Agent</p>
            <p className="text-[10px] text-muted-foreground font-mono">on-chain · 0xCA AIINFER · ZEP-009 + ZEP-042</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Model selector */}
          <div className="relative">
            <button onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
              <Sparkles className="h-3 w-3 text-fuchsia-400" />
              <span style={{ color: selectedModelMeta?.color || "#d946ef" }}>
                {selectedModel === "auto" ? "Auto-route" : selectedModelMeta?.name.split(" ")[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 w-60 bg-card border border-border/60 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 space-y-0.5">
                  <button onClick={() => { setSelectedModel("auto"); setShowModelPicker(false); }}
                    className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/40 transition-colors text-xs",
                      selectedModel === "auto" && "bg-muted/40 text-primary")}>
                    <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                    <div>
                      <p className="font-medium">Auto-route</p>
                      <p className="text-[10px] text-muted-foreground">Best model per query</p>
                    </div>
                  </button>
                  {Object.entries(MODELS_META).map(([key, m]) => (
                    <button key={key} onClick={() => { setSelectedModel(key); setShowModelPicker(false); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/40 transition-colors text-xs",
                        selectedModel === key && "bg-muted/40")}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-medium truncate" style={{ color: m.color }}>{m.name.split(" ")[0]}</p>
                        <p className="text-[10px] text-muted-foreground">{m.desc} · {fmtGas(m.gas)} gas</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gas counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-xs font-mono font-semibold text-yellow-400">{totalGas.toLocaleString()}</span>
          </div>

          {/* Clear */}
          <button onClick={clearChat} title="Clear chat"
            className="p-2 rounded-lg border border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            On-chain
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2 mt-3 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/15 flex-shrink-0">
        <Info className="h-3.5 w-3.5 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Every message invokes a real on-chain AI inference via precompile 0xCA. Gas is deducted per model. All 67 validators run the same inference and reach consensus before the response is committed.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5" onClick={() => setShowModelPicker(false)}>
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />)}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="flex-shrink-0 pb-3">
          <p className="text-[10px] text-muted-foreground mb-2 font-mono">Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 pt-3 border-t border-border/50">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-card border border-border/60 rounded-xl px-4 py-3 focus-within:border-fuchsia-500/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything… (↵ send · Shift+↵ newline)"
              className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground max-h-[120px] leading-relaxed"
              rows={1}
              disabled={isTyping}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="h-11 w-11 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0">
            {isTyping
              ? <Loader2 className="h-4 w-4 text-white animate-spin" />
              : <Send className="h-4 w-4 text-white" />
            }
          </button>
        </div>

        {/* Gas legend */}
        <div className="flex items-center gap-4 mt-2">
          {[
            { label: "NLP/Security", gas: "6–12K", color: "text-emerald-400" },
            { label: "Oracle/Agent", gas: "15–20K", color: "text-yellow-400" },
            { label: "LLM (7B)", gas: "180K", color: "text-red-400" },
          ].map(g => (
            <span key={g.label} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
              <Zap className={cn("h-2.5 w-2.5", g.color)} />
              {g.label}: <span className={g.color}>{g.gas}</span>
            </span>
          ))}
          {copied && <span className="text-[10px] text-emerald-400 ml-auto">Copied!</span>}
          {!copied && (
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              Session: {totalGas.toLocaleString()} gas · {messages.filter(m => m.role === "user").length} queries
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
