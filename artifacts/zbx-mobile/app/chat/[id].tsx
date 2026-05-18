import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useChatCrypto } from "@/contexts/ChatCryptoContext";
import { encryptMessage, decryptMessage } from "@/utils/crypto";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const ACCENT  = "#00FF87";
const BG      = "#0a0a0f";
const CARD    = "#111118";
const BORDER  = "#1e1e2e";
const MUTED   = "#6b7280";
const FG      = "#f4f4f8";
const ME_BG   = "#00FF8722";
const THEM_BG = "#1a1a2e";

interface OtherUser {
  id: number;
  displayName: string | null;
  chatId: string | null;
  publicKey: string | null;
}

interface RawMessage {
  id: number;
  conversationId: number;
  senderId: number;
  encryptedContent: string;
  nonce: string;
  createdAt: string;
}

interface DecryptedMessage extends RawMessage {
  plaintext: string | null;
}

function avatar(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name[0];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAppAuth();
  const { keyPair } = useChatCrypto();

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [other, setOther] = useState<OtherUser | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const decryptAll = useCallback(
    (raw: RawMessage[], otherPubKey: string | null): DecryptedMessage[] => {
      if (!keyPair) return raw.map(m => ({ ...m, plaintext: null }));
      return raw.map(m => {
        const isMe = m.senderId === user?.id;
        const senderPubKey = isMe ? keyPair.publicKey : (otherPubKey ?? "");
        const recipientSecret = keyPair.secretKey;
        if (!senderPubKey) return { ...m, plaintext: null };
        const plain = decryptMessage(m.encryptedContent, m.nonce, senderPubKey ?? "", recipientSecret);
        return { ...m, plaintext: plain };
      });
    },
    [keyPair, user?.id]
  );

  const fetchMessages = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await fetch(`${API_BASE}/api/chat/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      const otherUser: OtherUser = d.other;
      setOther(otherUser);
      if (!otherUser?.publicKey) setNoKey(true);
      const decrypted = decryptAll(d.messages ?? [], otherUser?.publicKey ?? null);
      setMessages(decrypted);
    } catch {}
    setLoading(false);
  }, [token, id, decryptAll]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !token || !keyPair || !other?.publicKey || !id) return;
    setSending(true);
    try {
      const { encrypted, nonce } = encryptMessage(input.trim(), other.publicKey, keyPair.secretKey);
      const r = await fetch(`${API_BASE}/api/chat/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encryptedContent: encrypted, nonce }),
      });
      if (r.ok) {
        setInput("");
        await fetchMessages();
      }
    } catch {}
    setSending(false);
  }, [input, token, keyPair, other, id, fetchMessages]);

  const renderMessage = ({ item, index }: { item: DecryptedMessage; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevMsg || prevMsg.senderId !== item.senderId;

    return (
      <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
        {!isMe && (
          <View style={[s.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
            <Text style={[s.msgAvatarText, { color: ACCENT }]}>{avatar(other?.displayName ?? null)}</Text>
          </View>
        )}
        <View style={[s.bubble, isMe ? [s.bubbleMe, { backgroundColor: ME_BG, borderColor: ACCENT + "33" }] : [s.bubbleThem, { backgroundColor: THEM_BG, borderColor: BORDER }]]}>
          {item.plaintext !== null ? (
            <Text style={[s.bubbleText, { color: isMe ? ACCENT : FG }]}>{item.plaintext}</Text>
          ) : (
            <View style={s.encFail}>
              <Feather name="lock" size={12} color={MUTED} />
              <Text style={[s.encFailText, { color: MUTED }]}>Encrypted message</Text>
            </View>
          )}
          <Text style={[s.bubbleTime, { color: isMe ? ACCENT + "99" : MUTED }]}>{formatTime(item.createdAt)}</Text>
        </View>
        {isMe && <View style={s.msgAvatarPlaceholder} />}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: BG }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: BORDER, backgroundColor: CARD }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={FG} />
        </TouchableOpacity>
        <View style={[s.headerAvatar, { backgroundColor: ACCENT + "22" }]}>
          <Text style={[s.headerAvatarText, { color: ACCENT }]}>{avatar(other?.displayName ?? null)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.headerName, { color: FG }]} numberOfLines={1}>
            {other?.displayName ?? "ZBX User"}
          </Text>
          <View style={s.headerSub}>
            <Feather name="shield" size={10} color={ACCENT} />
            <Text style={[s.headerSubText, { color: ACCENT }]}>End-to-end encrypted</Text>
            {other?.chatId && (
              <Text style={[{ color: MUTED, fontSize: 11, marginLeft: 6 }]}>@{other.chatId}</Text>
            )}
          </View>
        </View>
      </View>

      {/* No key warning */}
      {noKey && (
        <View style={[s.noKeyBanner, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b44" }]}>
          <Feather name="alert-triangle" size={14} color="#f59e0b" />
          <Text style={[s.noKeyText, { color: "#f59e0b" }]}>
            This user hasn't set up encryption keys yet. Messages cannot be sent.
          </Text>
        </View>
      )}

      {/* Encryption notice */}
      {!loading && messages.length === 0 && !noKey && (
        <View style={s.encNotice}>
          <View style={[s.encNoticeBadge, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "30" }]}>
            <Feather name="lock" size={13} color={ACCENT} />
            <Text style={[s.encNoticeText, { color: ACCENT }]}>
              Messages are end-to-end encrypted with X25519 + XSalsa20. Only you and{" "}
              {other?.displayName ?? "the recipient"} can read them.
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={[s.msgList, { paddingBottom: 16 }]}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { borderTopColor: BORDER, backgroundColor: CARD, paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.inputWrap, { borderColor: BORDER, backgroundColor: BG }]}>
          <Feather name="lock" size={13} color={ACCENT + "88"} style={{ marginHorizontal: 10 }} />
          <TextInput
            style={[s.input, { color: FG }]}
            placeholder={other?.publicKey ? "Type a message..." : "Cannot send — no encryption key"}
            placeholderTextColor={MUTED}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={!!other?.publicKey && !!keyPair}
            returnKeyType="send"
            onSubmitEditing={Platform.OS !== "web" ? sendMessage : undefined}
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: input.trim() && other?.publicKey && keyPair ? ACCENT : ACCENT + "33" }]}
          onPress={sendMessage}
          disabled={!input.trim() || !other?.publicKey || !keyPair || sending}
          activeOpacity={0.8}
        >
          {sending ? <ActivityIndicator size="small" color="#000" /> : <Feather name="send" size={18} color={input.trim() ? "#000" : MUTED} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1 },
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:           { padding: 4, marginRight: 4 },
  headerAvatar:      { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerAvatarText:  { fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  headerName:        { fontSize: 16, fontWeight: "700" },
  headerSub:         { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerSubText:     { fontSize: 10, fontWeight: "600" },
  noKeyBanner:       { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  noKeyText:         { flex: 1, fontSize: 12, lineHeight: 18 },
  encNotice:         { alignItems: "center", paddingHorizontal: 24, paddingTop: 40 },
  encNoticeBadge:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  encNoticeText:     { flex: 1, fontSize: 12, lineHeight: 18 },
  loadingCenter:     { flex: 1, alignItems: "center", justifyContent: "center" },
  msgList:           { paddingHorizontal: 12, paddingTop: 12 },
  msgRow:            { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  msgRowMe:          { justifyContent: "flex-end" },
  msgRowThem:        { justifyContent: "flex-start" },
  msgAvatar:         { width: 28, height: 28, borderRadius: 14, backgroundColor: "#00FF8718", alignItems: "center", justifyContent: "center", marginRight: 6 },
  msgAvatarText:     { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  msgAvatarPlaceholder: { width: 28 },
  bubble:            { maxWidth: "72%", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  bubbleMe:          { borderBottomRightRadius: 4 },
  bubbleThem:        { borderBottomLeftRadius: 4 },
  bubbleText:        { fontSize: 15, lineHeight: 22 },
  bubbleTime:        { fontSize: 10, marginTop: 4, textAlign: "right" },
  encFail:           { flexDirection: "row", alignItems: "center", gap: 6 },
  encFailText:       { fontSize: 13, fontStyle: "italic" },
  inputBar:          { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  inputWrap:         { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 22, paddingVertical: 8, paddingRight: 12, minHeight: 44 },
  input:             { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: Platform.OS === "ios" ? 2 : 0 },
  sendBtn:           { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
