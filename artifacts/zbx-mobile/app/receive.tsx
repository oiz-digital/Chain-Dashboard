import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Clipboard, Alert, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useWallet } from "@/contexts/WalletContext";

// Generate deterministic QR-like grid from address
function QRGrid({ address, color }: { address: string; color: string }) {
  const size = 21;
  const cells: boolean[][] = [];

  // Seed from address characters
  for (let r = 0; r < size; r++) {
    cells[r] = [];
    for (let c = 0; c < size; c++) {
      const idx = (r * size + c) % (address.length - 2);
      const charCode = address.charCodeAt(idx + 2);
      // Corner finder patterns (always filled)
      const isCornerTL = (r < 7 && c < 7);
      const isCornerTR = (r < 7 && c >= size - 7);
      const isCornerBL = (r >= size - 7 && c < 7);
      if (isCornerTL || isCornerTR || isCornerBL) {
        const borderTL = r === 0 || r === 6 || c === 0 || c === 6;
        const borderTR = r === 0 || r === 6 || c === size - 7 || c === size - 1;
        const borderBL = r === size - 7 || r === size - 1 || c === 0 || c === 6;
        const innerTL = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const innerTR = r >= 2 && r <= 4 && c >= size - 5 && c <= size - 3;
        const innerBL = r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4;
        cells[r][c] = borderTL || borderTR || borderBL || innerTL || innerTR || innerBL;
      } else {
        cells[r][c] = charCode % 3 !== 0;
      }
    }
  }

  const cellSize = 9;
  const total = size * cellSize;

  return (
    <View style={{ width: total, height: total, backgroundColor: "#fff", padding: 8, borderRadius: 16 }}>
      {cells.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((filled, c) => (
            <View key={c} style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: filled ? "#1a1a2e" : "#fff",
            }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ReceiveScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { address, selectedChain } = useWallet();
  const [copied, setCopied] = useState(false);
  const s = makeStyles(colors);

  const addr = address ?? "0x0000000000000000000000000000000000000000";

  const copyAddr = () => {
    Clipboard.setString(addr);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareAddr = async () => {
    try {
      await Share.share({
        message: `My ${selectedChain.name} wallet address:\n${addr}`,
        title: "ZBX Wallet Address",
      });
    } catch {}
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Receive</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Network badge */}
      <View style={s.networkRow}>
        <View style={[s.networkBadge, { backgroundColor: selectedChain.color + "15", borderColor: selectedChain.color + "35" }]}>
          <Feather name={selectedChain.icon as any} size={14} color={selectedChain.color} />
          <Text style={[s.networkName, { color: selectedChain.color }]}>{selectedChain.name}</Text>
          <Text style={[s.networkId, { color: selectedChain.color }]}>· ID {selectedChain.id}</Text>
        </View>
      </View>

      {/* QR Section */}
      <View style={s.qrSection}>
        <LinearGradient
          colors={[selectedChain.color + "20", selectedChain.color + "08"]}
          style={s.qrCard}>
          <View style={s.qrBorder}>
            <QRGrid address={addr} color={selectedChain.color} />
          </View>
          <View style={s.logoOverlay}>
            <LinearGradient colors={["#4c1d95", "#a855f7"]}
              style={s.logoCircle}>
              <Feather name="cpu" size={16} color="#fff" />
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      {/* Address */}
      <Text style={[s.addrLabel, { color: colors.mutedForeground }]}>Your {selectedChain.nativeSymbol} Address</Text>
      <View style={[s.addrBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.addrText, { color: colors.foreground }]} selectable>
          {addr}
        </Text>
      </View>

      {/* Warning */}
      <View style={[s.warning, { backgroundColor: "#f59e0b10", borderColor: "#f59e0b25" }]}>
        <Feather name="alert-triangle" size={14} color="#f59e0b" />
        <Text style={s.warningText}>
          Only send <Text style={{ fontWeight: "700" }}>{selectedChain.nativeSymbol}</Text> and tokens on <Text style={{ fontWeight: "700" }}>{selectedChain.name}</Text> to this address.
          Wrong network = permanent loss.
        </Text>
      </View>

      {/* Actions */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: copied ? colors.success + "20" : colors.primary + "15", borderColor: copied ? colors.success + "40" : colors.primary + "35" }]}
          onPress={copyAddr} activeOpacity={0.8}>
          <Feather name={copied ? "check" : "copy"} size={18} color={copied ? colors.success : colors.primary} />
          <Text style={[s.actionText, { color: copied ? colors.success : colors.primary }]}>
            {copied ? "Copied!" : "Copy Address"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={shareAddr} activeOpacity={0.8}>
          <Feather name="share-2" size={18} color={colors.foreground} />
          <Text style={[s.actionText, { color: colors.foreground }]}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Chain stats */}
      <View style={[s.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: colors.foreground }]}>{selectedChain.tokens.length}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Tokens</Text>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: colors.foreground }]}>$0.00</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Incoming</Text>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: selectedChain.testnet ? colors.warning : colors.success }]}>
            {selectedChain.testnet ? "TESTNET" : "MAINNET"}
          </Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Network</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
    backBtn: { padding: 4, width: 28 },
    title: { flex: 1, fontSize: 20, fontWeight: "800" as const, textAlign: "center" as const },
    networkRow: { alignItems: "center", marginBottom: 20 },
    networkBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    networkName: { fontSize: 13, fontWeight: "700" as const },
    networkId: { fontSize: 11, fontFamily: "monospace" },
    qrSection: { alignItems: "center", marginBottom: 20 },
    qrCard: { padding: 20, borderRadius: 24, alignItems: "center", position: "relative" as const },
    qrBorder: { borderWidth: 3, borderColor: "#ffffff40", borderRadius: 12, overflow: "hidden" as const },
    logoOverlay: { position: "absolute" as const, bottom: -1, right: 16 },
    logoCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
    addrLabel: { fontSize: 11, fontWeight: "600" as const, textAlign: "center" as const, marginBottom: 8 },
    addrBox: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
    addrText: { fontSize: 12, fontFamily: "monospace", textAlign: "center" as const, lineHeight: 20 },
    warning: { flexDirection: "row", gap: 10, marginHorizontal: 16, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20, alignItems: "flex-start" as const },
    warningText: { flex: 1, fontSize: 11, color: "#f59e0b", lineHeight: 17 },
    actionRow: { flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 20 },
    actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
    actionText: { fontSize: 14, fontWeight: "700" as const },
    statsRow: { flexDirection: "row", marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
    statItem: { flex: 1, alignItems: "center", gap: 4 },
    statVal: { fontSize: 14, fontWeight: "700" as const, fontFamily: "monospace" },
    statLabel: { fontSize: 10 },
    divider: { width: 1, marginHorizontal: 8 },
  });
}
