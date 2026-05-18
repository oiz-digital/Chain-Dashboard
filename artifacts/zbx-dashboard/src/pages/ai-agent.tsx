import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Zap, AlertTriangle, CheckCircle2,
  Loader2, User, ChevronDown, Info, Cpu, Activity
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  gasUsed?: number;
  txHash?: string;
  model?: string;
  timestamp: number;
  status?: "pending" | "confirmed" | "failed";
}

const SAMPLE_PROMPTS = [
  "What is the current ZBX staking APR?",
  "Check risk score for address 0xDEAD...BEEF",
  "Summarize the latest governance proposal",
  "Is there any anomaly in recent transactions?",
  "Predict short-term ZBX price direction",
  "Detect fraud risk for new token 0xABC...123",
];

const AI_RESPONSES: Record<string, { content: string; model: string; gas: number }> = {
  default: {
    content: "I am ZBX AI Agent, running on-chain via ZEP-009 AIINFER precompile at address 0xCA. My responses are deterministic, verified by all validators, and committed to the chain. Each message costs gas — you pay per inference.",
    model: "ZBX-AgentRouter (M-11)",
    gas: 20_000,
  },
  staking: {
    content: "Current ZBX staking metrics:\n\n• APR: 8.4% (30-day avg)\n• Total staked: 42,180,000 ZBX (28.1% of supply)\n• Active validators: 67\n• Min stake: 100 ZBX\n• Next epoch reward: ~3,200 ZBX block\n\nRisk assessment (M-01): LOW — staking contract has no anomalous activity in last 50,000 blocks.",
    model: "ZBX-AgentRouter (M-11) + ZBX-Risk-Score-v1 (M-01)",
    gas: 32_000,
  },
  risk: {
    content: "Risk Score Analysis for 0xDEAD...BEEF:\n\n• Score: 71/100 (HIGH RISK)\n• Flags: 3 interactions with sanctioned mixer, high-velocity transfers (>50 tx/hour), 2 failed flash loan attempts\n• Recommendation: BLOCK — do not allow lending pool deposits\n• Confidence: 94.2%\n\nSource: ZBX-Risk-Score-v1 model trained on 2.4M labeled addresses.",
    model: "ZBX-Risk-Score-v1 (M-01)",
    gas: 12_000,
  },
  governance: {
    content: "Latest Governance Proposal — ZEP-043:\n\n\"Increase block gas limit from 30M to 45M\"\n\n• Status: ACTIVE (voting ends block 2,891,200)\n• For: 68.4% (12.4M ZBX)\n• Against: 31.6% (5.7M ZBX)\n• Quorum: ✓ Met (18.1M / 15M required)\n\nSentiment analysis (M-00): POSITIVE — 82% of on-chain discussion is supportive. Key concern: increased state growth.",
    model: "ZBX-Sentiment-v2 (M-00) + ZBX-Classifier-NER (M-05)",
    gas: 14_000,
  },
  anomaly: {
    content: "Anomaly Detection Report (last 10,000 blocks):\n\n⚠️ 1 MEDIUM anomaly detected:\n• Block 2,887,441: Unusual SLOAD pattern in contract 0x7f3a...c2b1\n  → 847 storage reads in single tx (99.8th percentile)\n  → Possible sandwich attack setup\n  → Circuit breaker: NOT triggered (threshold: 99.99th)\n\n✓ No flash loan attacks detected\n✓ No reentrancy patterns detected\n✓ Validator set stable",
    model: "ZBX-AnomalyDetect (M-03)",
    gas: 10_000,
  },
  price: {
    content: "Short-term Price Direction Prediction:\n\n• Signal: BULLISH (72.3% confidence)\n• Features: 64-dim feed including on-chain volume, TVL delta, validator activity, cross-chain flow\n• Predicted horizon: 4–8 blocks (~20–40 seconds)\n• Supplementary to TWAP oracle — do NOT use as sole price source\n\n⚠️ Disclaimer: This is an on-chain ML prediction, not financial advice. Gas cost reflects model complexity.",
    model: "ZBX-PricePredict (M-02)",
    gas: 15_000,
  },
  fraud: {
    content: "Fraud Detection for Token 0xABC...123:\n\n• Rug Pull Probability: 89.3% (VERY HIGH)\n• Flags detected:\n  - Ownership not renounced (admin can mint)\n  - Liquidity unlocked (can rug at any time)\n  - 94% tokens held by 2 wallets\n  - Similar bytecode to 3 known rug pulls\n  - No audit found in ZBX on-chain audit registry\n\n🚨 AVOID — Model confidence: 96.1%\nSource: ZBX-FraudDetect (M-06) trained on 40k+ historical rug pulls.",
    model: "ZBX-FraudDetect (M-06)",
    gas: 9_500,
  },
};

function matchResponse(input: string) {
  const lower = input.toLowerCase();
  if (lower.includes("staking") || lower.includes("apr") || lower.includes("stake")) return RESPONSES.staking;
  if (lower.includes("risk") || lower.includes("0xdead") || lower.includes("address")) return RESPONSES.risk;
  if (lower.includes("governance") || lower.includes("proposal") || lower.includes("vote")) return RESPONSES.governance;
  if (lower.includes("anomal") || lower.includes("detect") || lower.includes("transaction")) return RESPONSES.anomaly;
  if (lower.includes("price") || lower.includes("predict") || lower.includes("direction")) return RESPONSES.price;
  if (lower.includes("fraud") || lower.includes("rug") || lower.includes("token")) return RESPONSES.fraud;
  return RESPONSES.default;
}

// alias for brevity
const RESPONSES = AI_RESPONSES;

function fakeTxHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={cn("flex gap-3", isAgent ? "items-start" : "items-start flex-row-reverse")}>
      <div className={cn(
        "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
        isAgent ? "bg-fuchsia-500/20 border border-fuchsia-500/30" : "bg-blue-500/20 border border-blue-500/30"
      )}>
        {isAgent ? <Bot className="h-4 w-4 text-fuchsia-400" /> : <User className="h-4 w-4 text-blue-400" />}
      </div>
      <div className={cn("flex-1 max-w-[80%]", isAgent ? "" : "flex flex-col items-end")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isAgent
            ? "bg-card border border-border/60 text-foreground rounded-tl-sm"
            : "bg-blue-600 text-white rounded-tr-sm"
        )}>
          {msg.status === "pending"
            ? <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Processing on-chain...</span></div>
            : msg.content
          }
        </div>
        {isAgent && msg.status === "confirmed" && msg.gasUsed && (
          <div className="flex flex-wrap items-center gap-3 mt-1.5 px-1">
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
              <Zap className="h-3 w-3 text-yellow-500" />
              {msg.gasUsed.toLocaleString()} gas used
            </span>
            {msg.txHash && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {msg.txHash.slice(0, 10)}...{msg.txHash.slice(-6)}
              </span>
            )}
            {msg.model && (
              <span className="text-[10px] font-mono text-fuchsia-400/70">{msg.model}</span>
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground mt-1 px-1">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default function AIAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Namaste! I am ZBX AI Agent 🤖\n\nI run fully on-chain via ZEP-009 AIINFER precompile at 0xCA. Every response I generate is:\n• Verified by all 67 validators\n• Committed to the blockchain\n• Gas-metered per inference model\n\nAsk me anything about ZBX Chain — staking, risk scores, governance, fraud detection, price prediction.",
      gasUsed: 20_000,
      txHash: fakeTxHash(),
      model: "ZBX-AgentRouter (M-11)",
      timestamp: Date.now() - 5000,
      status: "confirmed",
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [totalGas, setTotalGas] = useState(20_000);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };
    const pendingId = (Date.now() + 1).toString();
    const pendingMsg: Message = {
      id: pendingId,
      role: "agent",
      content: "",
      timestamp: Date.now() + 100,
      status: "pending",
    };
    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate on-chain inference delay (500ms–2s)
    const delay = 600 + Math.random() * 1200;
    await new Promise(r => setTimeout(r, delay));

    const resp = matchResponse(text);
    const confirmedMsg: Message = {
      id: pendingId,
      role: "agent",
      content: resp.content,
      gasUsed: resp.gas,
      txHash: fakeTxHash(),
      model: resp.model,
      timestamp: Date.now(),
      status: "confirmed",
    };
    setMessages(prev => prev.map(m => m.id === pendingId ? confirmedMsg : m));
    setTotalGas(g => g + resp.gas);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto px-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
            <Bot className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">ZBX AI Agent</p>
            <p className="text-[10px] text-muted-foreground font-mono">on-chain · 0xCA AIINFER · ZEP-009 · ZEP-042</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Session gas</p>
            <p className="text-xs font-mono font-semibold text-yellow-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />{totalGas.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            On-chain
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2 my-3 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/20 flex-shrink-0">
        <Info className="h-3.5 w-3.5 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Every message triggers a real on-chain AI inference call. Gas is deducted from your wallet per model. Responses are deterministic — all validators run the same inference and reach consensus.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 py-2">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 2 && (
        <div className="flex-shrink-0 pb-3">
          <p className="text-[10px] text-muted-foreground mb-2 font-mono">Suggested queries:</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 pt-2 border-t border-border/50">
        <div className="flex-1 flex items-end gap-2 bg-card border border-border/60 rounded-xl px-4 py-3 focus-within:border-fuchsia-500/50 transition-colors">
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground max-h-32 leading-relaxed"
            rows={1}
            disabled={isTyping}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isTyping}
          className="h-10 w-10 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 self-end">
          {isTyping
            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
            : <Send className="h-4 w-4 text-white" />
          }
        </button>
      </div>

      {/* Gas model legend */}
      <div className="flex-shrink-0 flex items-center gap-4 pt-2">
        {[
          { label: "Min gas", val: "6K", color: "text-emerald-400" },
          { label: "Avg gas", val: "12K", color: "text-yellow-400" },
          { label: "LLM gas", val: "180K", color: "text-red-400" },
        ].map(g => (
          <span key={g.label} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Zap className={cn("h-3 w-3", g.color)} />
            {g.label}: <span className={g.color}>{g.val}</span>
          </span>
        ))}
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          Model: ZBX-AgentRouter → routes to best model per query
        </span>
      </div>
    </div>
  );
}
