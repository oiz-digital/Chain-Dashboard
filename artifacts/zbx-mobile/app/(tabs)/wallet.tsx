import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Modal, TextInput, Clipboard, Animated,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useWallet, CHAINS, type Token } from "@/contexts/WalletContext";

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(2)}`;
}

function fmtBal(n: number, dec = 4) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return n.toFixed(Math.min(dec, 6));
}

function short(addr: string) {
  return addr.slice(0, 8) + "…" + addr.slice(-6);
}

// ─── Setup Screen ───────────────────────────────────────────────────────────
function SetupScreen() {
  const colors = useColors();
  const { createWallet, importWallet, watchAddress } = useWallet();
  const [mode, setMode] = useState<"none" | "create_show" | "import" | "watch">("none");
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [watchAddr, setWatchAddr] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const s = setupStyles(colors);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    const m = await createWallet();
    setMnemonic(m);
    setMode("create_show");
    setLoading(false);
  }, [createWallet]);

  const handleImport = useCallback(async () => {
    if (!mnemonicInput.trim()) return;
    setLoading(true);
    await importWallet(mnemonicInput.trim());
    setLoading(false);
  }, [importWallet, mnemonicInput]);

  const handleWatch = useCallback(async () => {
    if (!watchAddr.trim().startsWith("0x")) {
      Alert.alert("Invalid address", "Please enter a valid 0x… address");
      return;
    }
    setLoading(true);
    await watchAddress(watchAddr.trim());
    setLoading(false);
  }, [watchAddress, watchAddr]);

  if (mode === "create_show") {
    const words = mnemonic.split(" ");
    return (
      <ScrollView style={[s.root, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}>
        <View style={s.backRow}>
          <TouchableOpacity onPress={() => setMode("none")} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.backTitle, { color: colors.foreground }]}>Secret Recovery Phrase</Text>
        </View>
        <View style={[s.alertBox, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b35" }]}>
          <Feather name="alert-triangle" size={16} color="#f59e0b" />
          <Text style={s.alertText}>
            Write these 12 words down and store them safely. Never share with anyone. This is the ONLY way to recover your wallet.
          </Text>
        </View>
        <View style={s.mnemonicGrid}>
          {words.map((w, i) => (
            <View key={i} style={[s.wordChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.wordNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
              <Text style={[s.wordText, { color: colors.foreground }]}>{w}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[s.checkRow, { borderColor: confirmed ? colors.success + "60" : colors.border }]}
          onPress={() => { setConfirmed(c => !c); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}>
          <View style={[s.checkbox, {
            backgroundColor: confirmed ? colors.success : "transparent",
            borderColor: confirmed ? colors.success : colors.border,
          }]}>
            {confirmed && <Feather name="check" size={12} color="#fff" />}
          </View>
          <Text style={[s.checkText, { color: colors.foreground }]}>
            I have safely written down my recovery phrase
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: confirmed ? colors.primary : colors.muted, opacity: loading ? 0.7 : 1 }]}
          onPress={() => confirmed && !loading ? undefined : undefined}
          disabled={!confirmed || loading}
          activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>Wallet Created ✓</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === "import") {
    return (
      <ScrollView style={[s.root, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}>
        <View style={s.backRow}>
          <TouchableOpacity onPress={() => setMode("none")} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.backTitle, { color: colors.foreground }]}>Import Wallet</Text>
        </View>
        <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>
          Enter your 12 or 24-word recovery phrase, or private key
        </Text>
        <TextInput
          style={[s.mnemonicInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={mnemonicInput}
          onChangeText={setMnemonicInput}
          placeholder="Enter phrase or private key…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: mnemonicInput.trim() ? colors.primary : colors.muted, marginTop: 16 }]}
          onPress={handleImport}
          disabled={!mnemonicInput.trim() || loading}
          activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>{loading ? "Importing…" : "Import Wallet"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === "watch") {
    return (
      <ScrollView style={[s.root, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 100 }}>
        <View style={s.backRow}>
          <TouchableOpacity onPress={() => setMode("none")} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.backTitle, { color: colors.foreground }]}>Watch Address</Text>
        </View>
        <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>
          Monitor any address in read-only mode. No private key needed.
        </Text>
        <TextInput
          style={[s.mnemonicInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, height: 56 }]}
          value={watchAddr}
          onChangeText={setWatchAddr}
          placeholder="0x…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: watchAddr.trim() ? colors.primary : colors.muted, marginTop: 16 }]}
          onPress={handleWatch}
          disabled={!watchAddr.trim() || loading}
          activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>{loading ? "Loading…" : "Watch Address"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Main setup
  return (
    <ScrollView style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 32, paddingBottom: 100, alignItems: "center" }}>
      {/* Logo */}
      <LinearGradient colors={["#7c3aed", "#a855f7", "#d946ef"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.logoWrap}>
        <Feather name="cpu" size={36} color="#fff" />
      </LinearGradient>
      <Text style={[s.setupTitle, { color: colors.foreground }]}>ZBX Multi-Chain Wallet</Text>
      <Text style={[s.setupSub, { color: colors.mutedForeground }]}>
        Manage assets across 6 blockchain networks{"\n"}with on-chain AI powered by ZEP-009
      </Text>

      {/* Chain chips */}
      <View style={s.chainChips}>
        {CHAINS.map(c => (
          <View key={c.id} style={[s.chainChip, { backgroundColor: c.color + "18", borderColor: c.color + "35" }]}>
            <Text style={[s.chainChipText, { color: c.color }]}>{c.shortName}</Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <View style={s.btnStack}>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary, width: "100%" }]}
          onPress={handleCreate} activeOpacity={0.85}>
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={s.primaryBtnText}>{loading ? "Generating…" : "Create New Wallet"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.outlineBtn, { borderColor: colors.primary, width: "100%" }]}
          onPress={() => setMode("import")} activeOpacity={0.85}>
          <Feather name="download" size={18} color={colors.primary} />
          <Text style={[s.outlineBtnText, { color: colors.primary }]}>Import Existing Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ghostBtn, { width: "100%" }]}
          onPress={() => setMode("watch")} activeOpacity={0.85}>
          <Feather name="eye" size={18} color={colors.mutedForeground} />
          <Text style={[s.ghostBtnText, { color: colors.mutedForeground }]}>Watch Address (Read-only)</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.terms, { color: colors.mutedForeground }]}>
        By continuing you agree to ZBX Wallet Terms of Service.{"\n"}Keys stored locally · Never shared · Open source.
      </Text>
    </ScrollView>
  );
}

// ─── Portfolio Screen ────────────────────────────────────────────────────────
function PortfolioScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const {
    address, selectedChain, selectedChainId, setSelectedChainId,
    chains, totalPortfolioUsd, change24hUsd, change24hPct,
    chainPortfolioUsd, resetWallet, transactions,
  } = useWallet();

  const [showSettings, setShowSettings] = useState(false);
  const s = portfolioStyles(colors);
  const isPositive = change24hPct >= 0;

  const chainTotals = chains.map(c => ({
    chain: c,
    usd: chainPortfolioUsd(c.id),
  }));

  const copyAddr = useCallback(() => {
    if (address) {
      Clipboard.setString(address);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [address]);

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={[s.addrChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={copyAddr} activeOpacity={0.7}>
          <View style={[s.addrDot, { backgroundColor: colors.success }]} />
          <Text style={[s.addrText, { color: colors.foreground }]}>{address ? short(address) : "—"}</Text>
          <Feather name="copy" size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/receive")}>
            <Feather name="qr-code" size={16} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowSettings(true)}>
            <Feather name="settings" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Total balance card */}
      <LinearGradient
        colors={["#4c1d95", "#7c3aed", "#a855f7"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.balanceCard}>
        <Text style={s.balLabel}>Total Portfolio</Text>
        <Text style={s.balAmount}>{fmtUsd(totalPortfolioUsd)}</Text>
        <View style={s.balChangeRow}>
          <Feather
            name={isPositive ? "trending-up" : "trending-down"}
            size={14}
            color={isPositive ? "#4ade80" : "#f87171"}
          />
          <Text style={[s.balChange, { color: isPositive ? "#4ade80" : "#f87171" }]}>
            {isPositive ? "+" : ""}{fmtUsd(change24hUsd)} ({isPositive ? "+" : ""}{change24hPct.toFixed(2)}%) today
          </Text>
        </View>
        <View style={s.aiNote}>
          <Feather name="cpu" size={10} color="#e9d5ff" />
          <Text style={s.aiNoteText}>AI Risk: LOW · 0xCA AIINFER · ZEP-009</Text>
        </View>
      </LinearGradient>

      {/* Quick actions */}
      <View style={s.actions}>
        {[
          { label: "Send",    icon: "arrow-up-right" as const,  color: colors.primary,     route: "/send" },
          { label: "Receive", icon: "arrow-down-left" as const, color: colors.cyan,        route: "/receive" },
          { label: "Swap",    icon: "repeat" as const,          color: colors.warning,     route: null },
          { label: "Stake",   icon: "lock" as const,            color: colors.success,     route: "/staking" },
        ].map(a => (
          <TouchableOpacity
            key={a.label}
            style={[s.actionBtn, { backgroundColor: (a.color as string) + "18", borderColor: (a.color as string) + "30" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (a.route) router.push(a.route as any);
              else Alert.alert("Coming Soon", "Swap aggregator launching Q3 2026");
            }}
            activeOpacity={0.75}>
            <View style={[s.actionIcon, { backgroundColor: (a.color as string) + "25" }]}>
              <Feather name={a.icon} size={18} color={a.color as string} />
            </View>
            <Text style={[s.actionLabel, { color: a.color as string }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Network selector */}
      <Text style={[s.sectionTitle, { color: colors.foreground }]}>Networks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.netScroll}>
        {chains.map(c => {
          const active = c.id === selectedChainId;
          const usd = chainPortfolioUsd(c.id);
          return (
            <TouchableOpacity
              key={c.id}
              style={[s.netChip, {
                backgroundColor: active ? c.color + "20" : colors.card,
                borderColor: active ? c.color + "60" : colors.border,
              }]}
              onPress={() => { setSelectedChainId(c.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.75}>
              <Feather name={c.icon as any} size={14} color={active ? c.color : colors.mutedForeground} />
              <View>
                <Text style={[s.netName, { color: active ? c.color : colors.foreground }]}>{c.shortName}</Text>
                <Text style={[s.netUsd, { color: colors.mutedForeground }]}>{fmtUsd(usd)}</Text>
              </View>
              {c.testnet && (
                <View style={[s.testBadge, { backgroundColor: "#f59e0b20" }]}>
                  <Text style={s.testText}>TEST</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Token list */}
      <View style={s.tokHeader}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>{selectedChain.name} Tokens</Text>
        <View style={[s.chainBadge, { backgroundColor: selectedChain.color + "18", borderColor: selectedChain.color + "35" }]}>
          <Feather name={selectedChain.icon as any} size={11} color={selectedChain.color} />
          <Text style={[s.chainBadgeText, { color: selectedChain.color }]}>ID {selectedChain.id}</Text>
        </View>
      </View>
      {selectedChain.tokens.map(tok => {
        const usd = tok.balance * tok.priceUsd;
        const pos = tok.change24h >= 0;
        return (
          <TouchableOpacity
            key={tok.symbol}
            style={[s.tokRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/send", params: { token: tok.symbol } } as any)}
            activeOpacity={0.75}>
            <View style={[s.tokIcon, { backgroundColor: tok.color + "20" }]}>
              <Text style={[s.tokIconText, { color: tok.color }]}>{tok.symbol.slice(0, 2)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.tokSymbol, { color: colors.foreground }]}>{tok.symbol}</Text>
              <Text style={[s.tokName, { color: colors.mutedForeground }]}>{tok.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.tokBalance, { color: colors.foreground }]}>{fmtBal(tok.balance)}</Text>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Text style={[s.tokUsd, { color: colors.mutedForeground }]}>{tok.priceUsd > 0 ? fmtUsd(usd) : "Testnet"}</Text>
                {tok.priceUsd > 0 && (
                  <Text style={[s.tokChange, { color: pos ? colors.success : colors.destructive }]}>
                    {pos ? "+" : ""}{tok.change24h.toFixed(2)}%
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* ZBX Staking banner (mainnet only) */}
      {selectedChainId === 8989 && (
        <TouchableOpacity
          style={[s.stakingBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}
          onPress={() => router.push("/staking")}
          activeOpacity={0.8}>
          <LinearGradient colors={["#6d28d9", "#a855f7"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.stakingIcon}>
            <Feather name="lock" size={18} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[s.stakingTitle, { color: colors.foreground }]}>ZBX Staking</Text>
            <Text style={[s.stakingSub, { color: colors.mutedForeground }]}>8.4% APR · 21-day unbonding · 67 validators</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
          {transactions.slice(0, 5).map(tx => {
            const isIn = tx.type === "receive" || tx.type === "unstake";
            const typeColor = isIn ? colors.success : tx.type === "stake" ? colors.primary : colors.destructive;
            return (
              <View key={tx.hash} style={[s.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.txIcon, { backgroundColor: typeColor + "18" }]}>
                  <Feather name={isIn ? "arrow-down-left" : tx.type === "stake" ? "lock" : "arrow-up-right"} size={14} color={typeColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.txType, { color: colors.foreground }]}>{tx.type}</Text>
                  <Text style={[s.txHash, { color: colors.mutedForeground }]}>{tx.hash.slice(0, 12)}…</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.txAmt, { color: isIn ? colors.success : colors.foreground }]}>
                    {isIn ? "+" : "-"}{fmtBal(tx.amount)} {tx.tokenSymbol}
                  </Text>
                  <View style={[s.txStatus, { backgroundColor: tx.status === "success" ? colors.success + "18" : colors.destructive + "18" }]}>
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

      {/* Settings modal */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Wallet Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {[
              { label: "Export Private Key", icon: "key" as const, action: () => Alert.alert("Security", "Private key export requires biometric authentication.") },
              { label: "Show Recovery Phrase", icon: "eye" as const, action: () => Alert.alert("Security", "Recovery phrase export requires biometric authentication.") },
              { label: "Add Account", icon: "plus-circle" as const, action: () => Alert.alert("Coming Soon", "Multiple accounts support in v1.1") },
              { label: "Connected DApps", icon: "globe" as const, action: () => Alert.alert("Coming Soon", "WalletConnect v2 in next release") },
            ].map(item => (
              <TouchableOpacity key={item.label} style={[s.settingsRow, { borderBottomColor: colors.border }]}
                onPress={() => { setShowSettings(false); item.action(); }}>
                <View style={[s.settingsIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name={item.icon} size={16} color={colors.primary} />
                </View>
                <Text style={[s.settingsLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.dangerRow]}
              onPress={() => {
                setShowSettings(false);
                Alert.alert("Reset Wallet", "This will delete your wallet from this device. Make sure you have your recovery phrase.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset", style: "destructive", onPress: resetWallet },
                ]);
              }}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[s.dangerLabel, { color: colors.destructive }]}>Reset Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const { isCreated, loading } = useWallet();
  if (loading) return null;
  return isCreated ? <PortfolioScreen /> : <SetupScreen />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function setupStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    logoWrap: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    setupTitle: { fontSize: 24, fontWeight: "800" as const, textAlign: "center", marginBottom: 8 },
    setupSub: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 32 },
    chainChips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 32, paddingHorizontal: 16 },
    chainChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    chainChipText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    btnStack: { width: "100%", paddingHorizontal: 24, gap: 12, marginBottom: 32 },
    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 16 },
    primaryBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
    outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
    outlineBtnText: { fontWeight: "700" as const, fontSize: 15 },
    ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 12 },
    ghostBtnText: { fontWeight: "600" as const, fontSize: 14 },
    terms: { fontSize: 11, textAlign: "center", lineHeight: 18, paddingHorizontal: 40 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 20 },
    backBtn: { padding: 4 },
    backTitle: { fontSize: 18, fontWeight: "700" as const },
    alertBox: { flexDirection: "row", gap: 10, marginHorizontal: 16, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20, alignItems: "flex-start" },
    alertText: { flex: 1, fontSize: 12, color: "#f59e0b", lineHeight: 18 },
    mnemonicGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8, marginBottom: 20 },
    wordChip: { width: "30%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    wordNum: { fontSize: 10, fontFamily: "monospace", minWidth: 16 },
    wordText: { fontSize: 13, fontWeight: "600" as const, fontFamily: "monospace" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    checkText: { flex: 1, fontSize: 13, lineHeight: 19 },
    inputLabel: { fontSize: 13, marginHorizontal: 16, marginBottom: 10, lineHeight: 19 },
    mnemonicInput: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 14, minHeight: 120, textAlignVertical: "top" as const },
  });
}

function portfolioStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 },
    addrChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    addrDot: { width: 7, height: 7, borderRadius: 3.5 },
    addrText: { fontSize: 13, fontFamily: "monospace", fontWeight: "600" as const },
    iconBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    balanceCard: { marginHorizontal: 16, borderRadius: 24, padding: 22, marginBottom: 16 },
    balLabel: { fontSize: 12, color: "#c4b5fd", fontWeight: "600" as const, marginBottom: 4 },
    balAmount: { fontSize: 36, fontWeight: "800" as const, color: "#fff", letterSpacing: -1, marginBottom: 6 },
    balChangeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    balChange: { fontSize: 13, fontWeight: "600" as const },
    aiNote: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ffffff15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" as const },
    aiNoteText: { fontSize: 10, color: "#e9d5ff", fontFamily: "monospace" },
    actions: { flexDirection: "row", marginHorizontal: 16, gap: 8, marginBottom: 20 },
    actionBtn: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 16, borderWidth: 1, gap: 8 },
    actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    actionLabel: { fontSize: 11, fontWeight: "700" as const },
    sectionTitle: { fontSize: 15, fontWeight: "700" as const, marginHorizontal: 16, marginBottom: 10 },
    netScroll: { paddingHorizontal: 16, gap: 8, marginBottom: 20 },
    netChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    netName: { fontSize: 12, fontWeight: "700" as const, fontFamily: "monospace" },
    netUsd: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    testBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    testText: { fontSize: 8, color: "#f59e0b", fontWeight: "800" as const },
    tokHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginBottom: 8 },
    chainBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    chainBadgeText: { fontSize: 10, fontFamily: "monospace", fontWeight: "700" as const },
    tokRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 16, borderWidth: 1 },
    tokIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    tokIconText: { fontSize: 13, fontWeight: "800" as const, fontFamily: "monospace" },
    tokSymbol: { fontSize: 14, fontWeight: "700" as const },
    tokName: { fontSize: 11, marginTop: 2 },
    tokBalance: { fontSize: 14, fontWeight: "700" as const, fontFamily: "monospace" },
    tokUsd: { fontSize: 11, fontFamily: "monospace" },
    tokChange: { fontSize: 10, fontFamily: "monospace", fontWeight: "600" as const },
    stakingBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
    stakingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    stakingTitle: { fontSize: 14, fontWeight: "700" as const },
    stakingSub: { fontSize: 11, marginTop: 2 },
    txRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    txType: { fontSize: 12, fontWeight: "600" as const, textTransform: "capitalize" as const },
    txHash: { fontSize: 10, fontFamily: "monospace", marginTop: 1 },
    txAmt: { fontSize: 13, fontWeight: "700" as const },
    txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 3 },
    txStatusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "monospace" },
    modalBackdrop: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
    modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 36 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "700" as const },
    settingsRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
    settingsIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    settingsLabel: { flex: 1, fontSize: 14, fontWeight: "500" as const },
    dangerRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, marginTop: 4 },
    dangerLabel: { fontSize: 14, fontWeight: "600" as const },
  });
}
