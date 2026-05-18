import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Clipboard, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAppAuth } from "@/contexts/AppAuthContext";
import { useChainChat } from "@/contexts/ChainChatContext";
import { encryptMessage, decryptMessage, shortenAddress, formatTxHash, currentBlockHeight } from "@/utils/chainAddress";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const BG      = "#07070e";
const CARD    = "#0d0d1a";
const CARD2   = "#0f0f1e";
const BORDER  = "#1a1a35";
const ACCENT  = "#00FF87";
const PURPLE  = "#7c3aed";
const BLUE    = "#3b82f6";
const MUTED   = "#4b5563";
const FG      = "#e8e8f8";
const FG2     = "#9ca3af";
const ME_BG   = "#00362299";
const THEM_BG = "#111128";

interface OtherUser {
  id: number;
  displayName: string | null;
  walletAddress: string | null;
  publicKey: string | null;
}

interface RawMessage {
  id: number;
  conversationId: number;
  senderId: number;
  encryptedContent: string;
  nonce: string;
  txHash: string | null;
  blockHeight: number;
  chainConfirmed: boolean;
  createdAt: string;
}

interface DecryptedMessage extends RawMessage {
  plaintext: string | null;
}

function initials(name: string | null, addr: string | null) {
  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2);
  }
  if (addr) return addr.slice(4, 6).toUpperCase();
  return "?";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function TxHashBadge({ hash, blockHeight }: { hash: string | null; blockHeight: number }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return null;
  const copy = () => {
    Clipboard.setString(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <TouchableOpacity style={s.txRow} onPress={copy} activeOpacity={0.7}>
      <Feather name="link-2" size={9} color={BLUE} />
      <Text style={[s.txHash, { color: BLUE }]}>{formatTxHash(hash)}</Text>
      <Text style={[s.txBlock, { color: MUTED }]}>· #{blockHeight.toLocaleString()}</Text>
      <Feather name={copied ? "check" : "copy"} size={9} color={copied ? ACCENT : MUTED} style={{ marginLeft: 3 }} />
    </TouchableOpacity>
  );
}

function BroadcastOverlay({ visible, blockHeight }: { visible: boolean; blockHeight: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      anim.setValue(0);
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={[s.broadcastRow]}>
      <Animated.View style={[s.broadcastDot, { backgroundColor: ACCENT, opacity: anim }]} />
      <Text style={[s.broadcastText, { color: ACCENT }]}>
        Broadcasting to ZBX Chain · Block #{blockHeight.toLocaleString()}
      </Text>
    </View>
  );
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { wallet } = useChainChat();
  const token = useAppAuth().token;

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [other, setOther] = useState<OtherUser | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [blockHeight, setBlockHeight] = useState(currentBlockHeight());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [confirmedHash, setConfirmedHash] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setBlockHeight(currentBlockHeight()), 2000);
    return () => clearInterval(t);
  }, []);

  const decryptAll = useCallback(
    (raw: RawMessage[], otherPubKey: string | null): DecryptedMessage[] => {
      if (!wallet) return raw.map(m => ({ ...m, plaintext: null }));
      return raw.map(m => {
        const isMe = m.senderId === user?.id;
        const senderPub = isMe ? wallet.publicKey : (otherPubKey ?? "");
        if (!senderPub) return { ...m, plaintext: null };
        const plain = decryptMessage(m.encryptedContent, m.nonce, senderPub, wallet.secretKey);
        return { ...m, plaintext: plain };
      });
    },
    [wallet, user?.id]
  );

  const fetchMessages = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await fetch(`${API_BASE}/api/chat/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setOther(d.other);
      setChainId(d.chainId ?? null);
      setMessages(decryptAll(d.messages ?? [], d.other?.publicKey ?? null));
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
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !token || !wallet || !other?.publicKey || !id) return;
    setSending(true);
    setBroadcasting(true);
    try {
      const { encrypted, nonce } = encryptMessage(input.trim(), other.publicKey, wallet.secretKey);
      setInput("");
      await new Promise(r => setTimeout(r, 600));
      const r = await fetch(`${API_BASE}/api/chat/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encryptedContent: encrypted, nonce }),
      });
      if (r.ok) {
        const d = await r.json();
        setConfirmedHash(d.txHash ?? null);
        setTimeout(() => setConfirmedHash(null), 3000);
        await fetchMessages();
      }
    } catch {}
    setBroadcasting(false);
    setSending(false);
  }, [input, token, wallet, other, id, fetchMessages]);

  const noKey = !other?.publicKey;

  const renderMessage = ({ item, index }: { item: DecryptedMessage; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const showSender = !prev || prev.senderId !== item.senderId;

    return (
      <View style={[s.msgOuter, isMe ? s.msgOuterMe : s.msgOuterThem]}>
        {!isMe && (
          <View style={[s.msgAvatarWrap, { opacity: showSender ? 1 : 0 }]}>
            <View style={[s.msgAvatar, { backgroundColor: PURPLE + "25", borderColor: PURPLE + "40" }]}>
              <Text style={[s.msgAvatarText, { color: PURPLE }]}>
                {initials(other?.displayName ?? null, other?.walletAddress ?? null)}
              </Text>
            </View>
          </View>
        )}
        <View style={[
          s.bubble,
          isMe
            ? [s.bubbleMe, { backgroundColor: ME_BG, borderColor: ACCENT + "30" }]
            : [s.bubbleThem, { backgroundColor: THEM_BG, borderColor: BORDER }],
        ]}>
          {item.plaintext !== null ? (
            <Text style={[s.bubbleText, { color: isMe ? "#c8ffd8" : FG }]}>{item.plaintext}</Text>
          ) : (
            <View style={s.encFail}>
              <Feather name="lock" size={11} color={MUTED} />
              <Text style={[s.encFailText, { color: MUTED }]}>Encrypted message</Text>
            </View>
          )}
          <View style={s.bubbleMeta}>
            <Text style={[s.bubbleTime, { color: isMe ? ACCENT + "80" : MUTED }]}>
              {formatTime(item.createdAt)}
            </Text>
            {item.chainConfirmed && (
              <View style={s.confirmedBadge}>
                <Feather name="check-circle" size={9} color={isMe ? ACCENT : MUTED} />
                <Text style={[s.confirmedText, { color: isMe ? ACCENT : MUTED }]}>Confirmed</Text>
              </View>
            )}
          </View>
          <TxHashBadge hash={item.txHash ?? null} blockHeight={item.blockHeight} />
        </View>
        {isMe && <View style={{ width: 32 }} />}
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
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: CARD, borderBottomColor: BORDER }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={FG} />
        </TouchableOpacity>
        <View style={[s.headerAvatar, { backgroundColor: PURPLE + "22", borderColor: PURPLE + "44" }]}>
          <Text style={[s.headerAvatarText, { color: PURPLE }]}>
            {initials(other?.displayName ?? null, other?.walletAddress ?? null)}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.headerName, { color: FG }]} numberOfLines={1}>
            {other?.displayName ?? "ZBX Wallet"}
          </Text>
          {other?.walletAddress ? (
            <TouchableOpacity
              onPress={() => other?.walletAddress && Clipboard.setString(other.walletAddress)}
              activeOpacity={0.7}
            >
              <Text style={[s.headerAddr, { color: MUTED }]}>
                {shortenAddress(other.walletAddress, 12, 8)}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[s.headerAddr, { color: MUTED }]}>No wallet registered</Text>
          )}
        </View>
        <View style={[s.headerBadge, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
          <Feather name="lock" size={9} color={ACCENT} />
          <Text style={[s.headerBadgeText, { color: ACCENT }]}>E2E</Text>
        </View>
        <View style={[s.headerBadge, { backgroundColor: BLUE + "15", borderColor: BLUE + "30", marginLeft: 6 }]}>
          <Text style={[s.headerBadgeText, { color: BLUE }]}>#{blockHeight.toLocaleString()}</Text>
        </View>
      </View>

      {/* Chain ID banner */}
      {chainId && (
        <View style={[s.chainIdBar, { backgroundColor: CARD2, borderBottomColor: BORDER }]}>
          <Feather name="link" size={10} color={MUTED} />
          <Text style={[s.chainIdText, { color: MUTED }]} numberOfLines={1}>
            Channel: zbx-dm-{chainId.slice(8, 20)}…
          </Text>
          <View style={[s.immutableBadge, { backgroundColor: PURPLE + "18", borderColor: PURPLE + "30" }]}>
            <Feather name="shield" size={9} color={PURPLE} />
            <Text style={[s.immutableText, { color: PURPLE }]}>Immutable</Text>
          </View>
        </View>
      )}

      {/* No key warning */}
      {noKey && (
        <View style={[s.noKeyBanner, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b35" }]}>
          <Feather name="alert-triangle" size={14} color="#f59e0b" />
          <Text style={[s.noKeyText, { color: "#f59e0b" }]}>
            This wallet hasn't registered encryption keys on ZBX Chain yet.
          </Text>
        </View>
      )}

      {/* Confirmed hash toast */}
      {confirmedHash && (
        <View style={[s.confirmedToast, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
          <Feather name="check-circle" size={13} color={ACCENT} />
          <Text style={[s.confirmedToastText, { color: ACCENT }]}>
            Confirmed · {formatTxHash(confirmedHash)} · #{blockHeight.toLocaleString()}
          </Text>
        </View>
      )}

      {/* First message notice */}
      {!loading && messages.length === 0 && !noKey && (
        <View style={s.encNotice}>
          <View style={[s.encNoticeBadge, { backgroundColor: CARD, borderColor: BORDER }]}>
            <Feather name="shield" size={14} color={PURPLE} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.encNoticeTitle, { color: FG }]}>End-to-End Encrypted · On-Chain</Text>
              <Text style={[s.encNoticeText, { color: FG2 }]}>
                Messages are encrypted with X25519 and stored permanently on ZBX Chain.
                Only you and {other?.displayName ?? "the recipient"} can read them.
                Neither the server nor anyone else can decrypt your messages.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={s.loadCenter}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={[s.loadText, { color: MUTED }]}>Fetching chain data...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={s.msgList}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Broadcasting animation */}
      <BroadcastOverlay visible={broadcasting} blockHeight={blockHeight} />

      {/* Input bar */}
      <View style={[s.inputBar, { borderTopColor: BORDER, backgroundColor: CARD, paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.inputWrap, { borderColor: noKey ? BORDER : ACCENT + "30", backgroundColor: BG }]}>
          <Feather
            name={noKey ? "alert-circle" : "lock"}
            size={13}
            color={noKey ? MUTED : ACCENT + "80"}
            style={{ marginLeft: 12, marginRight: 8 }}
          />
          <TextInput
            style={[s.input, { color: FG }]}
            placeholder={
              noKey
                ? "Cannot send — wallet not registered"
                : !wallet
                ? "Initializing chain wallet..."
                : "Message · Encrypted on ZBX Chain"
            }
            placeholderTextColor={MUTED}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={!noKey && !!wallet && !sending}
            returnKeyType="send"
            onSubmitEditing={Platform.OS !== "web" ? sendMessage : undefined}
          />
        </View>
        <TouchableOpacity
          style={[
            s.sendBtn,
            {
              backgroundColor:
                input.trim() && !noKey && wallet && !sending ? ACCENT : CARD2,
              borderColor: input.trim() && !noKey && wallet ? ACCENT + "60" : BORDER,
            },
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || noKey || !wallet || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color={ACCENT} />
            : <Feather name="send" size={17} color={input.trim() && !noKey && wallet ? "#000" : MUTED} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const MONO = Platform.OS === "ios" ? "Courier" : "monospace";

const s = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn:          { padding: 4 },
  headerAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerAvatarText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  headerName:       { fontSize: 15, fontWeight: "700" },
  headerAddr:       { fontSize: 10, marginTop: 2, fontFamily: MONO },
  headerBadge:      { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  headerBadgeText:  { fontSize: 9, fontWeight: "700", fontFamily: MONO },
  chainIdBar:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  chainIdText:      { flex: 1, fontSize: 10, fontFamily: MONO },
  immutableBadge:   { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  immutableText:    { fontSize: 9, fontWeight: "700" },
  noKeyBanner:      { flexDirection: "row", alignItems: "center", gap: 8, margin: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  noKeyText:        { flex: 1, fontSize: 12, lineHeight: 18 },
  confirmedToast:   { flexDirection: "row", alignItems: "center", gap: 6, margin: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  confirmedToastText:{ flex: 1, fontSize: 11, fontFamily: MONO },
  encNotice:        { padding: 16 },
  encNoticeBadge:   { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  encNoticeTitle:   { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  encNoticeText:    { fontSize: 12, lineHeight: 18 },
  loadCenter:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadText:         { fontSize: 13 },
  msgList:          { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 16 },
  msgOuter:         { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  msgOuterMe:       { justifyContent: "flex-end" },
  msgOuterThem:     { justifyContent: "flex-start" },
  msgAvatarWrap:    { marginRight: 6 },
  msgAvatar:        { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  msgAvatarText:    { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  bubble:           { maxWidth: "74%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, borderWidth: 1 },
  bubbleMe:         { borderBottomRightRadius: 4 },
  bubbleThem:       { borderBottomLeftRadius: 4 },
  bubbleText:       { fontSize: 15, lineHeight: 22 },
  bubbleMeta:       { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  bubbleTime:       { fontSize: 10 },
  confirmedBadge:   { flexDirection: "row", alignItems: "center", gap: 3 },
  confirmedText:    { fontSize: 9, fontWeight: "600" },
  txRow:            { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingTop: 5, borderTopWidth: 0 },
  txHash:           { fontSize: 9, fontFamily: MONO, fontWeight: "600" },
  txBlock:          { fontSize: 9, fontFamily: MONO },
  encFail:          { flexDirection: "row", alignItems: "center", gap: 6 },
  encFailText:      { fontSize: 12, fontStyle: "italic" },
  broadcastRow:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  broadcastDot:     { width: 7, height: 7, borderRadius: 4 },
  broadcastText:    { fontSize: 11, fontFamily: MONO },
  inputBar:         { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  inputWrap:        { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 24, paddingVertical: 8, paddingRight: 12, minHeight: 46 },
  input:            { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: Platform.OS === "ios" ? 2 : 0 },
  sendBtn:          { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
