import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useWallet } from "@/contexts/WalletContext";

function fmtBal(n: number) {
  if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toFixed(6);
}

const GAS_ESTIMATES: Record<number, { symbol: string; gwei: number; usd: number }> = {
  8989:  { symbol: "ZBX", gwei: 1,     usd: 0.00028 },
  8988:  { symbol: "tZBX", gwei: 1,    usd: 0 },
  1:     { symbol: "ETH", gwei: 22,    usd: 2.14 },
  137:   { symbol: "POL", gwei: 120,   usd: 0.014 },
  56:    { symbol: "BNB", gwei: 5,     usd: 0.09 },
  42161: { symbol: "ETH", gwei: 0.1,   usd: 0.022 },
};

const RECENT_ADDRS = [
  "0x742d35Cc6634C0532925a3b8D4C9C2B8",
  "0xdAC17F958D2ee523a2206206994597C1",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3",
];

export default function SendScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ token?: string }>();
  const { selectedChain, addTransaction } = useWallet();

  const defaultToken = selectedChain.tokens.find(t => t.symbol === params.token) ?? selectedChain.tokens[0];
  const [selectedToken, setSelectedToken] = useState(defaultToken);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  const gasEst = GAS_ESTIMATES[selectedChain.id] ?? GAS_ESTIMATES[8989];
  const amountNum = parseFloat(amount) || 0;
  const usdValue = amountNum * selectedToken.priceUsd;
  const isValid = recipient.startsWith("0x") && recipient.length >= 42 && amountNum > 0 && amountNum <= selectedToken.balance;
  const s = makeStyles(colors);

  const handleSend = useCallback(async () => {
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(r => setTimeout(r, 1500));
    await addTransaction({
      type: "send",
      tokenSymbol: selectedToken.symbol,
      amount: amountNum,
      to: recipient,
      from: "self",
      chainId: selectedChain.id,
      status: "success",
      gasUsed: gasEst.gwei * 21_000,
    });
    setSending(false);
    setShowConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Transaction Sent ✓", `${fmtBal(amountNum)} ${selectedToken.symbol} sent\n\nTx hash will appear in your history.`, [
      { text: "OK", onPress: () => router.back() }
    ]);
  }, [amountNum, recipient, selectedToken, selectedChain, gasEst, addTransaction, router]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 120 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.foreground }]}>Send Tokens</Text>
          <View style={[s.chainPill, { backgroundColor: selectedChain.color + "18", borderColor: selectedChain.color + "35" }]}>
            <Feather name={selectedChain.icon as any} size={11} color={selectedChain.color} />
            <Text style={[s.chainPillText, { color: selectedChain.color }]}>{selectedChain.shortName}</Text>
          </View>
        </View>

        {/* Token selector */}
        <Text style={[s.label, { color: colors.mutedForeground }]}>Token</Text>
        <TouchableOpacity
          style={[s.tokenBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowTokenPicker(true)}>
          <View style={[s.tokenIcon, { backgroundColor: selectedToken.color + "20" }]}>
            <Text style={[s.tokenIconText, { color: selectedToken.color }]}>{selectedToken.symbol.slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.tokenSymbol, { color: colors.foreground }]}>{selectedToken.symbol}</Text>
            <Text style={[s.tokenBal, { color: colors.mutedForeground }]}>Balance: {fmtBal(selectedToken.balance)}</Text>
          </View>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Recipient */}
        <Text style={[s.label, { color: colors.mutedForeground }]}>Recipient Address</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: recipient.length > 0 && !recipient.startsWith("0x") ? colors.destructive : colors.border }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="0x…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {recipient.length > 0 && (
            <TouchableOpacity onPress={() => setRecipient("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Recent */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16, marginTop: 8 }}>
          {RECENT_ADDRS.map(addr => (
            <TouchableOpacity key={addr}
              style={[s.recentChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setRecipient(addr + "6dF1"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Feather name="clock" size={10} color={colors.mutedForeground} />
              <Text style={[s.recentText, { color: colors.mutedForeground }]}>{addr.slice(0, 12)}…</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Amount */}
        <Text style={[s.label, { color: colors.mutedForeground }]}>Amount</Text>
        <View style={[s.amountWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[s.amountInput, { color: colors.foreground }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity
            style={[s.maxBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}
            onPress={() => setAmount(selectedToken.balance.toString())}>
            <Text style={[s.maxText, { color: colors.primary }]}>MAX</Text>
          </TouchableOpacity>
        </View>
        <View style={s.amountMeta}>
          <Text style={[s.amountUsd, { color: colors.mutedForeground }]}>
            ≈ ${usdValue.toFixed(2)} USD
          </Text>
          {amountNum > selectedToken.balance && (
            <Text style={[s.amountErr, { color: colors.destructive }]}>Insufficient balance</Text>
          )}
        </View>

        {/* Gas */}
        <View style={[s.gasCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.gasRow}>
            <Feather name="zap" size={13} color="#f59e0b" />
            <Text style={[s.gasLabel, { color: colors.mutedForeground }]}>Estimated Gas</Text>
            <Text style={[s.gasVal, { color: colors.foreground }]}>21,000 gas · {gasEst.gwei} gwei</Text>
          </View>
          <View style={s.gasRow}>
            <Feather name="dollar-sign" size={13} color={colors.success} />
            <Text style={[s.gasLabel, { color: colors.mutedForeground }]}>Fee in {gasEst.symbol}</Text>
            <Text style={[s.gasVal, { color: colors.foreground }]}>
              ~{(21_000 * gasEst.gwei * 1e-9).toFixed(6)} {gasEst.symbol}
              {gasEst.usd > 0 ? ` ($${gasEst.usd.toFixed(3)})` : " (free)"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Send button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[s.sendBtn, { opacity: isValid ? 1 : 0.5 }]}
          onPress={() => { if (isValid) setShowConfirm(true); }}
          disabled={!isValid}
          activeOpacity={0.85}>
          <LinearGradient colors={["#7c3aed", "#a855f7", "#d946ef"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.sendBtnGrad}>
            <Feather name="arrow-up-right" size={18} color="#fff" />
            <Text style={s.sendBtnText}>Review & Send</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Token picker modal */}
      <Modal visible={showTokenPicker} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Select Token</Text>
              <TouchableOpacity onPress={() => setShowTokenPicker(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {selectedChain.tokens.map(tok => (
              <TouchableOpacity key={tok.symbol}
                style={[s.pickerRow, { borderBottomColor: colors.border, backgroundColor: tok.symbol === selectedToken.symbol ? colors.primary + "10" : "transparent" }]}
                onPress={() => { setSelectedToken(tok); setShowTokenPicker(false); }}>
                <View style={[s.pickerIcon, { backgroundColor: tok.color + "20" }]}>
                  <Text style={[s.pickerIconText, { color: tok.color }]}>{tok.symbol.slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.pickerSymbol, { color: colors.foreground }]}>{tok.symbol}</Text>
                  <Text style={[s.pickerBal, { color: colors.mutedForeground }]}>{fmtBal(tok.balance)}</Text>
                </View>
                {tok.symbol === selectedToken.symbol && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Confirm modal */}
      <Modal visible={showConfirm} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Confirm Transaction</Text>
              <TouchableOpacity onPress={() => setShowConfirm(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {[
              { label: "Token", val: `${selectedToken.symbol} on ${selectedChain.name}` },
              { label: "Amount", val: `${fmtBal(amountNum)} ${selectedToken.symbol}` },
              { label: "USD Value", val: `≈ $${usdValue.toFixed(2)}` },
              { label: "To", val: recipient.slice(0, 16) + "…" + recipient.slice(-8) },
              { label: "Est. Fee", val: gasEst.usd > 0 ? `$${gasEst.usd.toFixed(3)}` : "~0 (testnet)" },
            ].map(row => (
              <View key={row.label} style={[s.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[s.confirmLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[s.confirmVal, { color: colors.foreground }]}>{row.val}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[s.confirmBtn, { opacity: sending ? 0.7 : 1 }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}>
              <LinearGradient colors={["#7c3aed", "#a855f7"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.confirmBtnGrad}>
                <Text style={s.confirmBtnText}>{sending ? "Broadcasting…" : "Confirm & Send"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 20 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 20, fontWeight: "800" as const },
    chainPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    chainPillText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "monospace" },
    label: { fontSize: 12, fontWeight: "600" as const, marginHorizontal: 16, marginBottom: 6 },
    tokenBtn: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    tokenIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    tokenIconText: { fontSize: 13, fontWeight: "800" as const, fontFamily: "monospace" },
    tokenSymbol: { fontSize: 15, fontWeight: "700" as const },
    tokenBal: { fontSize: 11, marginTop: 2, fontFamily: "monospace" },
    inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
    input: { flex: 1, fontSize: 14, fontFamily: "monospace" },
    recentChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    recentText: { fontSize: 10, fontFamily: "monospace" },
    amountWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: "700" as const, fontFamily: "monospace" },
    maxBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
    maxText: { fontSize: 11, fontWeight: "800" as const, fontFamily: "monospace" },
    amountMeta: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 16 },
    amountUsd: { fontSize: 12, fontFamily: "monospace" },
    amountErr: { fontSize: 12, fontWeight: "600" as const },
    gasCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    gasRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    gasLabel: { flex: 1, fontSize: 12 },
    gasVal: { fontSize: 12, fontFamily: "monospace", fontWeight: "600" as const },
    bottomBar: { position: "absolute" as const, bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 0 },
    sendBtn: { borderRadius: 18, overflow: "hidden" as const },
    sendBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
    sendBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
    modalBackdrop: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
    modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 32 },
    modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: "700" as const },
    pickerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 4 },
    pickerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    pickerIconText: { fontSize: 13, fontWeight: "800" as const, fontFamily: "monospace" },
    pickerSymbol: { fontSize: 14, fontWeight: "700" as const },
    pickerBal: { fontSize: 11, fontFamily: "monospace", marginTop: 1 },
    confirmRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1 },
    confirmLabel: { fontSize: 13 },
    confirmVal: { fontSize: 13, fontWeight: "600" as const, fontFamily: "monospace", maxWidth: "60%" as any, textAlign: "right" as const },
    confirmBtn: { marginTop: 16, borderRadius: 16, overflow: "hidden" as const },
    confirmBtnGrad: { alignItems: "center", justifyContent: "center", paddingVertical: 15 },
    confirmBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  });
}
