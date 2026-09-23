"use client";

import nacl from "tweetnacl";
import {
  decodeUTF8,
  encodeUTF8,
  encodeBase64,
  decodeBase64,
} from "tweetnacl-util";

const DB_NAME = "loopr_crypto_db";
const STORE_NAME = "keys";

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function generateDeviceKeypair(): {
  publicKey: string;
  secretKey: Uint8Array;
  deviceId: string;
} {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
    deviceId: crypto.randomUUID(),
  };
}

export async function storeDeviceKeys(keys: {
  publicKey: string;
  secretKey: Uint8Array;
  deviceId: string;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: "device_key", ...keys });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function injectRestoredKey(
  secretKey: Uint8Array,
  overrideDeviceId?: string,
): Promise<{
  publicKey: string;
  secretKey: Uint8Array;
  deviceId: string;
}> {
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  const existing = await getDeviceKeys();
  const keys = {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
    deviceId: overrideDeviceId ?? existing?.deviceId ?? crypto.randomUUID(),
  };
  if (process.env.NODE_ENV !== "production")
    console.log("🔑 Injecting restored key:", {
      publicKey: keys.publicKey,
      deviceId: keys.deviceId,
    });
  await storeDeviceKeys(keys);
  return keys;
}

export async function getDeviceKeys(): Promise<{
  publicKey: string;
  secretKey: Uint8Array;
  deviceId: string;
} | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("device_key");

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearDeviceKeys(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete("device_key");

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function encryptMessageForDevice(
  plaintext: string,
  recipientPublicKeyBase64: string,
  mySecretKey: Uint8Array,
): { encryptedContent: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = decodeUTF8(plaintext);
  const recipientPublicKeyUint8 = decodeBase64(recipientPublicKeyBase64);

  const encryptedMessage = nacl.box(
    messageUint8,
    nonce,
    recipientPublicKeyUint8,
    mySecretKey,
  );

  return {
    encryptedContent: encodeBase64(encryptedMessage),
    nonce: encodeBase64(nonce),
  };
}

export function decryptMessageFromDevice(
  encryptedContentBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string,
  mySecretKey: Uint8Array,
): string {
  const encryptedContentUint8 = decodeBase64(encryptedContentBase64);
  const nonceUint8 = decodeBase64(nonceBase64);
  const senderPublicKeyUint8 = decodeBase64(senderPublicKeyBase64);

  const decryptedMessageUint8 = nacl.box.open(
    encryptedContentUint8,
    nonceUint8,
    senderPublicKeyUint8,
    mySecretKey,
  );

  if (!decryptedMessageUint8) {
    throw new Error("Failed to decrypt message");
  }

  return encodeUTF8(decryptedMessageUint8);
}


const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecretKey(
  secretKey: Uint8Array,
  password: string,
): Promise<{
  encryptedKeyBase64: string;
  saltBase64: string;
  ivBase64: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const aesKey = await deriveKeyFromPassword(password, salt);

  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    aesKey,
    secretKey as BufferSource,
  );

  return {
    encryptedKeyBase64: encodeBase64(new Uint8Array(encryptedContent)),
    saltBase64: encodeBase64(salt),
    ivBase64: encodeBase64(iv),
  };
}

export async function decryptSecretKey(
  encryptedKeyBase64: string,
  saltBase64: string,
  ivBase64: string,
  password: string,
): Promise<Uint8Array> {
  const salt = decodeBase64(saltBase64);
  const iv = decodeBase64(ivBase64);
  const encryptedContent = decodeBase64(encryptedKeyBase64);

  const aesKey = await deriveKeyFromPassword(password, salt);

  const decryptedContent = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    aesKey,
    encryptedContent as BufferSource,
  );

  return new Uint8Array(decryptedContent);
}

export function encryptBytes(data: Uint8Array): {
  ciphertext: Uint8Array;
  keyBase64: string;
  nonceBase64: string;
} {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(data, nonce, key);
  return {
    ciphertext,
    keyBase64: encodeBase64(key),
    nonceBase64: encodeBase64(nonce),
  };
}

export function decryptBytes(
  ciphertext: Uint8Array,
  keyBase64: string,
  nonceBase64: string,
): Uint8Array | null {
  return nacl.secretbox.open(
    ciphertext,
    decodeBase64(nonceBase64),
    decodeBase64(keyBase64),
  );
}

export function buildE2eeImageToken(
  path: string,
  keyBase64: string,
  nonceBase64: string,
): string {
  const json = JSON.stringify({ path, key: keyBase64, nonce: nonceBase64 });
  return `e2ee-img://${encodeBase64(new TextEncoder().encode(json))}`;
}

export function parseE2eeImageToken(
  token: string,
): { path: string; key: string; nonce: string } | null {
  if (!token.startsWith("e2ee-img://")) return null;
  try {
    const bytes = decodeBase64(token.slice("e2ee-img://".length));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.path === "string" &&
      typeof parsed.key === "string" &&
      typeof parsed.nonce === "string"
    ) {
      return { path: parsed.path, key: parsed.key, nonce: parsed.nonce };
    }
    return null;
  } catch {
    return null;
  }
}
