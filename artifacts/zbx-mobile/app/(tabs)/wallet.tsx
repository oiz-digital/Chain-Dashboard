import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Platform, Alert, Clipboard, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface MiniTx {
  hash: string;
  type: "in" | "out" | "stake" | "reward";
  amount: string;
  age: string;
  status: "success" | "failed";
}

interface WalletInfo {
  address: string;
  balance: string;
  balanceUsd: string;
  staked: string;
  stakedUsd: string;
  nonce: number;
  txCount: number;
  riskScore: number;
  riskFlags: string[];
  firstSeen: string;
  lastSeen: string;
  transactions: MiniTx[];
}

function randHex(len: number) {
  return "0x" + Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function short(h: string) {
  return h.slice(0, 10) + "…" + h.slice(-8);
}
function rnd(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

const FLAG_POOL = [
  "Mixer interaction detected",
  "High-velocity transfers",
  "Failed flash loan attempt",
  "Bridge usage detected",
  "New wallet (<7 days)",
  "Whale wallet (>100K ZBX)",
  "Staking rewards received",
  "DEX interaction heavy",
];

function makeWallet(address: string): WalletInfo {
  const zbxBal = Math.random() * 99_000;
  const zbxStaked = Math.random() * 50_000;
  const risk = rnd(0, 100);
  const flags = FLAG_POOL.slice(0, risk > 70 ? 4 : risk > 40 ? 2 : 1).filter(() => Math.random() > 0.3);
  return {
    address,
    balance: `${zbxBal.toFixed(4)} ZBX`,
    balanceUsd: `$${(zbxBal * 0.284).toFixed(2)}`,
    staked: `${zbxStaked.toFixed(2)} ZBX`,
    stakedUsd: `$${(zbxStaked * 0.284).toFixed(2)}`,
    nonce: rnd(1, 9999),
    txCount: rnd(1, 50_000),
    riskScore: risk,
    riskFlags: flags.length > 0 ? flags : ["No significant flags"],
    firstSeen: `Block #${rnd(1, 1_000_000).toLocaleString()}`,
    lastSeen: `${rnd(1, 120)} min ago`,
    transactions: Array.from({ length: 10 }, () => ({
      hash: randHex(64),
      type: (["in", "out", "stake", "reward"] as const)[rnd(0, 3)],
      amount: `${(Math.random() * 9999).toFixed(2)} ZBX`,
      age: `${rnd(1, 59)}m ago`,
      status: Math.random() > 0.05 ? "success" as const : "failed" as const,
    })),
  };
}

// Arc-based risk gauge
function RiskGauge({ score, color }: { score: number; color: string }) {
  // Simple text-based gauge with arc representation using bars
  const segments = 20;
  const filled = Math.round((score / 100) * segments);

  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      {/* Score display */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 36, fontWeight: "800", color, fontFamily: "monospace" }}>{score}</Text>
        <Text style={{ fontSize: 10, color, fontWeight: "700", letterSpacing: 1 }}>RISK SCORE</Text>
      </View>
      {/* Bar gauge */}
      <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
        {Array.from({ length: segments }, (_, i) => {
          const active = i < filled;
          const segColor = i < 8 ? "#22c55e" : i < 14 ? "#f59e0b" : "#ef4444";
          return (
            <View key={i} style={{
              width: 8,
              height: 14,
              borderRadius: 2,
              backgroundColor: active ? segColor : segColor + "22",
            }} />
          );
        })}
      </View>
      {/* Labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
        <Text style={{ fontSize: 9, color: "#22c55e", fontFamily: "monospace" }}>LOW</Text>
        <Text style={{ fontSize: 9, color: "#f59e0b", fontFamily: "monospace" }}>MED</Text>
        <Text style={{ fontSize: 9, color: "#ef4444", fontFamily: "monospace" }}>HIGH</Text>
      </View>
    </View>
  );
}

const RECENTS = [
  "0x742d35Cc6634C0532925a3b8D4C9C2B8f2CbF96",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
];

const TX_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  in: "arrow-down-left",
  out: "arrow-up-right",
  stake: "lock",
  reward: "award",
};

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [query, setQuery] = useState("");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const s = makeStyles(colors);

  const riskColor =
    wallet && wallet.riskScore > 70 ? colors.destructive
    : wallet && wallet.riskScore > 40 ? colors.warning
    : colors.success;

  const riskLabel =
    wallet && wallet.riskScore > 70 ? "HIGH RISK"
    : wallet && wallet.riskScore > 40 ? "MEDIUM RISK"
    : "LOW RISK";

  const lookup = useCallback(async (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("0x") || trimmed.length < 10) {
      Alert.alert("Invalid address", "Please enter a valid 0x… Ethereum-style address");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setWallet(null);
    await new Promise(r => setTimeout(r, 800));
    setWallet(makeWallet(trimmed));
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const copyAddress = useCallback(() => {
    if (wallet) {
      Clipboard.setString(wallet.address);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [wallet]);

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.pageTitle, { color: colors.foreground }]}>Wallet Lookup</Text>
      <Text style={[s.pageSub, { color: colors.mutedForeground }]}>
        ZBX address explorer · AI risk analysis via 0xCA
      </Text>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="0x… address"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => lookup(query)}
          editable={!loading}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setWallet(null); }}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[s.lookupBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
        onPress={() => lookup(query)}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Feather name={loading ? "loader" : "search"} size={16} color="#fff" />
        <Text style={s.lookupBtnText}>{loading ? "Analyzing on-chain…" : "Look Up Address"}</Text>
      </TouchableOpacity>

      {/* Recent lookups */}
      {!wallet && !loading && (
        <View style={{ marginTop: 20 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Lookups</Text>
          {RECENTS.map(addr => (
            <TouchableOpacity
              key={addr}
              style={[s.recentRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setQuery(addr); lookup(addr); }}
              activeOpacity={0.75}
            >
              <View style={[s.recentIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="user" size={13} color={colors.primary} />
              </View>
              <Text style={[s.recentAddr, { color: colors.foreground }]}>{short(addr)}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Wallet result */}
      {wallet && (
        <View style={{ marginTop: 16, gap: 12 }}>
          {/* Address card */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.addrRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.addrLabel, { color: colors.mutedForeground }]}>Address</Text>
                <Text style={[s.addr, { color: colors.foreground }]}>{short(wallet.address)}</Text>
              </View>
              <TouchableOpacity
                style={[s.copyBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={copyAddress}
              >
                <Feather name="copy" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance cards */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.balCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.balIcon, { backgroundColor: colors.cyan + "20" }]}>
                <Feather name="credit-card" size={14} color={colors.cyan} />
              </View>
              <Text style={[s.balLabel, { color: colors.mutedForeground }]}>Balance</Text>
              <Text style={[s.balAmount, { color: colors.foreground }]}>{wallet.balance}</Text>
              <Text style={[s.balUsd, { color: colors.mutedForeground }]}>{wallet.balanceUsd}</Text>
            </View>
            <View style={[s.balCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.balIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="lock" size={14} color={colors.primary} />
              </View>
              <Text style={[s.balLabel, { color: colors.mutedForeground }]}>Staked</Text>
              <Text style={[s.balAmount, { color: colors.primary }]}>{wallet.staked}</Text>
              <Text style={[s.balUsd, { color: colors.mutedForeground }]}>{wallet.stakedUsd}</Text>
            </View>
          </View>

          {/* Risk gauge */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: riskColor + "30" }]}>
            <View style={[s.riskHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>AI Risk Analysis</Text>
              <View style={[s.riskLabelBadge, { backgroundColor: riskColor + "18", borderColor: riskColor + "30" }]}>
                <Text style={[s.riskLabelText, { color: riskColor }]}>{riskLabel}</Text>
              </View>
            </View>
            <View style={{ padding: 16 }}>
              <RiskGauge score={wallet.riskScore} color={riskColor} />
            </View>
            {/* Flags */}
            <View style={[s.flagsWrap, { borderTopColor: colors.border }]}>
              <Text style={[s.flagsTitle, { color: colors.mutedForeground }]}>Detected flags:</Text>
              {wallet.riskFlags.map((flag, i) => (
                <View key={i} style={s.flagRow}>
                  <Feather
                    name={flag === "No significant flags" ? "check-circle" : "alert-triangle"}
                    size={12}
                    color={flag === "No significant flags" ? colors.success : wallet.riskScore > 70 ? colors.destructive : colors.warning}
                  />
                  <Text style={[s.flagText, { color: colors.foreground }]}>{flag}</Text>
                </View>
              ))}
              <View style={[s.aiNote, { backgroundColor: "#d946ef08", borderColor: "#d946ef25" }]}>
                <Feather name="cpu" size={11} color="#d946ef" />
                <Text style={[s.aiNoteText, { color: colors.mutedForeground }]}>
                  ZBX-Risk-Score-v1 (M-01) via 0xCA · {Math.round(wallet.riskScore * 12_000 / 100).toLocaleString()} gas
                </Text>
              </View>
            </View>
          </View>

          {/* Meta grid */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.cardHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Account Details</Text>
            </View>
            <View style={s.metaGrid}>
              {[
                { label: "Nonce", value: wallet.nonce.toString(), icon: "hash" as const },
                { label: "Total Txs", value: wallet.txCount.toLocaleString(), icon: "repeat" as const },
                { label: "First Seen", value: wallet.firstSeen, icon: "clock" as const },
                { label: "Last Active", value: wallet.lastSeen, icon: "activity" as const },
              ].map(m => (
                <View key={m.label} style={s.metaItem}>
                  <Feather name={m.icon} size={12} color={colors.mutedForeground} />
                  <Text style={[s.metaLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                  <Text style={[s.metaVal, { color: colors.foreground }]}>{m.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Transactions */}
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
          {wallet.transactions.map(tx => {
            const isIn = tx.type === "in" || tx.type === "reward";
            const typeColor = isIn ? colors.success : tx.type === "stake" ? colors.primary : colors.destructive;
            return (
              <View key={tx.hash} style={[s.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.txDirIcon, { backgroundColor: typeColor + "18" }]}>
                  <Feather name={TX_ICON[tx.type]} size={13} color={typeColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.txHash, { color: colors.primary }]}>{tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}</Text>
                  <Text style={[s.txAge, { color: colors.mutedForeground }]}>{tx.type} · {tx.age}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.txAmt, { color: isIn ? colors.success : colors.foreground }]}>
                    {isIn ? "+" : "-"}{tx.amount}
                  </Text>
                  <View style={[s.txStatus, {
                    backgroundColor: tx.status === "success" ? colors.success + "18" : colors.destructive + "18",
                  }]}>
                    <Text style={[s.txStatusText, { color: tx.status === "success" ? colors.success : colors.destructive }]}>
                      {tx.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    pageTitle: { fontSize: 22, fontWeight: "800" as const, marginHorizontal: 16, letterSpacing: -0.5 },
    pageSub: { fontSize: 11, marginHorizontal: 16, marginTop: 3, marginBottom: 14 },
    searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
    searchInput: { flex: 1, fontSize: 13, fontFamily: "monospace" },
    lookupBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 14 },
    lookupBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
    sectionTitle: { fontSize: 15, fontWeight: "700" as const, marginBottom: 10 },
    recentRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
    recentIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    recentAddr: { flex: 1, fontSize: 12, fontFamily: "monospace" },
    card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginHorizontal: 16 },
    addrRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
    addrLabel: { fontSize: 10, marginBottom: 2 },
    addr: { fontSize: 13, fontFamily: "monospace", fontWeight: "600" as const },
    copyBtn: { padding: 8, borderRadius: 9, borderWidth: 1 },
    balCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, marginLeft: 16 },
    balIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    balLabel: { fontSize: 10, marginBottom: 3 },
    balAmount: { fontSize: 15, fontWeight: "700" as const, fontFamily: "monospace" },
    balUsd: { fontSize: 11, marginTop: 2 },
    riskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    cardTitle: { fontSize: 13, fontWeight: "700" as const },
    riskLabelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    riskLabelText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    flagsWrap: { borderTopWidth: 1, padding: 14, gap: 6 },
    flagsTitle: { fontSize: 10, marginBottom: 4 },
    flagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    flagText: { fontSize: 12, flex: 1 },
    aiNote: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 6 },
    aiNoteText: { flex: 1, fontSize: 10, fontFamily: "monospace" },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    metaGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
    metaItem: { width: "47%", gap: 3, padding: 8, borderRadius: 10, backgroundColor: "transparent" },
    metaLabel: { fontSize: 10, marginTop: 2 },
    metaVal: { fontSize: 12, fontFamily: "monospace", fontWeight: "600" as const },
    txRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    txDirIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    txHash: { fontSize: 12, fontWeight: "600" as const, fontFamily: "monospace" },
    txAge: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    txAmt: { fontSize: 13, fontWeight: "700" as const },
    txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 3 },
    txStatusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "monospace" },
  });
}
