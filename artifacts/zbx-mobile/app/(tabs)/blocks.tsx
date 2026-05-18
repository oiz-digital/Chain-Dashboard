import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface Tx {
  hash: string;
  from: string;
  to: string;
  amount: string;
  type: "transfer" | "stake" | "delegate" | "contract" | "reward";
  status: "success" | "failed";
  gasUsed: number;
}

interface Block {
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
function short(hash: string, start = 8, end = 6) {
  return hash.slice(0, start) + "…" + hash.slice(-end);
}
function fmtGas(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${(n / 1_000).toFixed(0)}K`;
}
function fmtSize(n: number) {
  return `${(n / 1000).toFixed(1)} KB`;
}

const TX_TYPES = ["transfer", "stake", "delegate", "contract", "reward"] as const;

function makeBlock(height: number): Block {
  const txCount = rnd(0, 240);
  return {
    height,
    hash: randHex(64),
    timestamp: new Date(Date.now() - rnd(0, 300_000)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    txCount,
    gasUsed: rnd(1_200_000, 29_800_000),
    gasLimit: 30_000_000,
    validator: randHex(40),
    size: rnd(1200, 98_000),
    reward: `${(3 + Math.random() * 0.5).toFixed(4)} ZBX`,
    transactions: Array.from({ length: Math.min(txCount, 8) }, () => ({
      hash: randHex(64),
      from: randHex(40),
      to: randHex(40),
      amount: `${(Math.random() * 9999).toFixed(2)} ZBX`,
      type: TX_TYPES[rnd(0, TX_TYPES.length - 1)],
      status: Math.random() > 0.05 ? "success" : "failed",
      gasUsed: rnd(21_000, 800_000),
    })),
  };
}

const TX_COLORS: Record<string, string> = {
  transfer: "#06b6d4",
  stake: "#a855f7",
  delegate: "#8b5cf6",
  contract: "#f59e0b",
  reward: "#22c55e",
};

const INITIAL_BLOCKS = Array.from({ length: 30 }, (_, i) => makeBlock(2_887_441 - i));

export default function BlocksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selected, setSelected] = useState<Block | null>(null);
  const [blocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const s = makeStyles(colors);

  const filtered = useMemo(() => {
    if (!search.trim()) return blocks;
    const q = search.trim().toLowerCase().replace(/^#/, "");
    return blocks.filter(b => b.height.toString().includes(q) || b.hash.toLowerCase().includes(q));
  }, [blocks, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const openBlock = useCallback((b: Block) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(b);
  }, []);

  if (selected) {
    const gasPercent = Math.round((selected.gasUsed / selected.gasLimit) * 100);
    const gasColor = gasPercent > 80 ? colors.destructive : gasPercent > 50 ? colors.warning : colors.success;

    return (
      <ScrollView style={s.root} contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: 100 }}>
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => setSelected(null)}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={[s.backText, { color: colors.primary }]}>All Blocks</Text>
        </TouchableOpacity>

        {/* Block header */}
        <View style={[s.detailHero, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
          <View style={[s.detailIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="box" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[s.detailBlockNum, { color: colors.foreground }]}>Block #{selected.height.toLocaleString()}</Text>
            <Text style={[s.detailHash, { color: colors.mutedForeground }]}>{short(selected.hash, 10, 8)}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {[
            { label: "Timestamp",     value: selected.timestamp },
            { label: "Transactions",  value: `${selected.txCount} txs` },
            { label: "Block Reward",  value: selected.reward },
            { label: "Block Size",    value: fmtSize(selected.size) },
            { label: "Validator",     value: short(selected.validator, 10, 6) },
            { label: "Gas Limit",     value: fmtGas(selected.gasLimit) },
          ].map(row => (
            <View key={row.label} style={[s.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[s.detailVal, { color: colors.foreground }]}>{row.value}</Text>
            </View>
          ))}

          {/* Gas used with bar */}
          <View style={[s.detailRow, { borderBottomWidth: 0, flexDirection: "column", alignItems: "stretch" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={[s.detailLabel, { color: colors.mutedForeground }]}>Gas Used</Text>
              <Text style={[s.detailVal, { color: gasColor }]}>{fmtGas(selected.gasUsed)} ({gasPercent}%)</Text>
            </View>
            <View style={[s.gasBarTrack, { backgroundColor: colors.border }]}>
              <View style={[s.gasBarFill, { width: `${gasPercent}%` as any, backgroundColor: gasColor }]} />
            </View>
          </View>
        </View>

        {/* Transactions */}
        {selected.transactions.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <View style={[s.sectionHeaderRow, { marginHorizontal: 16, marginBottom: 10 }]}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Transactions</Text>
              <View style={[s.badge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
                <Text style={[s.badgeText, { color: colors.primary }]}>{selected.txCount}</Text>
              </View>
            </View>
            {selected.transactions.map(tx => {
              const txColor = TX_COLORS[tx.type] || colors.primary;
              return (
                <View key={tx.hash} style={[s.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.txTypeBadge, { backgroundColor: txColor + "18" }]}>
                    <Text style={[s.txTypeText, { color: txColor }]}>{tx.type}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.txHash, { color: colors.primary }]}>{short(tx.hash)}</Text>
                    <Text style={[s.txAddrs, { color: colors.mutedForeground }]}>
                      {short(tx.from, 8, 4)} → {short(tx.to, 8, 4)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.txAmt, { color: colors.foreground }]}>{tx.amount}</Text>
                    <View style={[s.txStatus, {
                      backgroundColor: tx.status === "success" ? colors.success + "18" : colors.destructive + "18",
                    }]}>
                      <Text style={[s.txStatusText, { color: tx.status === "success" ? colors.success : colors.destructive }]}>
                        {tx.status === "success" ? "✓" : "✗"} {tx.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {selected.txCount > 8 && (
              <Text style={[s.moreTxs, { color: colors.mutedForeground }]}>
                + {selected.txCount - 8} more transactions
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[s.root, { flex: 1 }]}>
      {/* Header + Search */}
      <View style={[s.headerWrap, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <View style={s.sectionHeaderRow}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>Latest Blocks</Text>
          <Text style={[s.blockCount, { color: colors.mutedForeground }]}>{blocks.length} blocks</Text>
        </View>
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Block height or hash…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={b => b.height.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Feather name="search" size={28} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No blocks found</Text>
          </View>
        }
        renderItem={({ item: b, index }) => {
          const gasPercent = Math.round((b.gasUsed / b.gasLimit) * 100);
          const gasColor = gasPercent > 80 ? colors.destructive : gasPercent > 50 ? colors.warning : colors.success;
          return (
            <TouchableOpacity
              style={[s.blockCard, { backgroundColor: colors.card, borderColor: index === 0 ? colors.primary + "40" : colors.border }]}
              onPress={() => openBlock(b)}
              activeOpacity={0.75}
            >
              <View style={[s.blockIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="box" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[s.blockHeight, { color: colors.foreground }]}>#{b.height.toLocaleString()}</Text>
                  {index === 0 && (
                    <View style={[s.newBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "35" }]}>
                      <Text style={[s.newBadgeText, { color: colors.success }]}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.blockTime, { color: colors.mutedForeground }]}>{b.timestamp}</Text>
                <View style={[s.gasTrack, { backgroundColor: colors.border, marginTop: 5 }]}>
                  <View style={[s.gasFill, { width: `${gasPercent}%` as any, backgroundColor: gasColor }]} />
                </View>
              </View>
              <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                <Text style={[s.txCount, { color: colors.foreground }]}>{b.txCount} txs</Text>
                <Text style={[s.gasLabel, { color: gasColor }]}>{fmtGas(b.gasUsed)}</Text>
                <Text style={[s.gasPercent, { color: colors.mutedForeground }]}>{gasPercent}%</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerWrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
    pageTitle: { fontSize: 20, fontWeight: "800" as const },
    blockCount: { fontSize: 12 },
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
    searchInput: { flex: 1, fontSize: 13, fontFamily: "monospace" },
    blockCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
    blockIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    blockHeight: { fontSize: 14, fontWeight: "700" as const, fontFamily: "monospace" },
    blockTime: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    gasTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
    gasFill: { height: "100%" as any, borderRadius: 2 },
    txCount: { fontSize: 13, fontWeight: "700" as const },
    gasLabel: { fontSize: 11, fontFamily: "monospace", fontWeight: "600" as const, marginTop: 1 },
    gasPercent: { fontSize: 10, fontFamily: "monospace" },
    newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
    newBadgeText: { fontSize: 8, fontWeight: "800" as const, letterSpacing: 0.5 },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 13 },
    // Detail view
    backBtn: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 16, gap: 6 },
    backText: { fontSize: 14, fontWeight: "600" as const },
    detailHero: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
    detailIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    detailBlockNum: { fontSize: 20, fontWeight: "800" as const, fontFamily: "monospace" },
    detailHash: { fontSize: 11, fontFamily: "monospace", marginTop: 2 },
    card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
    detailLabel: { fontSize: 12 },
    detailVal: { fontSize: 12, fontFamily: "monospace", fontWeight: "600" as const, maxWidth: "55%" as any, textAlign: "right" },
    gasBarTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
    gasBarFill: { height: "100%" as any, borderRadius: 3 },
    sectionTitle: { fontSize: 15, fontWeight: "700" as const },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    badgeText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    txRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 6, padding: 11, borderRadius: 12, borderWidth: 1 },
    txTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, flexShrink: 0 },
    txTypeText: { fontSize: 9, fontWeight: "700" as const, textTransform: "uppercase" as const, fontFamily: "monospace" },
    txHash: { fontSize: 12, fontWeight: "600" as const, fontFamily: "monospace" },
    txAddrs: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    txAmt: { fontSize: 12, fontWeight: "700" as const },
    txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 3 },
    txStatusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "monospace" },
    moreTxs: { textAlign: "center", fontSize: 12, marginTop: 8, marginBottom: 4 },
  });
}
