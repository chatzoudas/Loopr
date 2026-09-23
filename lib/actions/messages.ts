"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendMessage(
  receiverId: string,
  e2eeEnvelope: {
    recipient_encrypted: string;
    recipient_nonce: string;
    sender_encrypted: string;
    sender_nonce: string;
    sender_public_key: string;
  },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const insertPayload: Record<string, unknown> = {
    sender_id: user.id,
    receiver_id: receiverId,
    is_read: false,
    recipient_encrypted: e2eeEnvelope.recipient_encrypted,
    recipient_nonce: e2eeEnvelope.recipient_nonce,
    sender_encrypted: e2eeEnvelope.sender_encrypted,
    sender_nonce: e2eeEnvelope.sender_nonce,
    sender_public_key: e2eeEnvelope.sender_public_key,
  };

  const { data: message, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, data: message };
}

export async function deleteMessage(
  messageId: string,
  imageStoragePaths?: string[],
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: message, error: fetchError } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("id", messageId)
    .single();

  if (fetchError || !message) {
    return { error: fetchError?.message ?? "Message not found" };
  }

  if (message.sender_id !== user.id) {
    return { error: "Unauthorized" };
  }

  if (imageStoragePaths && imageStoragePaths.length > 0) {
    await supabase.storage.from("chat_images").remove(imageStoragePaths);
  }

  const { data, error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Failed to delete message" };
  }

  return { success: true };
}
