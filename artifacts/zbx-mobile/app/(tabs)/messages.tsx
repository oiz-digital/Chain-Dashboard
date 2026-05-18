import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useChatCrypto } from "@/contexts/ChatCryptoContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const ACCENT = "#00FF87";
const BG     = "#0a0a0f";
const CARD   = "#111118";
const BORDER = "#1e1e2e";
const MUTED  = "#6b7280";
const FG     = "#f4f4f8";

interface OtherUser { id: number; displayName: string | null; chatId: string | null; publicKey: string | null; }
interface Conversation {
  id: number; participant1Id: number; participant2Id: number;
  lastMessageAt: string; other: OtherUser;
  lastMessage: { encryptedContent: string; senderId: number; createdAt: string } | null;
}
interface SearchUser { id: number; displayName: string | null; chatId: string | null; publicKey: string | null; }

function avatar(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name[0];
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

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, isAuthenticated, user } = useAppAuth();
  const { keyPair } = useChatCrypto();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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
        setShowSearch(false);
        setSearch("");
        setSearchResults([]);
        router.push(`/chat/${d.conversation.id}`);
      }
    } catch {}
  }, [token, router]);

  if (!isAuthenticated) {
    return (
      <View style={[s.center, { backgroundColor: BG, paddingTop: insets.top }]}>
        <Feather name="lock" size={48} color={MUTED} />
        <Text style={[s.emptyTitle, { color: FG }]}>Sign in to use Messages</Text>
        <Text style={[s.emptySubtitle, { color: MUTED }]}>End-to-end encrypted chats on ZBX Chain</Text>
        <TouchableOpacity style={[s.signInBtn, { backgroundColor: ACCENT }]} onPress={() => router.push("/(auth)?mode=login")}>
          <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: BG, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: FG }]}>Messages</Text>
          <Text style={[s.headerSub, { color: ACCENT }]}>🔒 End-to-end encrypted</Text>
        </View>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "40" }]}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Feather name={showSearch ? "x" : "edit"} size={18} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {/* New Chat search */}
      {showSearch && (
        <View style={[s.searchBox, { borderColor: BORDER, backgroundColor: CARD }]}>
          <Feather name="search" size={15} color={MUTED} style={{ marginRight: 8 }} />
          <TextInput
            style={[s.searchInput, { color: FG }]}
            placeholder="Search by name or @chatid..."
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color={ACCENT} />}
        </View>
      )}
      {showSearch && searchResults.length > 0 && (
        <View style={[s.searchResults, { backgroundColor: CARD, borderColor: BORDER }]}>
          {searchResults.map(u => (
            <TouchableOpacity
              key={u.id}
              style={[s.searchRow, { borderBottomColor: BORDER }]}
              onPress={() => startChat(u.id)}
            >
              <View style={[s.avatar, { backgroundColor: ACCENT + "22" }]}>
                <Text style={[s.avatarText, { color: ACCENT }]}>{avatar(u.displayName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.convName, { color: FG }]}>{u.displayName ?? "ZBX User"}</Text>
                {u.chatId && <Text style={[s.chatIdTag, { color: MUTED }]}>@{u.chatId}</Text>}
              </View>
              {!u.publicKey && (
                <View style={[s.nkBadge, { backgroundColor: "#f59e0b22" }]}>
                  <Text style={{ color: "#f59e0b", fontSize: 10 }}>No key</Text>
                </View>
              )}
              <Feather name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {showSearch && search.length >= 2 && searchResults.length === 0 && !searching && (
        <View style={[s.emptySearch, { backgroundColor: CARD, borderColor: BORDER }]}>
          <Text style={{ color: MUTED, fontSize: 13 }}>No users found for "{search}"</Text>
        </View>
      )}

      {/* Conversation List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <Feather name="message-circle" size={56} color={MUTED + "66"} />
          <Text style={[s.emptyTitle, { color: FG }]}>No conversations yet</Text>
          <Text style={[s.emptySubtitle, { color: MUTED }]}>
            Tap the edit icon to start a new encrypted chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConversations(); }} tintColor={ACCENT} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.convRow, { borderBottomColor: BORDER }]}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={[s.avatar, { backgroundColor: ACCENT + "18" }]}>
                <Text style={[s.avatarText, { color: ACCENT }]}>
                  {avatar(item.other?.displayName)}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.convTopRow}>
                  <Text style={[s.convName, { color: FG }]} numberOfLines={1}>
                    {item.other?.displayName ?? "ZBX User"}
                  </Text>
                  {item.lastMessage && (
                    <Text style={[s.convTime, { color: MUTED }]}>
                      {timeAgo(item.lastMessage.createdAt)}
                    </Text>
                  )}
                </View>
                <View style={s.convBottomRow}>
                  {item.other?.chatId && (
                    <Text style={[s.chatIdTag, { color: MUTED + "99" }]}>@{item.other.chatId}</Text>
                  )}
                  {item.lastMessage && (
                    <View style={s.encryptedBadge}>
                      <Feather name="lock" size={10} color={ACCENT} />
                      <Text style={[s.encryptedText, { color: ACCENT }]}>Encrypted</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* My Chat ID card */}
      {user && (
        <View style={[s.myChatId, { backgroundColor: CARD, borderColor: BORDER, paddingBottom: insets.bottom + 8 }]}>
          <Feather name="user" size={13} color={MUTED} />
          <Text style={[{ color: MUTED, fontSize: 12, marginLeft: 6 }]}>
            Your Chat ID: <Text style={{ color: FG }}>{user.displayName ?? user.email}</Text>
          </Text>
          {keyPair && (
            <View style={[s.keyReadyBadge, { backgroundColor: ACCENT + "18" }]}>
              <Feather name="shield" size={10} color={ACCENT} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:    { fontSize: 22, fontWeight: "700" },
  headerSub:      { fontSize: 11, marginTop: 2 },
  newBtn:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  searchBox:      { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: 14 },
  searchResults:  { marginHorizontal: 16, borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  searchRow:      { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1 },
  emptySearch:    { marginHorizontal: 16, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 8 },
  convRow:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  convTopRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convBottomRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  convName:       { fontSize: 15, fontWeight: "600", flex: 1 },
  convTime:       { fontSize: 11, marginLeft: 8 },
  chatIdTag:      { fontSize: 11 },
  encryptedBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  encryptedText:  { fontSize: 10, fontWeight: "600" },
  avatar:         { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText:     { fontSize: 16, fontWeight: "700", textTransform: "uppercase" },
  nkBadge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  emptyTitle:     { fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" },
  emptySubtitle:  { fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20 },
  signInBtn:      { marginTop: 24, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  myChatId:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  keyReadyBadge:  { marginLeft: "auto", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
