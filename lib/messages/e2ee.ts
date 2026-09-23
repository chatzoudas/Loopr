import { decryptMessageFromDevice } from "@/lib/crypto";
import { Message } from "@/lib/types";

export type E2eeEnvelope = {
  encrypted?: string;
  nonce?: string;
  sender_public_key?: string;
  recipient_copy?: {
    encrypted?: string;
    nonce?: string;
    sender_public_key?: string;
  };
  sender_copy?: {
    encrypted?: string;
    nonce?: string;
    sender_public_key?: string;
  };
};

export function parseE2eeEnvelope(
  msg: Pick<
    Message,
    | "content"
    | "recipient_encrypted"
    | "recipient_nonce"
    | "sender_encrypted"
    | "sender_nonce"
    | "sender_public_key"
  >,
): E2eeEnvelope | null {
  if (
    msg.recipient_encrypted ||
    msg.sender_encrypted ||
    msg.recipient_nonce ||
    msg.sender_nonce
  ) {
    const parsed: E2eeEnvelope = {};
    if (msg.recipient_encrypted || msg.recipient_nonce) {
      parsed.recipient_copy = {
        encrypted: msg.recipient_encrypted ?? undefined,
        nonce: msg.recipient_nonce ?? undefined,
        sender_public_key: msg.sender_public_key ?? undefined,
      };
    }
    if (msg.sender_encrypted || msg.sender_nonce) {
      parsed.sender_copy = {
        encrypted: msg.sender_encrypted ?? undefined,
        nonce: msg.sender_nonce ?? undefined,
        sender_public_key: msg.sender_public_key ?? undefined,
      };
    }
    return parsed;
  }

  if (!msg.content || typeof msg.content !== "string") {
    return null;
  }

  const trimmed = msg.content.trim();
  // old msgs kept json in content col, keep reading it as fallback
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as E2eeEnvelope;
  } catch {
    return null;
  }
}

export function hasE2eePayload(msg: Message): boolean {
  return parseE2eeEnvelope(msg) !== null;
}

const KEY_MISMATCH_MSG =
  "⚠️ Encrypted with different key (restore backup to recover)";
const LEGACY_SENDER_MSG =
  "⚠️ Sent before self-copy upgrade (cannot decrypt from DB)";

export function decryptMessageRow(
  msg: Message,
  userId: string,
  keys: { secretKey: Uint8Array; publicKey: string },
): Message {
  const parsed = parseE2eeEnvelope(msg);
  if (!parsed) {
    return msg;
  }

  if (parsed.encrypted && parsed.nonce && parsed.sender_public_key) {
    if (msg.sender_id === userId) {
      return { ...msg, content: LEGACY_SENDER_MSG };
    }
    try {
      const plaintext = decryptMessageFromDevice(
        parsed.encrypted,
        parsed.nonce,
        parsed.sender_public_key,
        keys.secretKey,
      );
      return { ...msg, content: plaintext };
    } catch {
      return { ...msg, content: KEY_MISMATCH_MSG };
    }
  }

  if (parsed.recipient_copy && parsed.sender_copy) {
    const copy =
      msg.sender_id === userId ? parsed.sender_copy : parsed.recipient_copy;
    if (!copy?.encrypted || !copy?.nonce || !copy?.sender_public_key) {
      return msg;
    }
    try {
      const plaintext = decryptMessageFromDevice(
        copy.encrypted,
        copy.nonce,
        copy.sender_public_key,
        keys.secretKey,
      );
      return { ...msg, content: plaintext };
    } catch {
      return { ...msg, content: KEY_MISMATCH_MSG };
    }
  }

  return msg;
}
