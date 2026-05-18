import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Switch, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface FeatureFlags { [key: string]: boolean }

const FEATURE_LABELS: Record<string, { label: string; icon: string }> = {
  swap_enabled:       { label: "Token Swap",        icon: "refresh-cw" },
  staking_enabled:    { label: "Staking",            icon: "lock" },
  bridge_enabled:     { label: "Cross-Chain Bridge", icon: "git-merge" },
  governance_enabled: { label: "Governance Voting",  icon: "check-square" },
  ai_agent_enabled:   { label: "AI Agent",           icon: "cpu" },
  analytics_enabled:  { label: "Analytics",          icon: "bar-chart-2" },
  leaderboard_enabled:{ label: "Leaderboard",        icon: "award" },
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refreshUser } = useAppAuth();
  const colors = useColors();
  const [features, setFeatures] = useState<FeatureFlags>({});
  const [loadingFeatures, setLoadingFeatures] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/features`);
        if (r.ok) setFeatures(await r.json());
      } catch {}
      finally { setLoadingFeatures(false); }
    })();
  }, []);

  const handleLogout = () =>
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)"); } },
    ]);

  const initial = (user?.displayName ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={[s.avatar, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
          <Text style={[s.avatarText, { color: colors.primary }]}>{initial}</Text>
        </View>
        <Text style={[s.name, { color: colors.foreground }]}>{user?.displayName ?? "User"}</Text>
        <Text style={[s.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
        <View style={s.badges}>
          <StatusBadge
            ok={user?.isEmailVerified ?? false}
            labels={["Email Verified", "Email Unverified"]}
            colors={colors}
          />
          <StatusBadge
            ok={user?.isActive ?? false}
            labels={["Account Active", "Account Disabled"]}
            colors={colors}
          />
        </View>
      </View>

      {/* Account info */}
      <Section title="Account Info" colors={colors}>
        <InfoRow icon="hash"      label="User ID"    value={`#${user?.id}`}      colors={colors} />
        <InfoRow icon="calendar"  label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} colors={colors} />
        <InfoRow icon="mail"      label="Email"      value={user?.email ?? "—"}  colors={colors} />
        <InfoRow icon="user"      label="Display Name" value={user?.displayName ?? "Not set"} colors={colors} />
      </Section>

      {/* Feature flags */}
      <Section title="Available Features" colors={colors}>
        {loadingFeatures ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
        ) : Object.entries(FEATURE_LABELS).map(([key, { label, icon }]) => (
          <View key={key} style={[s.featureRow, { borderBottomColor: colors.border + "40" }]}>
            <Feather name={icon as any} size={16} color={features[key] ? colors.primary : colors.mutedForeground} style={{ marginRight: 12 }} />
            <Text style={[s.featureLabel, { color: features[key] ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            <View style={[s.featureDot, { backgroundColor: features[key] ? "#22c55e" : colors.mutedForeground + "50" }]} />
            <Text style={[s.featureStatus, { color: features[key] ? "#22c55e" : colors.mutedForeground }]}>
              {features[key] ? "On" : "Off"}
            </Text>
          </View>
        ))}
      </Section>

      {/* Actions */}
      <Section title="Account" colors={colors}>
        <TouchableOpacity style={s.actionRow} onPress={refreshUser} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={16} color={colors.primary} style={{ marginRight: 12 }} />
          <Text style={[s.actionLabel, { color: colors.foreground }]}>Refresh Session</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionRow, s.actionDanger]} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={16} color="#ef4444" style={{ marginRight: 12 }} />
          <Text style={[s.actionLabel, { color: "#ef4444" }]}>Sign Out</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
        {children}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={[s.infoRow, { borderBottomColor: colors.border + "40" }]}>
      <Feather name={icon as any} size={14} color={colors.mutedForeground} style={{ marginRight: 10 }} />
      <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatusBadge({ ok, labels, colors }: { ok: boolean; labels: [string, string]; colors: any }) {
  return (
    <View style={[s.badge, { backgroundColor: ok ? "#22c55e22" : "#ef444422", borderColor: ok ? "#22c55e44" : "#ef444444" }]}>
      <Feather name={ok ? "check-circle" : "x-circle"} size={11} color={ok ? "#22c55e" : "#ef4444"} />
      <Text style={[s.badgeText, { color: ok ? "#22c55e" : "#ef4444" }]}>{ok ? labels[0] : labels[1]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  content:     { paddingHorizontal: 16 },
  header:      { alignItems: "center", marginBottom: 28, paddingTop: 8 },
  avatar:      { width: 72, height: 72, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText:  { fontSize: 26, fontWeight: "800" },
  name:        { fontSize: 20, fontWeight: "700", marginBottom: 3 },
  email:       { fontSize: 13, marginBottom: 10 },
  badges:      { flexDirection: "row", gap: 8 },
  badge:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText:   { fontSize: 11, fontWeight: "600" },
  sectionTitle:{ fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, marginLeft: 2 },
  card:        { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel:   { fontSize: 13, flex: 1, marginLeft: 2 },
  infoValue:   { fontSize: 13, fontWeight: "500", maxWidth: "55%" },
  featureRow:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  featureLabel:{ flex: 1, fontSize: 13 },
  featureDot:  { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  featureStatus:{ fontSize: 12, fontWeight: "600", width: 24 },
  actionRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  actionDanger:{ borderTopWidth: StyleSheet.hairlineWidth },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
});
