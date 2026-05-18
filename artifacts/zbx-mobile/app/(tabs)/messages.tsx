import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, Animated,
  Clipboard, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useChainChat } from "@/contexts/ChainChatContext";
import { shortenAddress, currentBlockHeight } from "@/utils/chainAddress";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const BG      = "#07070e";
const CARD    = "#0d0d1a";
const CARD2   = "#111128";
const BORDER  = "#1a1a35";
const ACCENT  = "#00FF87";
const PURPLE  = "#7c3aed";
const BLUE    = "#3b82f6";
const MUTED   = "#4b5563";
const FG      = "#e8e8f8";
const FG2     = "#9ca3af";

interface OtherUser {
  id: number;
  displayName: string | null;
  walletAddress: string | null;
  publicKey: string | null;
}
interface Conversation {
  id: number;
  chainId: string | null;
  lastMessageAt: string;
  messageCount: number;
  other: OtherUser;
  lastMessage: { txHash: string | null; blockHeight: number; senderId: number; createdAt: string } | null;
}
interface SearchUser {
  id: number;
  displayName: string | null;
  walletAddress: string | null;
  publicKey: string | null;
}

function initials(name: string | null, addr: string | null) {
  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2);
  }
  if (addr) return addr.slice(4, 6).toUpperCase();
  return "??";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BlockTicker({ block }: { block: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [block]);
  return (
    <Animated.View style={{ opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }}>
      <Text style={[s.blockNum, { color: ACCENT }]}>#{block.toLocaleString()}</Text>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, isAuthenticated, user } = useAppAuth();
  const { wallet, isReady, isRegistered, register } = useChainChat();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockHeight, setBlockHeight] = useState(currentBlockHeight());
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setBlockHeight(currentBlockHeight()), 2000);
    return () => clearInterval(t);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const r = await fetch(`${API_BASE}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { const d = await r.json(); setConversations(d.conversations ?? []); }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      if (!token) return;
      setSearching(true);
      try {
        const r = await fetch(`${API_BASE}/api/chat/users/search?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) { const d = await r.json(); setSearchResults(d.users ?? []); }
      } catch {}
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, token]);

  const startChat = useCallback(async (recipientId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientId }),
      });
      if (r.ok) {
        const d = await r.json();
        setShowSearch(false); setSearch(""); setSearchResults([]);
        router.push(`/chat/${d.conversation.id}`);
      }
    } catch {}
  }, [token, router]);

  const handleRegister = useCallback(async () => {
    setRegistering(true);
    await register();
    setRegistering(false);
  }, [register]);

  if (!isAuthenticated) {
    return (
      <View style={[s.guestRoot, { backgroundColor: BG, paddingTop: insets.top }]}>
        <View style={[s.chainBadge, { borderColor: ACCENT + "33" }]}>
          <Feather name="shield" size={14} color={ACCENT} />
          <Text style={[s.chainBadgeText, { color: ACCENT }]}>ZBX Chain Messaging</Text>
        </View>
        <View style={[s.lockIcon, { borderColor: BORDER }]}>
          <Feather name="lock" size={32} color={PURPLE} />
        </View>
        <Text style={[s.guestTitle, { color: FG }]}>On-Chain Encrypted Chat</Text>
        <Text style={[s.guestSubtitle, { color: FG2 }]}>
          Every message is a permanent blockchain transaction — immutable, end-to-end encrypted, forever.
        </Text>
        <View style={s.featureList}>
          {[
            { icon: "key", text: "Wallet address = your permanent Chat ID" },
            { icon: "lock", text: "X25519 end-to-end encryption" },
            { icon: "link", text: "Every message has a unique TxHash" },
            { icon: "database", text: "Immutable — no one can delete" },
          ].map((f, i) => (
            <View key={i} style={[s.featureRow, { borderColor: BORDER }]}>
              <View style={[s.featureIcon, { backgroundColor: PURPLE + "22" }]}>
                <Feather name={f.icon as any} size={14} color={PURPLE} />
              </View>
              <Text style={[s.featureText, { color: FG2 }]}>{f.text}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[s.signInBtn, { backgroundColor: ACCENT }]}
          onPress={() => router.push("/(auth)?mode=login")}
        >
          <Feather name="log-in" size={16} color="#000" />
          <Text style={[s.signInBtnText, { color: "#000" }]}>Connect Wallet & Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: BG, paddingTop: insets.top }]}>
      {/* Chain header */}
      <View style={[s.header, { borderBottomColor: BORDER }]}>
        <View style={{ flex: 1 }}>
          <View style={s.headerTop}>
            <View style={[s.chainDot, { backgroundColor: ACCENT }]} />
            <Text style={[s.headerTitle, { color: FG }]}>ZBX Messages</Text>
          </View>
          <View style={s.headerMeta}>
            <Text style={[s.headerMetaText, { color: MUTED }]}>Block </Text>
            <BlockTicker block={blockHeight} />
            <Text style={[s.headerMetaSep, { color: MUTED }]}>·</Text>
            <View style={[s.e2eBadge, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
              <Feather name="lock" size={9} color={ACCENT} />
              <Text style={[s.e2eText, { color: ACCENT }]}>E2E Encrypted</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[s.newChatBtn, { borderColor: ACCENT + "40", backgroundColor: ACCENT + "12" }]}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Feather name={showSearch ? "x" : "edit-2"} size={17} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Registration banner */}
      {isReady && !isRegistered && (
        <TouchableOpacity
          style={[s.registerBanner, { backgroundColor: PURPLE + "18", borderColor: PURPLE + "40" }]}
          onPress={handleRegister}
          disabled={registering}
        >
          <View style={[s.registerIcon, { backgroundColor: PURPLE + "30" }]}>
            <Feather name="link" size={14} color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.registerTitle, { color: FG }]}>Register Wallet on ZBX Chain</Text>
            <Text style={[s.registerSub, { color: FG2 }]}>One-time permanent registration · Cannot be changed</Text>
          </View>
          {registering
            ? <ActivityIndicator size="small" color={PURPLE} />
            : <Feather name="chevron-right" size={16} color={PURPLE} />
          }
        </TouchableOpacity>
      )}

      {/* New chat search */}
      {showSearch && (
        <View style={[s.searchWrap, { backgroundColor: CARD, borderColor: BORDER }]}>
          <View style={[s.searchBox, { borderColor: BORDER }]}>
            <Feather name="search" size={14} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.searchInput, { color: FG }]}
              placeholder="Wallet address or display name..."
              placeholderTextColor={MUTED}
              value={search}
              onChangeText={setSearch}
              autoFocus
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator size="small" color={ACCENT} />}
          </View>
          {searchResults.length > 0 && searchResults.map(u => (
            <TouchableOpacity
              key={u.id}
              style={[s.searchRow, { borderTopColor: BORDER }]}
              onPress={() => startChat(u.id)}
              activeOpacity={0.75}
            >
              <View style={[s.searchAvatar, { backgroundColor: PURPLE + "22" }]}>
                <Text style={[s.searchAvatarText, { color: PURPLE }]}>
                  {initials(u.displayName, u.walletAddress)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.searchName, { color: FG }]}>{u.displayName ?? "ZBX User"}</Text>
                {u.walletAddress && (
                  <Text style={[s.searchAddr, { color: MUTED }]}>{shortenAddress(u.walletAddress)}</Text>
                )}
              </View>
              {!u.publicKey && (
                <View style={[s.noKeyBadge, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b30" }]}>
                  <Text style={{ color: "#f59e0b", fontSize: 10 }}>No key</Text>
                </View>
              )}
              <Feather name="arrow-right" size={14} color={MUTED} />
            </TouchableOpacity>
          ))}
          {search.length >= 2 && searchResults.length === 0 && !searching && (
            <View style={[s.noResults, { borderTopColor: BORDER }]}>
              <Text style={[s.noResultsText, { color: MUTED }]}>No users found</Text>
            </View>
          )}
        </View>
      )}

      {/* Conversations */}
      {loading ? (
        <View style={s.loadCenter}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={[s.loadText, { color: MUTED }]}>Syncing chain data...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.emptyRoot}>
          <View style={[s.emptyIcon, { borderColor: BORDER, backgroundColor: CARD }]}>
            <Feather name="message-square" size={36} color={MUTED} />
          </View>
          <Text style={[s.emptyTitle, { color: FG }]}>No on-chain messages yet</Text>
          <Text style={[s.emptySubtitle, { color: FG2 }]}>
            Tap the compose icon to start an encrypted conversation on ZBX Chain
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => String(i.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchConversations(); }}
              tintColor={ACCENT}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.convRow, { borderBottomColor: BORDER }]}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={[s.convAvatar, { backgroundColor: PURPLE + "20", borderColor: PURPLE + "40" }]}>
                <Text style={[s.convAvatarText, { color: PURPLE }]}>
                  {initials(item.other?.displayName ?? null, item.other?.walletAddress ?? null)}
                </Text>
                <View style={[s.onlineIndicator, { backgroundColor: ACCENT }]} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.convRow1}>
                  <Text style={[s.convName, { color: FG }]} numberOfLines={1}>
                    {item.other?.displayName ?? "ZBX Wallet"}
                  </Text>
                  <Text style={[s.convTime, { color: MUTED }]}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                <View style={s.convRow2}>
                  {item.other?.walletAddress ? (
                    <Text style={[s.convAddr, { color: MUTED }]}>
                      {shortenAddress(item.other.walletAddress, 10, 6)}
                    </Text>
                  ) : (
                    <Text style={[s.convAddr, { color: MUTED }]}>Unregistered</Text>
                  )}
                  <View style={s.convRight}>
                    {item.lastMessage?.txHash && (
                      <View style={[s.txBadge, { backgroundColor: BLUE + "15", borderColor: BLUE + "30" }]}>
                        <Text style={[s.txBadgeText, { color: BLUE }]}>
                          {item.lastMessage.txHash.slice(0, 6)}…
                        </Text>
                      </View>
                    )}
                    {item.messageCount > 0 && (
                      <Text style={[s.msgCount, { color: MUTED }]}>{item.messageCount} msgs</Text>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* My wallet footer */}
      {wallet && (
        <View style={[s.walletFooter, { borderTopColor: BORDER, backgroundColor: CARD, paddingBottom: insets.bottom + 6 }]}>
          <View style={[s.walletAddrRow]}>
            <View style={[s.walletDot, { backgroundColor: isRegistered ? ACCENT : MUTED }]} />
            <Text style={[s.walletLabel, { color: MUTED }]}>My Wallet  </Text>
            <Text style={[s.walletAddr, { color: FG2 }]} numberOfLines={1}>
              {shortenAddress(wallet.address, 10, 8)}
            </Text>
          </View>
          {isRegistered && (
            <View style={[s.registeredBadge, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "30" }]}>
              <Feather name="check" size={9} color={ACCENT} />
              <Text style={[s.registeredText, { color: ACCENT }]}>On-Chain</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  headerTop:        { flexDirection: "row", alignItems: "center", gap: 8 },
  chainDot:         { width: 7, height: 7, borderRadius: 4 },
  headerTitle:      { fontSize: 20, fontWeight: "700" },
  headerMeta:       { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  headerMetaText:   { fontSize: 11 },
  headerMetaSep:    { fontSize: 11 },
  blockNum:         { fontSize: 11, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  e2eBadge:         { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  e2eText:          { fontSize: 9, fontWeight: "700" },
  newChatBtn:       { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  registerBanner:   { flexDirection: "row", alignItems: "center", gap: 10, margin: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  registerIcon:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  registerTitle:    { fontSize: 13, fontWeight: "600" },
  registerSub:      { fontSize: 11, marginTop: 2 },
  searchWrap:       { margin: 12, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  searchBox:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0 },
  searchInput:      { flex: 1, fontSize: 14 },
  searchRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  searchAvatar:     { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  searchAvatarText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  searchName:       { fontSize: 14, fontWeight: "600" },
  searchAddr:       { fontSize: 11, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  noKeyBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  noResults:        { padding: 14, alignItems: "center", borderTopWidth: 1 },
  noResultsText:    { fontSize: 13 },
  loadCenter:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadText:         { fontSize: 13 },
  emptyRoot:        { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  emptyIcon:        { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 20 },
  emptyTitle:       { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle:    { fontSize: 13, textAlign: "center", marginTop: 10, lineHeight: 20 },
  convRow:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  convAvatar:       { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  convAvatarText:   { fontSize: 16, fontWeight: "700", textTransform: "uppercase" },
  onlineIndicator:  { position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: BG },
  convRow1:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convRow2:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  convName:         { fontSize: 15, fontWeight: "600", flex: 1 },
  convTime:         { fontSize: 11, marginLeft: 8 },
  convAddr:         { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", flex: 1 },
  convRight:        { flexDirection: "row", alignItems: "center", gap: 6 },
  txBadge:          { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  txBadgeText:      { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "600" },
  msgCount:         { fontSize: 10 },
  walletFooter:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  walletAddrRow:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  walletDot:        { width: 7, height: 7, borderRadius: 4 },
  walletLabel:      { fontSize: 11 },
  walletAddr:       { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", flex: 1 },
  registeredBadge:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  registeredText:   { fontSize: 10, fontWeight: "700" },
  guestRoot:        { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 60 },
  chainBadge:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 32 },
  chainBadgeText:   { fontSize: 12, fontWeight: "700" },
  lockIcon:         { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 20 },
  guestTitle:       { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  guestSubtitle:    { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  featureList:      { width: "100%", gap: 10, marginBottom: 32 },
  featureRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, borderWidth: 1 },
  featureIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  featureText:      { flex: 1, fontSize: 13, lineHeight: 18 },
  signInBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 15, paddingHorizontal: 36, borderRadius: 16 },
  signInBtnText:    { fontSize: 15, fontWeight: "700" },
});
