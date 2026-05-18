import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface FeatureFlags { [key: string]: boolean }

const FEATURE_LABELS: Record<string, { label: string; icon: string }> = {
  swap_enabled:        { label: "Token Swap",         icon: "refresh-cw"  },
  staking_enabled:     { label: "Staking",             icon: "lock"        },
  bridge_enabled:      { label: "Cross-Chain Bridge",  icon: "git-merge"   },
  governance_enabled:  { label: "Governance Voting",   icon: "check-square"},
  ai_agent_enabled:    { label: "AI Agent",            icon: "cpu"         },
  analytics_enabled:   { label: "Analytics",           icon: "bar-chart-2" },
  leaderboard_enabled: { label: "Leaderboard",         icon: "award"       },
};

/* ─── Reward Card ────────────────────────────────── */
function RewardCard({ icon, title, desc, value, color }:
  { icon: string; title: string; desc: string; value: string; color: string }) {
  return (
    <View style={[rc.card, { borderColor: color + "30", backgroundColor: color + "0D" }]}>
      <View style={[rc.iconBox, { backgroundColor: color + "22" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <View style={rc.body}>
        <Text style={[rc.title, { color: "#f4f4f8" }]}>{title}</Text>
        <Text style={[rc.desc, { color: "#9ca3af" }]}>{desc}</Text>
      </View>
      <View style={[rc.badge, { backgroundColor: color + "22", borderColor: color + "40" }]}>
        <Text style={[rc.badgeText, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const rc = StyleSheet.create({
  card:     { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  iconBox:  { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  body:     { flex: 1 },
  title:    { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  desc:     { fontSize: 12, lineHeight: 16 },
  badge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeText:{ fontSize: 12, fontWeight: "800" },
});

/* ─── Guest Screen ───────────────────────────────── */
function GuestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={gs.hero}>
        <View style={gs.logoRing}>
          <View style={gs.logoInner}>
            <Feather name="zap" size={32} color="#00FF87" />
          </View>
        </View>
        <Text style={gs.heroTitle}>Join ZBX Chain</Text>
        <Text style={gs.heroSub}>
          Create a free account to unlock rewards, invite friends, and access exclusive features.
        </Text>
      </View>

      {/* Reward cards */}
      <Text style={gs.sectionLabel}>WHAT YOU GET</Text>
      <RewardCard
        icon="gift"
        title="Welcome Bonus"
        desc="Instantly credited to your wallet on signup"
        value="100 ZBX"
        color="#00FF87"
      />
      <RewardCard
        icon="users"
        title="Referral Rewards"
        desc="Share your invite code — earn for every friend"
        value="50 ZBX / invite"
        color="#818CF8"
      />
      <RewardCard
        icon="award"
        title="Leaderboard Prizes"
        desc="Top traders win weekly ZBX bonus pools"
        value="Up to 500 ZBX"
        color="#FBBF24"
      />
      <RewardCard
        icon="lock"
        title="Exclusive Features"
        desc="AI Agent, staking, and governance — members only"
        value="Early Access"
        color="#FB923C"
      />

      {/* CTA */}
      <TouchableOpacity
        style={gs.primaryBtn}
        activeOpacity={0.85}
        onPress={() => router.push("/(auth)?mode=signup")}
      >
        <Feather name="user-plus" size={16} color="#000" style={{ marginRight: 8 }} />
        <Text style={gs.primaryBtnText}>Create Free Account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={gs.secondaryBtn}
        activeOpacity={0.75}
        onPress={() => router.push("/(auth)?mode=login")}
      >
        <Text style={gs.secondaryBtnText}>Already have an account? Sign in →</Text>
      </TouchableOpacity>

      {/* Guest note */}
      <View style={gs.guestNote}>
        <Feather name="info" size={13} color="#6b7280" style={{ marginRight: 8 }} />
        <Text style={gs.guestNoteText}>
          You're browsing as a guest. All blockchain data is fully visible — create an account anytime to unlock rewards.
        </Text>
      </View>
    </ScrollView>
  );
}

const gs = StyleSheet.create({
  hero:           { alignItems: "center", marginBottom: 28, paddingTop: 8 },
  logoRing:       { width: 90, height: 90, borderRadius: 28, borderWidth: 2, borderColor: "#00FF8730", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoInner:      { width: 72, height: 72, borderRadius: 22, backgroundColor: "#00FF8715", alignItems: "center", justifyContent: "center" },
  heroTitle:      { fontSize: 26, fontWeight: "800", color: "#f4f4f8", marginBottom: 8, letterSpacing: -0.5 },
  heroSub:        { fontSize: 14, color: "#9ca3af", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  sectionLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: "#6b7280", marginBottom: 12 },
  primaryBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 16, marginBottom: 12, marginTop: 8, backgroundColor: "#00FF87" },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  secondaryBtn:   { alignItems: "center", paddingVertical: 12, marginBottom: 20 },
  secondaryBtnText:{ fontSize: 13, color: "#00FF87", fontWeight: "600" },
  guestNote:      { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#111118", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#1e1e2e" },
  guestNoteText:  { fontSize: 12, color: "#6b7280", flex: 1, lineHeight: 18 },
});

/* ─── Authenticated Profile ──────────────────────── */
function AuthenticatedProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refreshUser } = useAppAuth();
  const colors = useColors();
  const [features, setFeatures]           = useState<FeatureFlags>({});
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
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); } },
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
          <StatusBadge ok={user?.isEmailVerified ?? false} labels={["Email Verified", "Unverified"]} />
          <StatusBadge ok={user?.isActive ?? false} labels={["Active", "Disabled"]} />
        </View>
      </View>

      {/* Invite code card */}
      <View style={[s.inviteCard, { backgroundColor: "#00FF8710", borderColor: "#00FF8730" }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.inviteLabel, { color: "#00FF87" }]}>YOUR INVITE CODE</Text>
          <Text style={[s.inviteCode, { color: "#f4f4f8" }]}>ZBX-{String(user?.id ?? "0000").padStart(4, "0")}-{(user?.email?.slice(0, 3) ?? "XXX").toUpperCase()}</Text>
          <Text style={[s.inviteSub, { color: "#9ca3af" }]}>Share and earn 50 ZBX per referral</Text>
        </View>
        <Feather name="share-2" size={18} color="#00FF87" />
      </View>

      {/* Account info */}
      <Section title="Account Info" colors={colors}>
        <InfoRow icon="hash"     label="User ID"      value={`#${user?.id}`}             colors={colors} />
        <InfoRow icon="calendar" label="Member Since"  value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} colors={colors} />
        <InfoRow icon="mail"     label="Email"         value={user?.email ?? "—"}         colors={colors} />
        <InfoRow icon="user"     label="Display Name"  value={user?.displayName ?? "Not set"} colors={colors} />
      </Section>

      {/* Feature flags */}
      <Section title="Available Features" colors={colors}>
        {loadingFeatures ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
        ) : (
          Object.entries(FEATURE_LABELS).map(([key, { label, icon }]) => (
            <View key={key} style={[s.featureRow, { borderBottomColor: colors.border + "40" }]}>
              <Feather name={icon as any} size={16} color={features[key] ? colors.primary : colors.mutedForeground} style={{ marginRight: 12 }} />
              <Text style={[s.featureLabel, { color: features[key] ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
              <View style={[s.featureDot, { backgroundColor: features[key] ? "#22c55e" : colors.mutedForeground + "50" }]} />
              <Text style={[s.featureStatus, { color: features[key] ? "#22c55e" : colors.mutedForeground }]}>
                {features[key] ? "On" : "Off"}
              </Text>
            </View>
          ))
        )}
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

/* ─── Shared helpers ─────────────────────────────── */
function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>{children}</View>
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

function StatusBadge({ ok, labels }: { ok: boolean; labels: [string, string] }) {
  return (
    <View style={[s.badge, { backgroundColor: ok ? "#22c55e22" : "#ef444422", borderColor: ok ? "#22c55e44" : "#ef444444" }]}>
      <Feather name={ok ? "check-circle" : "x-circle"} size={11} color={ok ? "#22c55e" : "#ef4444"} />
      <Text style={[s.badgeText, { color: ok ? "#22c55e" : "#ef4444" }]}>{ok ? labels[0] : labels[1]}</Text>
    </View>
  );
}

/* ─── Root export ────────────────────────────────── */
export default function ProfileScreen() {
  const { isAuthenticated, isLoading } = useAppAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0a0f", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#00FF87" size="large" />
      </View>
    );
  }

  return isAuthenticated ? <AuthenticatedProfile /> : <GuestScreen />;
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  content:       { paddingHorizontal: 16 },
  header:        { alignItems: "center", marginBottom: 20, paddingTop: 8 },
  avatar:        { width: 72, height: 72, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText:    { fontSize: 26, fontWeight: "800" },
  name:          { fontSize: 20, fontWeight: "700", marginBottom: 3 },
  email:         { fontSize: 13, marginBottom: 10 },
  badges:        { flexDirection: "row", gap: 8 },
  badge:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText:     { fontSize: 11, fontWeight: "600" },
  inviteCard:    { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24, gap: 12 },
  inviteLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  inviteCode:    { fontSize: 18, fontWeight: "800", letterSpacing: 1, marginBottom: 3 },
  inviteSub:     { fontSize: 12 },
  sectionTitle:  { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, marginLeft: 2 },
  card:          { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel:     { fontSize: 13, flex: 1, marginLeft: 2 },
  infoValue:     { fontSize: 13, fontWeight: "500", maxWidth: "55%" },
  featureRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  featureLabel:  { flex: 1, fontSize: 13 },
  featureDot:    { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  featureStatus: { fontSize: 12, fontWeight: "600", width: 24 },
  actionRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  actionDanger:  { borderTopWidth: StyleSheet.hairlineWidth },
  actionLabel:   { flex: 1, fontSize: 14, fontWeight: "500" },
});
