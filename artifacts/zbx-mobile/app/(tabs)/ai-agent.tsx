import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  gas?: number;
  model?: string;
  modelColor?: string;
  txHash?: string;
  ts: number;
  status?: "pending" | "done";
}

const MODELS: Record<string, { name: string; shortName: string; gas: number; color: string; desc: string }> = {
  router:    { name: "ZBX-AgentRouter (M-11)",    shortName: "AgentRouter",   gas: 20_000,  color: "#d946ef", desc: "Intent routing + dispatch" },
  risk:      { name: "ZBX-Risk-Score-v1 (M-01)",  shortName: "RiskScore",     gas: 12_000,  color: "#f59e0b", desc: "Address risk scoring 0–100" },
  sentiment: { name: "ZBX-Sentiment-v2 (M-00)",   shortName: "Sentiment",     gas: 8_000,   color: "#06b6d4", desc: "Governance text sentiment" },
  fraud:     { name: "ZBX-FraudDetect (M-06)",     shortName: "FraudDetect",   gas: 9_500,   color: "#ef4444", desc: "Rug pull probability" },
  price:     { name: "ZBX-PricePredict (M-02)",    shortName: "PricePredict",  gas: 15_000,  color: "#22c55e", desc: "Price direction signal" },
  anomaly:   { name: "ZBX-AnomalyDetect (M-03)",   shortName: "AnomalyDetect", gas: 10_000,  color: "#8b5cf6", desc: "Tx anomaly detection" },
};

const RESPONSES: Record<string, { text: string; modelKey: string }> = {
  staking: {
    modelKey: "risk",
    text: "Staking Analytics:\n\n• APR: 8.4% (30-day avg)\n• Total staked: 42.18M ZBX (28.1%)\n• Active validators: 67 / 100\n• Min stake: 100 ZBX\n• Unbonding: 21 days\n\nRisk: LOW — no anomalous staking activity.",
  },
  risk: {
    modelKey: "risk",
    text: "Address Risk Score:\n\n• Score: 71/100 → HIGH RISK\n• Flags:\n  - Mixer interactions (x3)\n  - High-velocity transfers (>50 tx/hr)\n  - Failed flash loan attempts\n\n• Action: BLOCK lending deposits\n• Confidence: 94.2%",
  },
  fraud: {
    modelKey: "fraud",
    text: "Fraud Detection:\n\n🚨 Rug Probability: 89.3% — VERY HIGH\n\n• Admin can mint (not renounced)\n• Liquidity unlocked\n• 94% held by 2 wallets\n• Bytecode: 96% match to known rugs\n• No audit record found\n\nConfidence: 96.1%",
  },
  price: {
    modelKey: "price",
    text: "Price Signal:\n\n• Direction: BULLISH (72.3%)\n• Horizon: ~4–8 blocks (40s)\n• 64-dim on-chain feature feed\n\n⚠️ Supplementary signal only. Use with TWAP oracle.",
  },
  anomaly: {
    modelKey: "anomaly",
    text: "Anomaly Report (last 10K blocks):\n\n⚠️ 1 MEDIUM anomaly:\n• Block 2,887,441\n  847 SLOAD in single tx\n  Possible sandwich setup\n\n✓ No flash loan attacks\n✓ No reentrancy detected",
  },
  governance: {
    modelKey: "sentiment",
    text: "ZEP-043 Analysis:\n\n\"Increase gas limit 30M → 45M\"\n\n• For: 68.4% · Against: 31.6%\n• Quorum: ✓ Met (18.1M / 15M)\n• Sentiment: 82% positive\n• Likely outcome: PASS",
  },
  help: {
    modelKey: "router",
    text: "I can help with:\n\n🔒 Security\n• Address risk scoring\n• Token fraud detection\n• Anomaly scanning\n\n📊 DeFi\n• Staking APR & stats\n• Price direction signal\n• Volatility forecast\n\n🗳️ Governance\n• Proposal sentiment\n• Vote outcome prediction\n\nAll on-chain · gas-metered · validator-verified",
  },
};

function matchResponse(input: string) {
  const l = input.toLowerCase();
  if (l.includes("stake") || l.includes("apr") || l.includes("staking")) return RESPONSES.staking;
  if (l.includes("risk") || l.includes("score") || l.includes("address")) return RESPONSES.risk;
  if (l.includes("fraud") || l.includes("rug") || l.includes("token")) return RESPONSES.fraud;
  if (l.includes("price") || l.includes("predict") || l.includes("bullish")) return RESPONSES.price;
  if (l.includes("anomal") || l.includes("detect") || l.includes("attack")) return RESPONSES.anomaly;
  if (l.includes("govern") || l.includes("vote") || l.includes("proposal")) return RESPONSES.governance;
  return RESPONSES.help;
}

function fakeHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function fmtGas(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}K` : g.toString();
}

const QUICK = [
  "What is ZBX staking APR?",
  "Risk score for 0xDEAD…",
  "Token fraud check",
  "Price signal",
  "Anomaly report",
  "ZEP-043 status",
];

function TypingIndicator({ color }: { color: string }) {
  const anims = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4, paddingVertical: 4 }}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: a }} />
      ))}
    </View>
  );
}

export default function AIAgentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [totalGas, setTotalGas] = useState(20_000);
  const [msgs, setMsgs] = useState<Message[]>([{
    id: "welcome",
    role: "agent",
    text: "Namaste! I am ZBX AI Agent 🤖\n\nRunning on-chain via ZEP-009 AIINFER precompile at 0xCA.\n\nEvery response is:\n• Verified by all 67 validators\n• Committed to the blockchain\n• Gas-metered per model\n\nAsk about staking, risk, fraud, governance, or price signals.",
    gas: 20_000,
    model: MODELS.router.name,
    modelColor: MODELS.router.color,
    txHash: fakeHash(),
    ts: Date.now(),
    status: "done",
  }]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uid = Date.now().toString();
    const pid = uid + "_p";
    setMsgs(prev => [
      ...prev,
      { id: uid, role: "user", text: trimmed, ts: Date.now(), status: "done" },
      { id: pid, role: "agent", text: "", ts: Date.now() + 1, status: "pending" },
    ]);
    setInput("");
    setBusy(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));

    const resp = matchResponse(trimmed);
    const model = MODELS[resp.modelKey] || MODELS.router;
    setMsgs(prev => prev.map(m =>
      m.id === pid
        ? { ...m, text: resp.text, gas: model.gas, model: model.name, modelColor: model.color, txHash: fakeHash(), status: "done" }
        : m
    ));
    setTotalGas(g => g + model.gas);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [busy]);

  const s = makeStyles(colors);

  const renderMsg = useCallback(({ item }: { item: Message }) => {
    const isAgent = item.role === "agent";
    return (
      <View style={[s.msgRow, isAgent ? s.msgRowAgent : s.msgRowUser]}>
        {isAgent && (
          <View style={s.agentAvatar}>
            <Feather name="cpu" size={13} color="#d946ef" />
          </View>
        )}
        <View style={{ maxWidth: "78%", gap: 4 }}>
          <View style={[
            s.bubble,
            isAgent ? [s.bubbleAgent, { backgroundColor: colors.card, borderColor: colors.border }] : s.bubbleUser,
          ]}>
            {item.status === "pending" ? (
              <TypingIndicator color="#d946ef" />
            ) : (
              <Text style={[s.bubbleText, { color: isAgent ? colors.foreground : "#fff" }]}>
                {item.text}
              </Text>
            )}
          </View>

          {isAgent && item.status === "done" && item.gas && (
            <View style={s.gasMeta}>
              <Feather name="zap" size={9} color="#f59e0b" />
              <Text style={s.gasText}>{fmtGas(item.gas)} gas</Text>
              {item.model && (
                <Text style={[s.modelText, { color: item.modelColor || "#d946ef" }]}>
                  · {item.model.split(" ")[0].replace("ZBX-", "")}
                </Text>
              )}
              {item.txHash && (
                <>
                  <Feather name="check-circle" size={9} color="#22c55e" />
                  <Text style={[s.gasText, { color: "#22c55e" }]}>{item.txHash.slice(0, 8)}…</Text>
                </>
              )}
            </View>
          )}
          <Text style={[s.timestamp, { color: colors.mutedForeground }]}>
            {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        {!isAgent && (
          <View style={s.userAvatar}>
            <Feather name="user" size={13} color="#60a5fa" />
          </View>
        )}
      </View>
    );
  }, [colors]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <View style={[s.headerIcon, { backgroundColor: "#d946ef20", borderColor: "#d946ef35" }]}>
            <Feather name="cpu" size={18} color="#d946ef" />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>ZBX AI Agent</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>0xCA AIINFER · ZEP-009 · 12 models</Text>
          </View>
        </View>
        <View style={{ gap: 6, alignItems: "flex-end" }}>
          <View style={[s.gasWidget, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b25" }]}>
            <Feather name="zap" size={11} color="#f59e0b" />
            <Text style={[s.gasTotal, { color: "#f59e0b" }]}>{totalGas.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={[s.liveIndicator, { backgroundColor: colors.success }]} />
            <Text style={[s.liveText, { color: colors.success }]}>on-chain</Text>
          </View>
        </View>
      </View>

      {/* Model legend */}
      <View style={[s.modelLegend, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[s.legendLabel, { color: colors.mutedForeground }]}>Models:</Text>
        <View style={s.legendRow}>
          {Object.values(MODELS).slice(0, 4).map(m => (
            <View key={m.shortName} style={[s.modelChip, { borderColor: m.color + "30", backgroundColor: m.color + "10" }]}>
              <View style={[s.modelDot, { backgroundColor: m.color }]} />
              <Text style={[s.modelChipText, { color: m.color }]}>{m.shortName}</Text>
            </View>
          ))}
          <Text style={[s.moreMods, { color: colors.mutedForeground }]}>+{Object.keys(MODELS).length - 4}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={m => m.id}
          renderItem={renderMsg}
          contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            msgs.length <= 1 ? (
              <View style={s.quickWrap}>
                <Text style={[s.quickLabel, { color: colors.mutedForeground }]}>Try asking:</Text>
                <View style={s.quickRow}>
                  {QUICK.map(q => (
                    <TouchableOpacity
                      key={q}
                      style={[s.quickChip, { borderColor: colors.border, backgroundColor: colors.card }]}
                      onPress={() => send(q)}
                    >
                      <Text style={[s.quickText, { color: colors.foreground }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={[s.inputBar, {
          borderTopColor: colors.border,
          paddingBottom: bottomPad + 8,
          backgroundColor: colors.background,
        }]}>
          <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: busy ? colors.primary + "50" : colors.border }]}>
            <TextInput
              style={[s.input, { color: colors.foreground }]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask ZBX AI Agent…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!busy}
              returnKeyType="send"
              onSubmitEditing={() => { send(input); }}
              blurOnSubmit
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: busy || !input.trim() ? colors.muted : "#a855f7" }]}
            onPress={() => send(input)}
            disabled={busy || !input.trim()}
            activeOpacity={0.8}
          >
            {busy
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={17} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    headerTitle: { fontSize: 15, fontWeight: "700" as const },
    headerSub: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    gasWidget: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    gasTotal: { fontSize: 12, fontWeight: "700" as const, fontFamily: "monospace" },
    liveIndicator: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: 10, fontWeight: "600" as const },
    modelLegend: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, gap: 8 },
    legendLabel: { fontSize: 9, fontWeight: "600" as const },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, flex: 1 },
    modelChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    modelDot: { width: 5, height: 5, borderRadius: 2.5 },
    modelChipText: { fontSize: 9, fontWeight: "600" as const, fontFamily: "monospace" },
    moreMods: { fontSize: 9, fontFamily: "monospace", alignSelf: "center" },
    msgRow: { flexDirection: "row", marginBottom: 14, alignItems: "flex-end" },
    msgRowAgent: { justifyContent: "flex-start" },
    msgRowUser: { justifyContent: "flex-end" },
    agentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#d946ef18", borderWidth: 1, borderColor: "#d946ef35", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0, alignSelf: "flex-end" },
    userAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#3b82f618", borderWidth: 1, borderColor: "#3b82f635", alignItems: "center", justifyContent: "center", marginLeft: 8, flexShrink: 0, alignSelf: "flex-end" },
    bubble: { borderRadius: 18, padding: 12 },
    bubbleAgent: { borderWidth: 1, borderBottomLeftRadius: 4 },
    bubbleUser: { backgroundColor: "#7c3aed", borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 13, lineHeight: 19 },
    gasMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    gasText: { fontSize: 9, color: "#f59e0b", fontFamily: "monospace" },
    modelText: { fontSize: 9, fontFamily: "monospace" },
    timestamp: { fontSize: 9, fontFamily: "monospace" },
    quickWrap: { paddingTop: 8, paddingBottom: 4 },
    quickLabel: { fontSize: 10, marginBottom: 8, fontFamily: "monospace" },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    quickChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    quickText: { fontSize: 11 },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
    inputWrap: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
    input: { fontSize: 14, maxHeight: 100, lineHeight: 20 },
    sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  });
}
