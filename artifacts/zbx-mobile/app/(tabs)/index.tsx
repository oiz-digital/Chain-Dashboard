import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

interface Block {
  height: number;
  txCount: number;
  gasUsed: number;
  validator: string;
  age: string;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeBlock(height: number): Block {
  return {
    height,
    txCount: randomBetween(0, 240),
    gasUsed: randomBetween(1_200_000, 29_800_000),
    validator: `0x${Math.random().toString(16).slice(2, 10).toUpperCase()}...`,
    age: `${randomBetween(1, 59)}s ago`,
  };
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const [refreshing, setRefreshing] = useState(false);
  const [height, setHeight] = useState(2_887_441);
  const [tps, setTps] = useState(847);
  const [blocks, setBlocks] = useState<Block[]>(() =>
    Array.from({ length: 6 }, (_, i) => makeBlock(2_887_441 - i))
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const interval = setInterval(() => {
      setHeight(h => h + 1);
      setTps(randomBetween(600, 1200));
      setBlocks(prev => [makeBlock(prev[0].height + 1), ...prev.slice(0, 5)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setHeight(h => h + randomBetween(1, 3));
      setTps(randomBetween(600, 1200));
      setRefreshing(false);
    }, 800);
  }, []);

  const STATS: StatCard[] = [
    { label: "Block Height", value: height.toLocaleString(), sub: "~5s per block", icon: "box", color: colors.cyan },
    { label: "TPS", value: tps.toLocaleString(), sub: "max 10,000 TPS", icon: "zap", color: colors.fuchsia },
    { label: "Validators", value: "67", sub: "active set", icon: "users", color: colors.success },
    { label: "ZBX Price", value: "$0.284", sub: "+3.2% 24h", icon: "trending-up", color: colors.warning },
    { label: "Total Staked", value: "42.2M ZBX", sub: "28.1% of supply", icon: "lock", color: colors.primary },
    { label: "TVL", value: "$11.97M", sub: "across all DeFi", icon: "layers", color: colors.cyan },
  ];

  const s = makeStyles(colors, isDark);

  return (
    <ScrollView
      style={[s.container]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.chainName}>ZBX Explorer</Text>
          <Text style={s.chainSub}>Mainnet · Chain ID 8989 · HotStuff-BFT</Text>
        </View>
        <View style={s.liveIndicator}>
          <View style={[s.dot, { backgroundColor: colors.success }]} />
          <Text style={[s.liveText, { color: colors.success }]}>LIVE</Text>
        </View>
      </View>

      {/* AI Precompile Banner */}
      <TouchableOpacity style={s.aiBanner} activeOpacity={0.8}>
        <Feather name="cpu" size={16} color={colors.fuchsia} />
        <View style={{ flex: 1 }}>
          <Text style={[s.aiBannerTitle, { color: colors.fuchsia }]}>ZEP-009 AI Precompile Active</Text>
          <Text style={[s.aiBannerSub, { color: colors.mutedForeground }]}>0xCA AIINFER · 12 on-chain models · Ask AI Agent →</Text>
        </View>
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Stat grid */}
      <View style={s.grid}>
        {STATS.map(stat => (
          <View key={stat.label} style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: stat.color + "20" }]}>
              <Feather name={stat.icon} size={16} color={stat.color} />
            </View>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
            <Text style={s.statSub}>{stat.sub}</Text>
          </View>
        ))}
      </View>

      {/* Recent Blocks */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Recent Blocks</Text>
        {blocks.map(b => (
          <View key={b.height} style={s.blockRow}>
            <View style={s.blockLeft}>
              <Feather name="box" size={14} color={colors.primary} />
              <View style={{ marginLeft: 8 }}>
                <Text style={[s.blockHeight, { color: colors.primary }]}>#{b.height.toLocaleString()}</Text>
                <Text style={s.blockSub}>{b.age}</Text>
              </View>
            </View>
            <View style={s.blockRight}>
              <Text style={s.blockTx}>{b.txCount} txs</Text>
              <Text style={s.blockGas}>{fmtNum(b.gasUsed)} gas</Text>
            </View>
            <View style={[s.blockValidator]}>
              <Text style={s.validatorText}>{b.validator}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ZEP status row */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>ZEP Status</Text>
        <View style={s.zepRow}>
          {[
            { id: "ZEP-009", label: "AI Precompile", color: colors.fuchsia },
            { id: "ZEP-003", label: "DA Blobs", color: colors.cyan },
            { id: "ZEP-042", label: "AI Agent", color: colors.success },
            { id: "ZEP-007", label: "TWAP Oracle", color: colors.warning },
          ].map(z => (
            <View key={z.id} style={[s.zepChip, { borderColor: z.color + "40", backgroundColor: z.color + "15" }]}>
              <Text style={[s.zepId, { color: z.color }]}>{z.id}</Text>
              <Text style={[s.zepLabel, { color: colors.mutedForeground }]}>{z.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
    chainName: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground },
    chainSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 2, fontFamily: "monospace" },
    liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.success + "15", borderWidth: 1, borderColor: colors.success + "30" },
    dot: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: 11, fontWeight: "700" as const },
    aiBanner: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.fuchsia + "12", borderWidth: 1, borderColor: colors.fuchsia + "30" },
    aiBannerTitle: { fontSize: 13, fontWeight: "600" as const },
    aiBannerSub: { fontSize: 11, marginTop: 1 },
    grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
    statCard: { width: "47%", backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginHorizontal: 2 },
    statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    statValue: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, fontFamily: "monospace" },
    statLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    statSub: { fontSize: 10, color: colors.mutedForeground, marginTop: 1 },
    section: { marginHorizontal: 16, marginTop: 16 },
    sectionTitle: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, marginBottom: 10 },
    blockRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    blockLeft: { flexDirection: "row", alignItems: "center", width: 130 },
    blockHeight: { fontSize: 13, fontWeight: "600" as const, fontFamily: "monospace" },
    blockSub: { fontSize: 10, color: colors.mutedForeground, fontFamily: "monospace" },
    blockRight: { flex: 1, alignItems: "flex-end", marginRight: 8 },
    blockTx: { fontSize: 12, color: colors.foreground, fontWeight: "500" as const },
    blockGas: { fontSize: 10, color: colors.mutedForeground, fontFamily: "monospace" },
    blockValidator: { width: 90 },
    validatorText: { fontSize: 10, color: colors.mutedForeground, fontFamily: "monospace", textAlign: "right" },
    zepRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    zepChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    zepId: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    zepLabel: { fontSize: 10, marginTop: 1 },
  });
}
