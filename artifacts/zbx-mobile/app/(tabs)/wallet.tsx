import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface WalletInfo {
  address: string;
  balance: string;
  staked: string;
  nonce: number;
  txCount: number;
  riskScore: number;
  firstSeen: string;
  lastSeen: string;
  transactions: MiniTx[];
}

interface MiniTx {
  hash: string;
  type: "in" | "out" | "stake";
  amount: string;
  age: string;
  status: "success" | "failed";
}

function randHex(len: number) {
  return "0x" + Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function short(h: string) {
  return h.slice(0, 8) + "…" + h.slice(-6);
}

function makeWallet(address: string): WalletInfo {
  const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
  return {
    address,
    balance: `${(Math.random() * 99_000).toFixed(4)} ZBX`,
    staked: `${(Math.random() * 50_000).toFixed(2)} ZBX`,
    nonce: rnd(1, 9999),
    txCount: rnd(1, 50_000),
    riskScore: rnd(0, 100),
    firstSeen: `Block #${rnd(1, 1_000_000).toLocaleString()}`,
    lastSeen: `${rnd(1, 120)} mins ago`,
    transactions: Array.from({ length: 8 }, () => ({
      hash: randHex(64),
      type: (["in", "out", "stake"] as const)[rnd(0, 2)],
      amount: `${(Math.random() * 9999).toFixed(2)} ZBX`,
      age: `${rnd(1, 59)}m ago`,
      status: Math.random() > 0.05 ? "success" : "failed",
    })),
  };
}

const RECENTS = [
  "0x742d35Cc6634C0532925a3b8D4C9C2B8f2CbF96",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
];

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [query, setQuery] = useState("");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const s = makeStyles(colors);

  const lookup = useCallback(async (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("0x") || trimmed.length < 10) {
      Alert.alert("Invalid address", "Enter a valid 0x… address");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setWallet(null);
    await new Promise(r => setTimeout(r, 700));
    setWallet(makeWallet(trimmed));
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const riskColor = wallet
    ? wallet.riskScore > 70 ? colors.destructive
    : wallet.riskScore > 40 ? colors.warning
    : colors.success
    : colors.success;

  const riskLabel = wallet
    ? wallet.riskScore > 70 ? "HIGH RISK"
    : wallet.riskScore > 40 ? "MEDIUM"
    : "LOW RISK"
    : "";

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[s.pageTitle, { color: colors.foreground }]}>Wallet Lookup</Text>
      <Text style={[s.pageSub, { color: colors.mutedForeground }]}>Search any ZBX address · AI risk scoring via 0xCA</Text>

      {/* Search input */}
      <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
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
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setWallet(null); }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[s.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
        onPress={() => lookup(query)}
        disabled={loading}
      >
        <Text style={s.searchBtnText}>{loading ? "Looking up…" : "Look Up"}</Text>
      </TouchableOpacity>

      {/* Recents */}
      {!wallet && (
        <View style={{ marginTop: 20 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Lookups</Text>
          {RECENTS.map(addr => (
            <TouchableOpacity key={addr} style={[s.recentRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setQuery(addr); lookup(addr); }}>
              <Feather name="user" size={14} color={colors.primary} />
              <Text style={[s.recentAddr, { color: colors.foreground }]}>{short(addr)}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Wallet result */}
      {wallet && (
        <View style={{ marginTop: 20 }}>
          {/* Address + risk */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardTop}>
              <View style={s.addrWrap}>
                <Text style={[s.addrLabel, { color: colors.mutedForeground }]}>Address</Text>
                <Text style={[s.addr, { color: colors.foreground }]}>{short(wallet.address)}</Text>
              </View>
              <View style={[s.riskBadge, { backgroundColor: riskColor + "20", borderColor: riskColor + "40" }]}>
                <Feather name="shield" size={11} color={riskColor} />
                <Text style={[s.riskLabel, { color: riskColor }]}>{riskLabel}</Text>
                <Text style={[s.riskScore, { color: riskColor }]}>{wallet.riskScore}</Text>
              </View>
            </View>

            <View style={s.balanceRow}>
              <View style={s.balanceItem}>
                <Text style={[s.balanceLabel, { color: colors.mutedForeground }]}>Balance</Text>
                <Text style={[s.balanceVal, { color: colors.foreground }]}>{wallet.balance}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.balanceItem}>
                <Text style={[s.balanceLabel, { color: colors.mutedForeground }]}>Staked</Text>
                <Text style={[s.balanceVal, { color: colors.primary }]}>{wallet.staked}</Text>
              </View>
            </View>

            <View style={s.metaRow}>
              {[
                { label: "Nonce", value: wallet.nonce.toString() },
                { label: "Total Txs", value: wallet.txCount.toLocaleString() },
                { label: "First seen", value: wallet.firstSeen },
                { label: "Last active", value: wallet.lastSeen },
              ].map(m => (
                <View key={m.label} style={s.metaItem}>
                  <Text style={[s.metaLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                  <Text style={[s.metaVal, { color: colors.foreground }]}>{m.value}</Text>
                </View>
              ))}
            </View>

            <View style={[s.aiNote, { backgroundColor: "#d946ef10", borderColor: "#d946ef30" }]}>
              <Feather name="cpu" size={12} color="#d946ef" />
              <Text style={[s.aiNoteText, { color: colors.mutedForeground }]}>
                Risk score computed by ZBX-Risk-Score-v1 (M-01) via precompile 0xCA · {(wallet.riskScore * 12_000 / 100).toFixed(0)} gas used
              </Text>
            </View>
          </View>

          {/* Transactions */}
          <Text style={[s.sectionTitle, { color: colors.foreground, marginTop: 16, marginHorizontal: 16 }]}>
            Recent Transactions
          </Text>
          {wallet.transactions.map(tx => (
            <View key={tx.hash} style={[s.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.txDir, {
                backgroundColor: tx.type === "in" ? colors.success + "20" : tx.type === "stake" ? colors.primary + "20" : colors.destructive + "20"
              }]}>
                <Feather
                  name={tx.type === "in" ? "arrow-down-left" : tx.type === "stake" ? "lock" : "arrow-up-right"}
                  size={13}
                  color={tx.type === "in" ? colors.success : tx.type === "stake" ? colors.primary : colors.destructive}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.txHash, { color: colors.primary }]}>{short(tx.hash)}</Text>
                <Text style={[s.txAge, { color: colors.mutedForeground }]}>{tx.age}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.txAmt, { color: colors.foreground }]}>{tx.amount}</Text>
                <View style={[s.txStatus, { backgroundColor: tx.status === "success" ? colors.success + "20" : colors.destructive + "20" }]}>
                  <Text style={[s.txStatusText, { color: tx.status === "success" ? colors.success : colors.destructive }]}>
                    {tx.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    pageTitle: { fontSize: 22, fontWeight: "700" as const, marginHorizontal: 16, marginBottom: 4 },
    pageSub: { fontSize: 12, marginHorizontal: 16, marginBottom: 16 },
    searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: "monospace" },
    searchBtn: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 14, alignItems: "center" },
    searchBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
    sectionTitle: { fontSize: 15, fontWeight: "600" as const, marginBottom: 10 },
    recentRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
    recentAddr: { flex: 1, fontSize: 13, fontFamily: "monospace" },
    card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16 },
    addrWrap: {},
    addrLabel: { fontSize: 11, marginBottom: 2 },
    addr: { fontSize: 14, fontFamily: "monospace", fontWeight: "600" as const },
    riskBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
    riskLabel: { fontSize: 10, fontWeight: "700" as const },
    riskScore: { fontSize: 14, fontWeight: "800" as const },
    balanceRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border },
    balanceItem: { flex: 1, padding: 14 },
    balanceLabel: { fontSize: 11, marginBottom: 4 },
    balanceVal: { fontSize: 16, fontWeight: "700" as const, fontFamily: "monospace" },
    divider: { width: 1 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", padding: 14, gap: 8 },
    metaItem: { width: "47%" as any },
    metaLabel: { fontSize: 10, marginBottom: 2 },
    metaVal: { fontSize: 12, fontFamily: "monospace", fontWeight: "500" as const },
    aiNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, margin: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
    aiNoteText: { flex: 1, fontSize: 10, fontFamily: "monospace", lineHeight: 14 },
    txRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    txDir: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    txHash: { fontSize: 12, fontWeight: "600" as const, fontFamily: "monospace" },
    txAge: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    txAmt: { fontSize: 13, fontWeight: "600" as const },
    txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
    txStatusText: { fontSize: 9, fontWeight: "700" as const },
  });
}
