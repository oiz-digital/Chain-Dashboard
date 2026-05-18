import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAppAuth } from "@/contexts/AppAuthContext";

type Tab = "login" | "signup";

const ACCENT = "#00FF87";
const BG     = "#0a0a0f";
const CARD   = "#111118";
const BORDER = "#1e1e2e";
const MUTED  = "#6b7280";
const FG     = "#f4f4f8";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup } = useAppAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [tab, setTab] = useState<Tab>(params.mode === "signup" ? "signup" : "login");

  useEffect(() => {
    if (params.mode === "signup") setTab("signup");
    else if (params.mode === "login") setTab("login");
  }, [params.mode]);

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode,  setInviteCode]  = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { Alert.alert("Error", "Enter your email and password."); return; }
    setLoading(true);
    const res = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)");
    } else if (res.requiresVerification) {
      Alert.alert("Email Verification Required", "Please verify your email address before logging in. Check your inbox or contact support.");
    } else {
      Alert.alert("Login Failed", res.error ?? "Invalid credentials.");
    }
  };

  const handleSignup = async () => {
    if (!email.trim()) { Alert.alert("Error", "Email is required."); return; }
    if (!password || password.length < 8) { Alert.alert("Error", "Password must be at least 8 characters."); return; }
    if (password !== confirmPass) { Alert.alert("Error", "Passwords do not match."); return; }
    setLoading(true);
    const res = await signup(email.trim().toLowerCase(), password, displayName, inviteCode);
    setLoading(false);
    if (res.success && res.requiresVerification) {
      Alert.alert("Verify Your Email", "Your account was created! A verification email will be sent. Please check your inbox before logging in.", [
        { text: "OK", onPress: () => setTab("login") }
      ]);
    } else if (res.success) {
      router.replace("/(tabs)");
    } else {
      Alert.alert("Signup Failed", res.error ?? "Could not create account.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: BG }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={[s.logoBox, { borderColor: ACCENT + "40", backgroundColor: ACCENT + "18" }]}>
            <Text style={[s.logoText, { color: ACCENT }]}>Z</Text>
          </View>
          <Text style={[s.logoName, { color: FG }]}>ZBX Chain</Text>
          <Text style={[s.logoSub, { color: MUTED }]}>Layer-1 AI Blockchain</Text>
        </View>

        {/* Tab switcher */}
        <View style={[s.tabs, { backgroundColor: CARD, borderColor: BORDER }]}>
          {(["login", "signup"] as Tab[]).map(t => (
            <TouchableOpacity
              key={t} style={[s.tab, tab === t && { backgroundColor: ACCENT + "20" }]}
              onPress={() => setTab(t)} activeOpacity={0.8}
            >
              <Text style={[s.tabText, { color: tab === t ? ACCENT : MUTED }]}>
                {t === "login" ? "Sign In" : "Create Account"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form card */}
        <View style={[s.card, { backgroundColor: CARD, borderColor: BORDER }]}>
          {tab === "signup" && (
            <Field label="Display Name (optional)" value={displayName} onChangeText={setDisplayName}
              placeholder="Your name" autoCapitalize="words" icon="user" fg={FG} muted={MUTED} accent={ACCENT} border={BORDER} />
          )}
          <Field label="Email Address" value={email} onChangeText={setEmail}
            placeholder="you@example.com" keyboardType="email-address" icon="mail"
            fg={FG} muted={MUTED} accent={ACCENT} border={BORDER} />
          <Field label="Password" value={password} onChangeText={setPassword}
            placeholder={tab === "signup" ? "At least 8 characters" : "Your password"}
            secureTextEntry={!showPass} icon="lock"
            rightAction={<TouchableOpacity onPress={() => setShowPass(s => !s)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={16} color={MUTED} />
            </TouchableOpacity>}
            fg={FG} muted={MUTED} accent={ACCENT} border={BORDER} />
          {tab === "signup" && (
            <>
              <Field label="Confirm Password" value={confirmPass} onChangeText={setConfirmPass}
                placeholder="Repeat password" secureTextEntry={!showPass} icon="lock"
                fg={FG} muted={MUTED} accent={ACCENT} border={BORDER} />
              <Field label="Invite Code (if required)" value={inviteCode} onChangeText={setInviteCode}
                placeholder="XXXXXXXXXXXX" autoCapitalize="characters" icon="link"
                fg={FG} muted={MUTED} accent={ACCENT} border={BORDER} />
            </>
          )}

          <TouchableOpacity
            style={[s.btn, { backgroundColor: ACCENT }]}
            onPress={tab === "login" ? handleLogin : handleSignup}
            activeOpacity={0.85} disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>{tab === "login" ? "Sign In" : "Create Account"}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[s.footer, { color: MUTED }]}>
          {tab === "login" ? "Don't have an account? " : "Already have an account? "}
          <Text style={{ color: ACCENT }} onPress={() => setTab(tab === "login" ? "signup" : "login")}>
            {tab === "login" ? "Sign Up" : "Sign In"}
          </Text>
        </Text>

        {/* Guest continue */}
        <View style={s.dividerRow}>
          <View style={[s.divider, { backgroundColor: BORDER }]} />
          <Text style={[s.dividerText, { color: MUTED }]}>or</Text>
          <View style={[s.divider, { backgroundColor: BORDER }]} />
        </View>
        <TouchableOpacity
          style={[s.guestBtn, { borderColor: BORDER }]}
          activeOpacity={0.75}
          onPress={() => router.replace("/(tabs)")}
        >
          <Feather name="eye" size={15} color={MUTED} style={{ marginRight: 8 }} />
          <Text style={[s.guestBtnText, { color: MUTED }]}>Continue as Guest</Text>
        </TouchableOpacity>
        <Text style={[s.guestNote, { color: MUTED }]}>
          Browse freely — create an account anytime to claim rewards
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, fg, muted, accent, border, rightAction, ...inputProps }: {
  label: string; fg: string; muted: string; accent: string; border: string;
  rightAction?: React.ReactNode; icon: string;
  [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      <View style={[{
        flexDirection: "row", alignItems: "center",
        borderWidth: 1, borderColor: focused ? accent + "60" : border,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: "#0d0d16",
      }]}>
        <Feather name={inputProps.icon as any} size={15} color={focused ? accent : muted} style={{ marginRight: 10 }} />
        <TextInput
          style={{ flex: 1, color: fg, fontSize: 15 }}
          placeholderTextColor={muted}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {rightAction}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  scroll:   { paddingHorizontal: 20, flexGrow: 1 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoBox:  { width: 64, height: 64, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: "900" },
  logoName: { fontSize: 22, fontWeight: "700", letterSpacing: 0.5 },
  logoSub:  { fontSize: 13, marginTop: 3 },
  tabs:     { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 4, marginBottom: 20 },
  tab:      { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabText:  { fontSize: 13, fontWeight: "600" },
  card:     { borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 20 },
  btn:      { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4 },
  btnText:  { fontSize: 15, fontWeight: "700", color: "#000" },
  footer:      { textAlign: "center", fontSize: 13, marginBottom: 4 },
  dividerRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divider:     { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  guestBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14, paddingVertical: 13, marginBottom: 10 },
  guestBtnText:{ fontSize: 14, fontWeight: "600" },
  guestNote:   { textAlign: "center", fontSize: 11, lineHeight: 16, paddingHorizontal: 20 },
});
