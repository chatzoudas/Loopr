"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Message } from "@/lib/types";
import { toast } from "sonner";
import {
  sendMessage as sendMessageAction,
  deleteMessage as deleteMessageAction,
} from "@/lib/actions/messages";
import {
  getDeviceKeys,
  encryptMessageForDevice,
  parseE2eeImageToken,
} from "@/lib/crypto";
import { getKeyBackup } from "@/lib/actions/crypto";
import { decryptMessageRow, hasE2eePayload } from "@/lib/messages/e2ee";
import { splitContentAndImageUrls } from "@/lib/utils";

export function useChat(userId: string, otherUserId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!userId || !otherUserId) {
      setMessages([]);
      return;
    }

    setMessages([]);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        // readonly here, never mint keys or old messages become unreadable
        const myKeys = await getDeviceKeys();

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (!isMounted) return;

        if (error) {
          console.error("Error fetching messages:", error);
          toast.error("Failed to load messages");
          setLoading(false);
          return;
        }

        const messagesData = (data || []) as Message[];
        const decryptedMessages = messagesData.map((msg) => {
          if (!myKeys) {
            if (hasE2eePayload(msg) && !msg.content) {
              return { ...msg, content: "**🔒 Encrypted message**" };
            }
            return msg;
          }
          return decryptMessageRow(msg, userId, myKeys);
        });

        const chronologicalData = decryptedMessages.reverse();
        setMessages(chronologicalData);

        const unreadIds = chronologicalData
          .filter((m) => m.sender_id === otherUserId && !m.is_read)
          .map((m) => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .in("id", unreadIds);

          if (!isMounted) return;

          setMessages((prev) =>
            prev.map((msg) =>
              unreadIds.includes(msg.id) ? { ...msg, is_read: true } : msg,
            ),
          );
        }
      } catch (err) {
        console.error("Fetch/decrypt error:", err);
      }
      setLoading(false);
    };

    const markMessageAsRead = async (messageId: string) => {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId);
    };

    const normalizeMessageContent = async (message: Message) => {
      if (!hasE2eePayload(message)) {
        return message;
      }
      const myKeys = await getDeviceKeys();
      if (!myKeys?.secretKey) {
        return {
          ...message,
          content: "**🔒 Encrypted message**",
        };
      }
      return decryptMessageRow(message, userId, myKeys);
    };

    const handleInsert = async (payload: any) => {
      if (!isMounted) return;
      const incomingMessage = payload.new;

      let finalMessage = await normalizeMessageContent(
        incomingMessage as Message,
      );

      if (!finalMessage) return;

      const needsDecrypt =
        hasE2eePayload(finalMessage) &&
        !finalMessage.content &&
        !finalMessage.image_url;
      if (needsDecrypt) {
        try {
          let fetched: Message | null = null;
          let retries = 10;
          await new Promise((r) => setTimeout(r, 75));

          while (retries > 0) {
            const res = await supabase
              .from("messages")
              .select("*")
              .eq("id", incomingMessage.id)
              .single();
            if (res.data) {
              fetched = res.data as Message;
              break;
            }
            await new Promise((r) => setTimeout(r, 100));
            retries--;
          }

          if (fetched) {
            finalMessage = await normalizeMessageContent(fetched);
            if (!finalMessage.content && !finalMessage.image_url) {
              finalMessage.content = "**<Encrypted Message (Unsupported)>**";
            }
          }
        } catch (e) {
          console.error("Failed to decrypt realtime message", e);
        }
      }

      if (
        finalMessage &&
        finalMessage.receiver_id === userId &&
        finalMessage.sender_id === otherUserId
      ) {
        markMessageAsRead((finalMessage as Message).id);

        setMessages((prev) => {
          const fm = finalMessage as Message;
          if (prev.some((m) => m.id === fm.id)) return prev;
          return [...prev, { ...fm, is_read: true }];
        });
      }

      if (
        finalMessage &&
        finalMessage.sender_id === userId &&
        finalMessage.receiver_id === otherUserId
      ) {
        setMessages((prev) => {
          const fm = finalMessage as Message;
          if (prev.some((m) => m.id === fm.id)) return prev;
          return [...prev, fm];
        });
      }
    };

    const handleUpdate = (payload: any) => {
      if (!isMounted) return;
      const updatedMessage = payload.new as Partial<Message>;

      normalizeMessageContent(updatedMessage as Message)
        .then((normalized) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === normalized.id) {
                const safeContent = normalized.content || msg.content;
                return { ...msg, ...normalized, content: safeContent };
              }
              return msg;
            }),
          );
        })
        .catch((err) => {
          console.error("Failed to normalize updated message:", err);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === updatedMessage.id) {
                return { ...msg, ...updatedMessage };
              }
              return msg;
            }),
          );
        });
    };

    const handleDelete = (payload: any) => {
      if (!isMounted) return;
      const deletedMessageId = payload.old.id;
      if (deletedMessageId) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== deletedMessageId),
        );
      }
    };

    const handleCryptoRestore = () => {
      void fetchMessages();
    };

    const init = async () => {
      await fetchMessages();

      if (!isMounted) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !isMounted) return;

      supabase.realtime.setAuth(session.access_token);

      const roomIds = [userId, otherUserId].sort();
      const channelName = `chat_${roomIds[0]}_${roomIds[1]}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `sender_id=eq.${otherUserId}`,
          },
          handleInsert,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${otherUserId}`,
          },
          handleInsert,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `sender_id=eq.${userId}`,
          },
          handleUpdate,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `sender_id=eq.${otherUserId}`,
          },
          handleUpdate,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${userId}`,
          },
          handleUpdate,
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
          },
          handleDelete,
        )
        .subscribe((status: string, err: any) => {});
    };

    window.addEventListener("loopr:crypto-restored", handleCryptoRestore);
    init();

    return () => {
      isMounted = false;
      window.removeEventListener("loopr:crypto-restored", handleCryptoRestore);
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [userId, otherUserId, supabase]);

  useEffect(() => {
    if (!userId || !otherUserId) return;

    const markUnreadAsRead = async () => {
      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("id")
        .eq("sender_id", otherUserId)
        .eq("receiver_id", userId)
        .eq("is_read", false);

      if (!error && unreadMessages && unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map((m) => m.id);

        await supabase
          .from("messages")
          .update({ is_read: true })
          .in("id", unreadIds);

        setMessages((prev) =>
          prev.map((msg) =>
            unreadIds.includes(msg.id) ? { ...msg, is_read: true } : msg,
          ),
        );
      }
    };

    markUnreadAsRead();

    const interval = setInterval(markUnreadAsRead, 2000);

    const handleFocus = () => markUnreadAsRead();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId, otherUserId, supabase]);

  const sendMessage = async (content: string, imageUrl?: string | null) => {
    if (!userId || !otherUserId) return;

    const text = content.trim();
    const payload =
      imageUrl && text ? `${text}\n\n${imageUrl}` : imageUrl || text;

    if (!payload) return;

    try {
      const [myKeys, backup] = await Promise.all([
        getDeviceKeys(),
        getKeyBackup(),
      ]);

      if (!backup) {
        window.dispatchEvent(new Event("loopr:open-recovery-setup"));
        toast.error("Set a recovery password before sending messages.");
        return;
      }

      if (!myKeys) {
        window.dispatchEvent(new Event("loopr:open-recovery-restore"));
        toast.error("Restore your recovery key before sending messages.");
        return;
      }

      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("id, public_key")
        .eq("id", otherUserId)
        .single();

      if (!recipientProfile?.public_key) {
        toast.error(
          "This user hasn't finished account setup and can't receive messages yet.",
        );
        return;
      }

      const { encryptedContent, nonce } = encryptMessageForDevice(
        payload,
        recipientProfile.public_key,
        myKeys.secretKey,
      );

      const { encryptedContent: senderEncrypted, nonce: senderNonce } =
        encryptMessageForDevice(payload, myKeys.publicKey, myKeys.secretKey);

      const e2eeEnvelope = {
        recipient_encrypted: encryptedContent,
        recipient_nonce: nonce,
        sender_encrypted: senderEncrypted,
        sender_nonce: senderNonce,
        sender_public_key: myKeys.publicKey,
      };

      const { data, error } = await sendMessageAction(
        otherUserId,
        e2eeEnvelope,
      );

      if (error) throw error;

      if (data) {
        setMessages((prev) => {
          const optimistic = {
            ...data,
            content: text || null,
            image_url: imageUrl || null,
          } as Message;
          if (prev.some((m) => m.id === data.id)) {
            return prev.map((m) => (m.id === data.id ? optimistic : m));
          }
          return [...prev, optimistic];
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const deleteMessage = async (id: string) => {
    const messageToDelete = messages.find((m) => m.id === id);
    if (!messageToDelete) return;

    const imageStoragePaths: string[] = [];
    if (messageToDelete.content) {
      const { imageUrls } = splitContentAndImageUrls(messageToDelete.content);
      for (const url of imageUrls) {
        const parsed = parseE2eeImageToken(url);
        if (parsed) imageStoragePaths.push(parsed.path);
      }
    }

    setMessages((prev) => prev.filter((m) => m.id !== id));

    const res = await deleteMessageAction(id, imageStoragePaths);
    if (res.error) {
      setMessages((prev) =>
        [...prev, messageToDelete].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      );
      toast.error("Failed to delete message");
    }
  };

  return {
    messages: otherUserId ? messages : [],
    loading: otherUserId ? loading : false,
    sendMessage,
    setMessages,
    deleteMessage,
  };
}
