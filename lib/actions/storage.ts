"use server";

import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

function readUInt24LE(buf: Buffer, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16);
}

function getWebpDimensions(
  // tiny webp header parser, just enoguh to check dims server side
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 16) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WEBP") return null;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const fourcc = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + size;

    if (chunkEnd > buf.length) return null;

    if (fourcc === "VP8X") {
      if (size < 10) return null;
      const widthMinus1 = readUInt24LE(buf, chunkStart + 4);
      const heightMinus1 = readUInt24LE(buf, chunkStart + 7);
      return { width: widthMinus1 + 1, height: heightMinus1 + 1 };
    }

    if (fourcc === "VP8L") {
      if (size < 5) return null;
      if (buf[chunkStart] !== 0x2f) return null;
      const b1 = buf[chunkStart + 1]!;
      const b2 = buf[chunkStart + 2]!;
      const b3 = buf[chunkStart + 3]!;
      const b4 = buf[chunkStart + 4]!;

      const widthMinus1 = b1 | ((b2 & 0x3f) << 8);
      const heightMinus1 = (b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10);
      return { width: widthMinus1 + 1, height: heightMinus1 + 1 };
    }

    if (fourcc === "VP8 ") {
      if (size < 10) return null;
      const start = chunkStart;
      const startCodeIndex = buf.indexOf(
        Buffer.from([0x9d, 0x01, 0x2a]),
        start,
      );
      if (startCodeIndex !== -1 && startCodeIndex + 7 < chunkEnd) {
        const w = buf.readUInt16LE(startCodeIndex + 3) & 0x3fff;
        const h = buf.readUInt16LE(startCodeIndex + 5) & 0x3fff;
        return { width: w, height: h };
      }
    }

    offset = chunkEnd + (size % 2);
  }

  return null;
}

export async function uploadImage(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File;
  const bucket = formData.get("bucket") as string;
  const intent = formData.get("intent") as string | null;

  if (!file || !bucket) {
    return { error: "Missing file or bucket" };
  }

  if (!file.type?.startsWith("image/")) {
    return { error: "Invalid file type" };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let filePath: string;
  let contentType: string | undefined;

  if (bucket === "posts") {
    if (file.type !== "image/webp") {
      return { error: "Post images must be WebP" };
    }

    const dims = getWebpDimensions(buffer);
    if (!dims) {
      return { error: "Invalid WebP image" };
    }

    const maxDim = intent === "chat" ? 2000 : 1000;
    if (dims.width > maxDim || dims.height > maxDim) {
      return { error: `Image too large (max ${maxDim}x${maxDim})` };
    }

    filePath = `${crypto.randomUUID()}.webp`;
    contentType = "image/webp";
  } else {
    const fileExt = file.name.split(".").pop() || "bin";
    filePath = `${crypto.randomUUID()}.${fileExt}`;
    contentType = file.type;
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { url: data.publicUrl };
}

export async function uploadChatImage(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File;

  if (!file) {
    return { error: "Missing file" };
  }

  if (!file.type?.startsWith("image/")) {
    return { error: "Invalid file type" };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const fileExt = file.name.split(".").pop() || "bin";
  const filePath = `${crypto.randomUUID()}.${fileExt}`;
  const contentType = file.type;

  const { error } = await supabase.storage
    .from("chat_images")
    .upload(filePath, buffer, { contentType });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from("chat_images").getPublicUrl(filePath);

  return { url: data.publicUrl };
}

export async function uploadEncryptedChatImage(
  formData: FormData,
): Promise<{ path?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "Missing file" };

  const bytes = await file.arrayBuffer();
  const path = `${crypto.randomUUID()}.bin`;

  const { error } = await supabase.storage
    .from("chat_images")
    .upload(path, Buffer.from(bytes), {
      contentType: "application/octet-stream",
    });

  if (error) return { error: error.message };
  return { path };
}

export async function getSignedChatImageUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.storage
    .from("chat_images")
    .createSignedUrl(path, 3600);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
