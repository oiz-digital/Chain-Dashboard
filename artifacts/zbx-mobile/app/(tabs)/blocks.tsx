import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Tx {
  hash: string;
  from: string;
  to: string;
  amount: string;
  type: string;
  status: "success" | "failed";
}

interface BlockDetail {
  height: number;
  hash: string;
  timestamp: string;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  validator: string;
  size: number;
  reward: string;
  transactions: Tx[];
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randHex(len: number) {
  return "0x" + Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function randAddr() {
  return randHex(40);
}

function makeBlock(height: number): BlockDetail {
  const txCount = rnd(0, 240);
  const txTypes = ["transfer", "stake", "delegate", "contract", "reward"];
  const txs: Tx[] = Array.from({ length: Math.min(txCount, 8) }, () => ({
    hash: randHex(64),
    from: randAddr(),
    to: randAddr(),
    amount: `${(Math.random() * 9999).toFixed(2)} ZBX`,
    type: txTypes[rnd(0, txTypes.length - 1)],
    status: Math.random() > 0.05 ? "success" : "failed",
  }));
  return {
    height,
    hash: randHex(64),
    timestamp: new Date(Date.now() - rnd(0, 300_000)).toLocaleTimeString(),
    txCount,
    gasUsed: rnd(1_200_000, 29_800_000),
    gasLimit: 30_000_000,
    validator: randAddr(),
    size: rnd(1200, 98_000),
    reward: `${(3 + Math.random() * 0.5).toFixed(4)} ZBX`,
    transactions: txs,
  };
}

function short(hash: string) {
  return hash.slice(0, 8) + "..." + hash.slice(-6);
}

function fmtGas(n: number) {
  return (n / 1_000_000).toFixed(2) + "M";
}

function fmtSize(n: number) {
  return (n / 1000).toFixed(1) + " KB";
}

const TX_COLORS: Record<string, string> = {
  transfer: "#06b6d4",
  stake: "#a855f7",
  delegate: "#8b5cf6",
  contract: "#f59e0b",
  reward: "#22c55e",
};

export default function BlocksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selected, setSelected] = useState<BlockDetail | null>(null);
  const [blocks] = useState<BlockDetail[]>(() =>
    Array.from({ length: 20 }, (_, i) => makeBlock(2_887_441 - i))
  );
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const s = makeStyles(colors);

  if (selected) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => setSelected(null)}>
          <Feather name="chevron-left" size={18} color={colors.primary} />
          <Text style={[s.backText, { color: colors.primary }]}>Blocks</Text>
        </TouchableOpacity>

        <View style={[s.detailCard, { marginTop: 8 }]}>
          <Text style={s.detailTitle}>Block #{selected.height.toLocaleString()}</Text>
          <Text style={[s.detailHash, { color: colors.mutedForeground }]}>{short(selected.hash)}</Text>

          {[
            { label: "Timestamp", value: selected.timestamp },
            { label: "Transactions", value: selected.txCount.toString() },
            { label: "Gas Used", value: `${fmtGas(selected.gasUsed)} (${((selected.gasUsed / selected.gasLimit) * 100).toFixed(1)}%)` },
            { label: "Gas Limit", value: fmtGas(selected.gasLimit) },
            { label: "Block Size", value: fmtSize(selected.size) },
            { label: "Validator", value: short(selected.validator) },
            { label: "Block Reward", value: selected.reward },
          ].map(row => (
            <View key={row.label} style={s.detailRow}>
              <Text style={[s.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[s.detailValue, { color: colors.foreground }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {selected.transactions.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[s.sectionTitle, { marginHorizontal: 16 }]}>Transactions ({selected.txCount})</Text>
            {selected.transactions.map(tx => (
              <View key={tx.hash} style={s.txRow}>
                <View style={[s.txTypeBadge, { backgroundColor: (TX_COLORS[tx.type] || colors.primary) + "20" }]}>
                  <Text style={[s.txTypeText, { color: TX_COLORS[tx.type] || colors.primary }]}>{tx.type}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.txHash, { color: colors.primary }]}>{short(tx.hash)}</Text>
                  <Text style={[s.txAddrs, { color: colors.mutedForeground }]}>
                    {short(tx.from)} → {short(tx.to)}
                  </Text>
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

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[s.pageTitle, { marginHorizontal: 16, marginBottom: 12 }]}>Latest Blocks</Text>
      {blocks.map(b => (
        <TouchableOpacity key={b.height} style={s.blockCard} onPress={() => setSelected(b)} activeOpacity={0.75}>
          <View style={s.blockLeft}>
            <View style={[s.blockIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="box" size={16} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[s.blockHeight, { color: colors.foreground }]}>#{b.height.toLocaleString()}</Text>
              <Text style={[s.blockTime, { color: colors.mutedForeground }]}>{b.timestamp}</Text>
            </View>
          </View>
          <View style={s.blockRight}>
            <Text style={[s.blockTx, { color: colors.foreground }]}>{b.txCount} txs</Text>
            <Text style={[s.blockGas, { color: colors.mutedForeground }]}>{fmtGas(b.gasUsed)} gas</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    pageTitle: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground },
    backBtn: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, gap: 4 },
    backText: { fontSize: 15, fontWeight: "500" as const },
    blockCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    blockLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    blockIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    blockHeight: { fontSize: 14, fontWeight: "600" as const, fontFamily: "monospace" },
    blockTime: { fontSize: 11, marginTop: 1, fontFamily: "monospace" },
    blockRight: { alignItems: "flex-end", marginRight: 10 },
    blockTx: { fontSize: 13, fontWeight: "600" as const },
    blockGas: { fontSize: 10, marginTop: 1, fontFamily: "monospace" },
    detailCard: { marginHorizontal: 16, padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    detailTitle: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, marginBottom: 2 },
    detailHash: { fontSize: 11, fontFamily: "monospace", marginBottom: 14 },
    detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailLabel: { fontSize: 12 },
    detailValue: { fontSize: 12, fontFamily: "monospace", fontWeight: "500" as const, maxWidth: "55%" as any, textAlign: "right" },
    sectionTitle: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, marginBottom: 10 },
    txRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    txTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    txTypeText: { fontSize: 10, fontWeight: "700" as const, textTransform: "uppercase" as const, fontFamily: "monospace" },
    txHash: { fontSize: 12, fontWeight: "600" as const, fontFamily: "monospace" },
    txAddrs: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    txAmt: { fontSize: 12, fontWeight: "600" as const },
    txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
    txStatusText: { fontSize: 9, fontWeight: "700" as const },
  });
}
