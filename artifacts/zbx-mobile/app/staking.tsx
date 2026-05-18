import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useWallet } from "@/contexts/WalletContext";

interface Validator {
  name: string;
  address: string;
  commission: number;
  uptime: number;
  totalStaked: string;
  rank: number;
  status: "active" | "jailed" | "inactive";
}

const VALIDATORS: Validator[] = [
  { name: "ZBX Foundation Node",  address: "0xF0U1...A3B2", commission: 5,  uptime: 99.99, totalStaked: "8.4M ZBX",  rank: 1, status: "active" },
  { name: "Zebvix Staking Co",    address: "0xA8B2...C41D", commission: 7,  uptime: 99.97, totalStaked: "6.1M ZBX",  rank: 2, status: "active" },
  { name: "ChainGuard Pro",       address: "0x3F9A...7E22", commission: 8,  uptime: 99.95, totalStaked: "5.7M ZBX",  rank: 3, status: "active" },
  { name: "Orbital Validators",   address: "0x1C4D...9FB0", commission: 10, uptime: 99.90, totalStaked: "4.2M ZBX",  rank: 4, status: "active" },
  { name: "Quantum Stake",        address: "0x7E82...B3C1", commission: 8,  uptime: 99.88, totalStaked: "3.8M ZBX",  rank: 5, status: "active" },
  { name: "DeepNode Alpha",       address: "0x2B1F...44DA", commission: 12, uptime: 99.81, totalStaked: "2.9M ZBX",  rank: 6, status: "active" },
  { name: "SkyStake Network",     address: "0x9D4C...E720", commission: 15, uptime: 98.42, totalStaked: "1.1M ZBX",  rank: 7, status: "jailed" },
];

function UptimeBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ flex: 1, height: 4, backgroundColor: color + "25", borderRadius: 2, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

export default function StakingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { selectedChain, addTransaction } = useWallet();
  const zbxToken = selectedChain.tokens.find(t => t.symbol === "ZBX") ?? selectedChain.tokens[0];

  const [tab, setTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState<Validator>(VALIDATORS[0]);
  const [loading, setLoading] = useState(false);
  const s = makeStyles(colors);

  const myStaked = 1200;
  const pendingRewards = 8.44;
  const APR = 8.4;
  const estimatedAnnual = parseFloat(amount || "0") * (APR / 100);

  const handleAction = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    await addTransaction({
      type: tab,
      tokenSymbol: "ZBX",
      amount: amt,
      to: selectedValidator.address,
      from: "self",
      chainId: 8989,
      status: "success",
      gasUsed: 65_000,
    });
    setLoading(false);
    Alert.alert(
      tab === "stake" ? "Staked Successfully ✓" : "Unstake Initiated ✓",
      tab === "stake"
        ? `${amt} ZBX delegated to ${selectedValidator.name}.\n\nEarning ${APR}% APR. Rewards accrue per block.`
        : `${amt} ZBX unbonding started.\n\nFunds available after 21-day unbonding period.`,
      [{ text: "OK", onPress: () => { setAmount(""); router.back(); } }]
    );
  }, [amount, tab, selectedValidator, addTransaction, router]);

  return (
    <ScrollView style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>ZBX Staking</Text>
        <View style={[s.aprBadge, { backgroundColor: colors.success + "18", borderColor: colors.success + "35" }]}>
          <Text style={[s.aprText, { color: colors.success }]}>{APR}% APR</Text>
        </View>
      </View>

      {/* Stats banner */}
      <LinearGradient colors={["#14532d", "#166534", "#15803d"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.statsBanner}>
        <View style={s.statsGrid}>
          {[
            { label: "My Staked",      val: `${myStaked.toLocaleString()} ZBX`,   icon: "lock" as const },
            { label: "Pending Rewards",val: `${pendingRewards.toFixed(2)} ZBX`,   icon: "gift" as const },
            { label: "APR",            val: `${APR}%`,                            icon: "trending-up" as const },
            { label: "Unbonding",      val: "21 days",                             icon: "clock" as const },
          ].map(s2 => (
            <View key={s2.label} style={s.statBox}>
              <Feather name={s2.icon} size={16} color="#86efac" />
              <Text style={s.statVal}>{s2.val}</Text>
              <Text style={s.statLabel}>{s2.label}</Text>
            </View>
          ))}
        </View>
        {pendingRewards > 0 && (
          <TouchableOpacity
            style={s.claimBtn}
            onPress={() => Alert.alert("Claim Rewards", `Claim ${pendingRewards.toFixed(2)} ZBX rewards?\nGas: ~0.002 ZBX`)}
            activeOpacity={0.85}>
            <Feather name="download" size={15} color="#166534" />
            <Text style={s.claimText}>Claim {pendingRewards.toFixed(2)} ZBX</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Stake/Unstake tabs */}
      <View style={[s.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["stake", "unstake"] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && { backgroundColor: colors.primary }]}
            onPress={() => { setTab(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
            <Text style={[s.tabText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount input */}
      <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Amount to {tab}</Text>
      <View style={[s.amountBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[s.amountInput, { color: colors.foreground }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
        <Text style={[s.amountSym, { color: colors.primary }]}>ZBX</Text>
        <TouchableOpacity
          style={[s.maxBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}
          onPress={() => setAmount(tab === "stake" ? zbxToken.balance.toString() : myStaked.toString())}>
          <Text style={[s.maxText, { color: colors.primary }]}>MAX</Text>
        </TouchableOpacity>
      </View>
      <View style={s.amountMeta}>
        <Text style={[s.metaTxt, { color: colors.mutedForeground }]}>
          Available: {tab === "stake" ? `${zbxToken.balance.toFixed(2)} ZBX` : `${myStaked} ZBX staked`}
        </Text>
        {parseFloat(amount) > 0 && (
          <Text style={[s.metaTxt, { color: colors.success }]}>
            ~${(parseFloat(amount) * 0.284).toFixed(2)} USD
          </Text>
        )}
      </View>

      {/* Estimated rewards */}
      {tab === "stake" && parseFloat(amount) > 0 && (
        <View style={[s.rewardPreview, { backgroundColor: colors.success + "10", borderColor: colors.success + "25" }]}>
          <Feather name="trending-up" size={14} color={colors.success} />
          <View>
            <Text style={[s.rewardTitle, { color: colors.success }]}>Estimated Rewards</Text>
            <Text style={[s.rewardSub, { color: colors.mutedForeground }]}>
              ~{estimatedAnnual.toFixed(2)} ZBX/yr · {(estimatedAnnual / 365).toFixed(4)} ZBX/day
            </Text>
          </View>
        </View>
      )}

      {/* Validator picker */}
      {tab === "stake" && (
        <>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Select Validator</Text>
          {VALIDATORS.map(v => {
            const active = v.name === selectedValidator.name;
            const statusColor = v.status === "active" ? colors.success : v.status === "jailed" ? colors.destructive : colors.warning;
            return (
              <TouchableOpacity
                key={v.name}
                style={[s.validatorRow, {
                  backgroundColor: active ? colors.primary + "10" : colors.card,
                  borderColor: active ? colors.primary + "40" : colors.border,
                }]}
                onPress={() => { setSelectedValidator(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.75}>
                <View style={[s.rankBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[s.rankText, { color: colors.primary }]}>#{v.rank}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[s.valName, { color: colors.foreground }]}>{v.name}</Text>
                    <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                  </View>
                  <Text style={[s.valAddr, { color: colors.mutedForeground }]}>{v.address}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <UptimeBar pct={v.uptime} color={v.uptime > 99.9 ? colors.success : colors.warning} />
                    <Text style={[s.uptimeTxt, { color: colors.mutedForeground }]}>{v.uptime}%</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                  <Text style={[s.commission, { color: v.commission <= 8 ? colors.success : colors.warning }]}>
                    {v.commission}% fee
                  </Text>
                  <Text style={[s.valStaked, { color: colors.mutedForeground }]}>{v.totalStaked}</Text>
                </View>
                {active && <Feather name="check-circle" size={16} color={colors.primary} style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Action button */}
      <TouchableOpacity
        style={[s.actionBtn, { opacity: parseFloat(amount) > 0 && !loading ? 1 : 0.5 }]}
        onPress={handleAction}
        disabled={!parseFloat(amount) || loading}
        activeOpacity={0.85}>
        <LinearGradient
          colors={tab === "stake" ? ["#14532d", "#22c55e"] : ["#7f1d1d", "#ef4444"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.actionGrad}>
          <Feather name={tab === "stake" ? "lock" : "unlock"} size={18} color="#fff" />
          <Text style={s.actionText}>
            {loading ? "Processing…" : tab === "stake" ? `Stake ${amount || "0"} ZBX` : `Unstake ${amount || "0"} ZBX`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Info */}
      <View style={[s.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.infoTitle, { color: colors.foreground }]}>Staking Info</Text>
        {[
          { label: "Consensus",      val: "HotStuff-BFT" },
          { label: "Min Stake",      val: "100 ZBX" },
          { label: "Unbonding",      val: "21 days" },
          { label: "Reward Period",  val: "Every block (~5s)" },
          { label: "Slashing",       val: "Equivocation: -5%" },
          { label: "Validators",     val: "67 active / 100 max" },
        ].map(row => (
          <View key={row.label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
            <Text style={[s.infoVal, { color: colors.foreground }]}>{row.val}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 16 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 20, fontWeight: "800" as const },
    aprBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    aprText: { fontSize: 13, fontWeight: "700" as const, fontFamily: "monospace" },
    statsBanner: { marginHorizontal: 16, borderRadius: 20, padding: 18, marginBottom: 16 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
    statBox: { width: "45%", flexGrow: 1, gap: 4 },
    statVal: { fontSize: 16, fontWeight: "800" as const, color: "#fff", fontFamily: "monospace" },
    statLabel: { fontSize: 10, color: "#86efac" },
    claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#4ade80", borderRadius: 12, paddingVertical: 10 },
    claimText: { fontSize: 14, fontWeight: "700" as const, color: "#166534" },
    tabs: { flexDirection: "row", marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 16 },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
    tabText: { fontSize: 14, fontWeight: "700" as const },
    sectionLabel: { fontSize: 12, fontWeight: "600" as const, marginHorizontal: 16, marginBottom: 8 },
    amountBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8, marginBottom: 6 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: "700" as const, fontFamily: "monospace" },
    amountSym: { fontSize: 16, fontWeight: "700" as const, fontFamily: "monospace" },
    maxBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    maxText: { fontSize: 11, fontWeight: "800" as const, fontFamily: "monospace" },
    amountMeta: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 12 },
    metaTxt: { fontSize: 11, fontFamily: "monospace" },
    rewardPreview: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
    rewardTitle: { fontSize: 12, fontWeight: "700" as const },
    rewardSub: { fontSize: 11, marginTop: 2 },
    validatorRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
    rankBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    rankText: { fontSize: 11, fontWeight: "800" as const, fontFamily: "monospace" },
    valName: { fontSize: 13, fontWeight: "700" as const },
    valAddr: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    uptimeTxt: { fontSize: 9, fontFamily: "monospace", width: 38 },
    commission: { fontSize: 12, fontWeight: "700" as const, fontFamily: "monospace" },
    valStaked: { fontSize: 10, fontFamily: "monospace", marginTop: 2 },
    actionBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, overflow: "hidden" as const },
    actionGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
    actionText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
    infoBox: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" as const },
    infoTitle: { fontSize: 13, fontWeight: "700" as const, paddingHorizontal: 16, paddingVertical: 12 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
    infoLabel: { fontSize: 12 },
    infoVal: { fontSize: 12, fontFamily: "monospace", fontWeight: "600" as const },
  });
}
