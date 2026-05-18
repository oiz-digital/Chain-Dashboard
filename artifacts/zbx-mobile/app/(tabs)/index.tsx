import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, Animated, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useRouter } from "expo-router";

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface Block {
  height: number;
  txCount: number;
  gasUsed: number;
  validator: string;
  age: number;
}

function makeBlock(height: number): Block {
  return {
    height,
    txCount: rnd(0, 240),
    gasUsed: rnd(1_200_000, 29_800_000),
    validator: `0x${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    age: rnd(1, 12),
  };
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Tiny inline sparkline using SVG-like View bars
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const H = 24;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: H, gap: 1.5 }}>
      {data.map((v, i) => {
        const h = Math.max(3, ((v - min) / range) * H);
        const opacity = 0.4 + (i / data.length) * 0.6;
        return (
          <View key={i} style={{
            width: 3,
            height: h,
            borderRadius: 1.5,
            backgroundColor: color,
            opacity,
          }} />
        );
      })}
    </View>
  );
}

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  sparkData: number[];
  trend?: "up" | "down" | "flat";
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [refreshing, setRefreshing] = useState(false);
  const [height, setHeight] = useState(2_887_441);
  const [tps, setTps] = useState(847);
  const [blocks, setBlocks] = useState<Block[]>(() =>
    Array.from({ length: 6 }, (_, i) => makeBlock(2_887_441 - i))
  );
  const [tpsHistory, setTpsHistory] = useState(() => Array.from({ length: 12 }, () => rnd(400, 1200)));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTps = rnd(600, 1200);
      setHeight(h => h + 1);
      setTps(newTps);
      setTpsHistory(h => [...h.slice(1), newTps]);
      setBlocks(prev => [makeBlock(prev[0].height + 1), ...prev.slice(0, 5)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setHeight(h => h + rnd(1, 3));
      setTps(rnd(600, 1200));
      setRefreshing(false);
    }, 800);
  }, []);

  const STATS: StatCard[] = [
    {
      label: "Block Height",
      value: height.toLocaleString(),
      sub: "~5s per block",
      icon: "box",
      color: colors.cyan,
      sparkData: Array.from({ length: 12 }, (_, i) => 2_887_441 - (11 - i)),
      trend: "up",
    },
    {
      label: "TPS",
      value: tps.toLocaleString(),
      sub: "max 10,000",
      icon: "zap",
      color: colors.fuchsia,
      sparkData: tpsHistory,
      trend: tps > 800 ? "up" : "down",
    },
    {
      label: "Validators",
      value: "67",
      sub: "67 / 100 active",
      icon: "users",
      color: colors.success,
      sparkData: [65, 66, 66, 67, 67, 67, 66, 67, 67, 67, 67, 67],
      trend: "flat",
    },
    {
      label: "ZBX Price",
      value: "$0.284",
      sub: "+3.2% 24h",
      icon: "trending-up",
      color: colors.warning,
      sparkData: [0.24, 0.25, 0.26, 0.25, 0.27, 0.26, 0.28, 0.27, 0.29, 0.28, 0.284, 0.284].map(v => v * 100),
      trend: "up",
    },
    {
      label: "Total Staked",
      value: "42.2M ZBX",
      sub: "28.1% supply",
      icon: "lock",
      color: colors.primary,
      sparkData: Array.from({ length: 12 }, () => rnd(40, 45)),
      trend: "up",
    },
    {
      label: "DeFi TVL",
      value: "$11.97M",
      sub: "across protocols",
      icon: "layers",
      color: colors.cyan,
      sparkData: Array.from({ length: 12 }, () => rnd(900, 1300)),
      trend: "up",
    },
  ];

  const TREND_ICON: Record<string, keyof typeof Feather.glyphMap> = {
    up: "arrow-up-right",
    down: "arrow-down-right",
    flat: "minus",
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.foreground }]}>ZBX Explorer</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Mainnet · Chain 8989 · HotStuff-BFT
          </Text>
        </View>
        <View style={[s.liveBadge, { backgroundColor: colors.success + "18", borderColor: colors.success + "35" }]}>
          <Animated.View style={[s.liveDot, { backgroundColor: colors.success, transform: [{ scale: pulseAnim }] }]} />
          <Text style={[s.liveText, { color: colors.success }]}>LIVE</Text>
        </View>
      </View>

      {/* AI Banner */}
      <TouchableOpacity
        style={[s.aiBanner, { backgroundColor: colors.fuchsia + "12", borderColor: colors.fuchsia + "30" }]}
        onPress={() => router.push("/(tabs)/ai-agent")}
        activeOpacity={0.75}
      >
        <View style={[s.aiIconWrap, { backgroundColor: colors.fuchsia + "20", borderColor: colors.fuchsia + "30" }]}>
          <Feather name="cpu" size={14} color={colors.fuchsia} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.aiBannerTitle, { color: colors.fuchsia }]}>ZEP-009 AI Precompile Active</Text>
          <Text style={[s.aiBannerSub, { color: colors.mutedForeground }]}>
            0xCA AIINFER · 12 on-chain models · Tap to ask AI Agent
          </Text>
        </View>
        <Feather name="chevron-right" size={14} color={colors.fuchsia} style={{ opacity: 0.6 }} />
      </TouchableOpacity>

      {/* Stats grid */}
      <View style={s.grid}>
        {STATS.map(stat => (
          <View key={stat.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.statTop}>
              <View style={[s.statIcon, { backgroundColor: stat.color + "1A" }]}>
                <Feather name={stat.icon} size={14} color={stat.color} />
              </View>
              <View style={[s.trendBadge, {
                backgroundColor: stat.trend === "up" ? colors.success + "15" : stat.trend === "down" ? colors.destructive + "15" : colors.muted + "40",
              }]}>
                <Feather
                  name={TREND_ICON[stat.trend || "flat"]}
                  size={10}
                  color={stat.trend === "up" ? colors.success : stat.trend === "down" ? colors.destructive : colors.mutedForeground}
                />
              </View>
            </View>
            <Text style={[s.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            <Text style={[s.statSub, { color: colors.mutedForeground }]}>{stat.sub}</Text>
            <View style={{ marginTop: 8 }}>
              <Sparkline data={stat.sparkData} color={stat.color} />
            </View>
          </View>
        ))}
      </View>

      {/* Recent Blocks */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Blocks</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/blocks")}>
            <Text style={[s.seeAll, { color: colors.primary }]}>View all →</Text>
          </TouchableOpacity>
        </View>
        {blocks.map((b, i) => (
          <TouchableOpacity
            key={b.height}
            style={[s.blockRow, { borderColor: colors.border, backgroundColor: i === 0 ? colors.primary + "08" : "transparent" }]}
            onPress={() => router.push("/(tabs)/blocks")}
            activeOpacity={0.7}
          >
            <View style={[s.blockNumWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="box" size={12} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.blockHeight, { color: colors.primary }]}>
                #{b.height.toLocaleString()}
              </Text>
              <Text style={[s.blockSub, { color: colors.mutedForeground }]}>
                {b.age}s ago · {b.validator.slice(0, 10)}…
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.blockTx, { color: colors.foreground }]}>{b.txCount} txs</Text>
              <View style={[s.gasBar, { backgroundColor: colors.border }]}>
                <View style={[s.gasBarFill, {
                  backgroundColor: b.gasUsed > 24_000_000 ? colors.destructive : b.gasUsed > 15_000_000 ? colors.warning : colors.success,
                  width: `${(b.gasUsed / 30_000_000) * 100}%` as any,
                }]} />
              </View>
              <Text style={[s.blockGas, { color: colors.mutedForeground }]}>{fmtNum(b.gasUsed)} gas</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ZEP Status */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>ZEP Status</Text>
        <View style={s.zepGrid}>
          {[
            { id: "ZEP-009", label: "AI Precompile", status: "LIVE",   color: colors.fuchsia },
            { id: "ZEP-003", label: "DA Blobs",      status: "LIVE",   color: colors.cyan },
            { id: "ZEP-042", label: "AI Agent",      status: "LIVE",   color: colors.success },
            { id: "ZEP-007", label: "TWAP Oracle",   status: "LIVE",   color: colors.warning },
            { id: "ZEP-031", label: "VoiceID Auth",  status: "WIP",    color: colors.primary },
            { id: "ZEP-022", label: "zkEVM Client",  status: "PLAN",   color: colors.mutedForeground },
          ].map(z => (
            <View key={z.id} style={[s.zepChip, { borderColor: z.color + "35", backgroundColor: z.color + "12" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={[s.zepDot, { backgroundColor: z.status === "LIVE" ? z.color : colors.mutedForeground }]} />
                <Text style={[s.zepId, { color: z.color }]}>{z.id}</Text>
              </View>
              <Text style={[s.zepLabel, { color: colors.mutedForeground }]}>{z.label}</Text>
              <Text style={[s.zepStatus, {
                color: z.status === "LIVE" ? colors.success : z.status === "WIP" ? colors.warning : colors.mutedForeground,
              }]}>{z.status}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
    title: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.5 },
    subtitle: { fontSize: 11, marginTop: 2, fontFamily: "monospace" },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.5 },
    aiBanner: { marginHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
    aiIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    aiBannerTitle: { fontSize: 12, fontWeight: "600" as const },
    aiBannerSub: { fontSize: 10, marginTop: 1.5 },
    grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 4 },
    statCard: { width: "47%", borderRadius: 16, padding: 14, borderWidth: 1 },
    statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    trendBadge: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    statValue: { fontSize: 19, fontWeight: "800" as const, fontFamily: "monospace", letterSpacing: -0.5 },
    statLabel: { fontSize: 11, marginTop: 2, fontWeight: "500" as const },
    statSub: { fontSize: 10, marginTop: 1 },
    section: { marginHorizontal: 16, marginTop: 18 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: "700" as const },
    seeAll: { fontSize: 12, fontWeight: "600" as const },
    blockRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderRadius: 8, marginBottom: 2 },
    blockNumWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    blockHeight: { fontSize: 13, fontWeight: "700" as const, fontFamily: "monospace" },
    blockSub: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    blockTx: { fontSize: 12, fontWeight: "600" as const },
    gasBar: { width: 50, height: 3, borderRadius: 2, marginTop: 3, overflow: "hidden" },
    gasBarFill: { height: "100%" as any, borderRadius: 2 },
    blockGas: { fontSize: 9, fontFamily: "monospace", marginTop: 2 },
    zepGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 16 },
    zepChip: { width: "30%", flexGrow: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 3 },
    zepDot: { width: 5, height: 5, borderRadius: 2.5 },
    zepId: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    zepLabel: { fontSize: 9, marginTop: 1 },
    zepStatus: { fontSize: 9, fontWeight: "700" as const, fontFamily: "monospace" },
  });
}
