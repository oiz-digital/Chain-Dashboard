import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, useColorScheme,
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
  txHash?: string;
  ts: number;
  status?: "pending" | "done" | "failed";
}

const MODELS: Record<string, { name: string; gas: number; color: string }> = {
  router:    { name: "ZBX-AgentRouter",   gas: 20_000, color: "#d946ef" },
  risk:      { name: "ZBX-Risk-Score",    gas: 12_000, color: "#f59e0b" },
  sentiment: { name: "ZBX-Sentiment",     gas: 8_000,  color: "#06b6d4" },
  fraud:     { name: "ZBX-FraudDetect",   gas: 9_500,  color: "#ef4444" },
  price:     { name: "ZBX-PricePredict",  gas: 15_000, color: "#22c55e" },
  anomaly:   { name: "ZBX-AnomalyDetect", gas: 10_000, color: "#8b5cf6" },
};

const RESPONSES: Record<string, { text: string; modelKey: string }> = {
  staking: {
    modelKey: "router",
    text: "Staking stats:\n• APR: 8.4% (30-day avg)\n• Staked: 42.18M ZBX (28.1%)\n• Validators: 67 active\n• Min stake: 100 ZBX\n\nRisk: LOW — no anomalous staking activity detected.",
  },
  risk: {
    modelKey: "risk",
    text: "Risk Score Analysis:\n• Score: 71/100 → HIGH RISK\n• Flags: mixer interactions, high-velocity tx, failed flash loans\n• Action: BLOCK lending deposits\n• Confidence: 94.2%",
  },
  fraud: {
    modelKey: "fraud",
    text: "Fraud Detection:\n• Rug Pull Probability: 89.3% — VERY HIGH\n• Flags: admin can mint, liquidity unlocked, 94% held by 2 wallets\n🚨 AVOID — Confidence: 96.1%",
  },
  price: {
    modelKey: "price",
    text: "Price Prediction:\n• Signal: BULLISH (72.3%)\n• Horizon: 4–8 blocks (~40s)\n• Features: 64-dim on-chain feed\n⚠️ Not financial advice.",
  },
  anomaly: {
    modelKey: "anomaly",
    text: "Anomaly Report (last 10K blocks):\n⚠️ 1 MEDIUM anomaly:\n• Block 2,887,441: 847 SLOAD in single tx (99.8th %)\n✓ No flash loan attacks\n✓ No reentrancy detected",
  },
  governance: {
    modelKey: "sentiment",
    text: "ZEP-043 Status:\n• \"Increase gas limit 30M→45M\"\n• For: 68.4% · Against: 31.6%\n• Quorum: ✓ Met\n• Sentiment: 82% positive (ZBX-Sentiment-v2)",
  },
  default: {
    modelKey: "router",
    text: "I am ZBX AI Agent, running on-chain via precompile 0xCA.\n\nEvery response is:\n• Verified by all 67 validators\n• Committed to the blockchain\n• Gas-metered per model\n\nTry: staking APR, risk score, fraud detection, price signal.",
  },
};

function matchResponse(input: string) {
  const l = input.toLowerCase();
  if (l.includes("stake") || l.includes("apr")) return RESPONSES.staking;
  if (l.includes("risk") || l.includes("address")) return RESPONSES.risk;
  if (l.includes("fraud") || l.includes("rug") || l.includes("token")) return RESPONSES.fraud;
  if (l.includes("price") || l.includes("predict")) return RESPONSES.price;
  if (l.includes("anomal") || l.includes("detect")) return RESPONSES.anomaly;
  if (l.includes("govern") || l.includes("proposal") || l.includes("vote")) return RESPONSES.governance;
  return RESPONSES.default;
}

function fakeHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

const QUICK = [
  "Staking APR?",
  "Risk score 0xDEAD…",
  "Fraud check token",
  "Price prediction",
  "Anomaly report",
  "Governance status",
];

export default function AIAgentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const listRef = useRef<FlatList<Message>>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [totalGas, setTotalGas] = useState(20_000);
  const [msgs, setMsgs] = useState<Message[]>([{
    id: "welcome",
    role: "agent",
    text: "Namaste! I am ZBX AI Agent 🤖\n\nRunning on-chain via ZEP-009 AIINFER precompile 0xCA.\nEvery response is validator-verified and gas-metered.\n\nAsk me about staking, risk, fraud, governance, or price signals.",
    gas: 20_000,
    model: "ZBX-AgentRouter",
    txHash: fakeHash(),
    ts: Date.now(),
    status: "done",
  }]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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

    const delay = 700 + Math.random() * 1100;
    await new Promise(r => setTimeout(r, delay));

    const resp = matchResponse(trimmed);
    const model = MODELS[resp.modelKey];
    setMsgs(prev => prev.map(m =>
      m.id === pid
        ? { ...m, text: resp.text, gas: model.gas, model: model.name, txHash: fakeHash(), status: "done" }
        : m
    ));
    setTotalGas(g => g + model.gas);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [busy]);

  const s = makeStyles(colors);

  const renderMsg = useCallback(({ item }: { item: Message }) => {
    const isAgent = item.role === "agent";
    const model = item.model ? MODELS[Object.keys(MODELS).find(k => MODELS[k].name === item.model) || "router"] : null;

    return (
      <View style={[s.msgRow, isAgent ? s.msgRowAgent : s.msgRowUser]}>
        {isAgent && (
          <View style={s.agentAvatar}>
            <Feather name="cpu" size={14} color="#d946ef" />
          </View>
        )}
        <View style={[s.bubble, isAgent ? s.bubbleAgent : s.bubbleUser]}>
          {item.status === "pending" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[s.bubbleText, { color: isAgent ? colors.foreground : "#fff" }]}>
              {item.text}
            </Text>
          )}
          {isAgent && item.status === "done" && item.gas && (
            <View style={s.gasMeta}>
              <Feather name="zap" size={10} color="#f59e0b" />
              <Text style={s.gasText}>{item.gas.toLocaleString()} gas</Text>
              {item.model && (
                <Text style={[s.modelText, { color: model?.color || colors.primary }]}>· {item.model}</Text>
              )}
            </View>
          )}
        </View>
        {!isAgent && (
          <View style={s.userAvatar}>
            <Feather name="user" size={14} color="#60a5fa" />
          </View>
        )}
      </View>
    );
  }, [colors]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 8 }]}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Feather name="cpu" size={18} color="#d946ef" />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>ZBX AI Agent</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>0xCA AIINFER · ZEP-009</Text>
          </View>
        </View>
        <View style={s.gasWidget}>
          <Feather name="zap" size={12} color="#f59e0b" />
          <Text style={[s.gasTotal, { color: "#f59e0b" }]}>{totalGas.toLocaleString()}</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={m => m.id}
          renderItem={renderMsg}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            msgs.length <= 1 ? (
              <View style={s.quickWrap}>
                <Text style={[s.quickLabel, { color: colors.mutedForeground }]}>Try asking:</Text>
                <View style={s.quickRow}>
                  {QUICK.map(q => (
                    <TouchableOpacity key={q} style={[s.quickChip, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => send(q)}>
                      <Text style={[s.quickText, { color: colors.foreground }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View style={[s.inputBar, { borderTopColor: colors.border, paddingBottom: bottomPad + 8, backgroundColor: colors.background }]}>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything on-chain…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: busy || !input.trim() ? colors.muted : "#a855f7" }]}
            onPress={() => send(input)}
            disabled={busy || !input.trim()}
          >
            {busy
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={18} color="#fff" />
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
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#d946ef20", borderWidth: 1, borderColor: "#d946ef40", alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 15, fontWeight: "700" as const },
    headerSub: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    gasWidget: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b30" },
    gasTotal: { fontSize: 12, fontWeight: "600" as const, fontFamily: "monospace" },
    msgRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end" },
    msgRowAgent: { justifyContent: "flex-start" },
    msgRowUser: { justifyContent: "flex-end" },
    agentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#d946ef20", borderWidth: 1, borderColor: "#d946ef40", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
    userAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#3b82f620", borderWidth: 1, borderColor: "#3b82f640", alignItems: "center", justifyContent: "center", marginLeft: 8, flexShrink: 0 },
    bubble: { maxWidth: "78%" as any, borderRadius: 18, padding: 12 },
    bubbleAgent: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    bubbleUser: { backgroundColor: "#7c3aed", borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    gasMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    gasText: { fontSize: 10, color: "#f59e0b", fontFamily: "monospace" },
    modelText: { fontSize: 10, fontFamily: "monospace" },
    quickWrap: { marginTop: 12 },
    quickLabel: { fontSize: 11, marginBottom: 8 },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    quickText: { fontSize: 12 },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
    input: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 120, lineHeight: 20 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  });
}
