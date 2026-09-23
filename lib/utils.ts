import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function splitContentAndImageUrls(raw: string): {
  text: string;
  imageUrls: string[];
} {
  const normalized = (raw ?? "").replace(/\r\n/g, "\n").trimEnd();
  if (!normalized) return { text: "", imageUrls: [] };

  const lines = normalized.split("\n");
  const extractedUrls: string[] = [];
  const postMarker = "/storage/v1/object/public/posts/";
  const chatMarker = "/storage/v1/object/public/chat_images/";

  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine === "") {
      lines.pop();
      continue;
    }

    const looksLikeImageUrl = (() => {
      if (lastLine.startsWith("e2ee-img://")) return true;
      if (!/^https?:\/\//i.test(lastLine)) return false;
      try {
        const url = new URL(lastLine);
        return (
          url.pathname.includes(postMarker) || url.pathname.includes(chatMarker)
        );
      } catch {
        return false;
      }
    })();

    if (looksLikeImageUrl) {
      extractedUrls.unshift(lastLine);
      lines.pop();
    } else {
      break;
    }
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
    lines.pop();
  }

  return { text: lines.join("\n"), imageUrls: extractedUrls };
}

export function getPostImagePathsFromContent(content: string): string[] {
  const paths = new Set<string>();

  const trailingUrls = splitContentAndImageUrls(content).imageUrls;
  for (const trailing of trailingUrls) {
    try {
      const url = new URL(trailing);
      const marker = "/storage/v1/object/public/posts/";
      const idx = url.pathname.indexOf(marker);
      if (idx !== -1) {
        const objectPath = url.pathname.slice(idx + marker.length);
        const decoded = decodeURIComponent(objectPath);
        if (decoded) paths.add(decoded);
      }
    } catch {
    }
  }

  const matches = content.matchAll(/\!\[[^\]]*\]\(([^)]+)\)/g);
  // old posts used markdown images, still need to catch those

  for (const match of matches) {
    const rawUrl = match[1];
    if (!rawUrl) continue;

    try {
      const url = new URL(rawUrl);
      const marker = "/storage/v1/object/public/posts/";
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) continue;

      const objectPath = url.pathname.slice(idx + marker.length);
      const decoded = decodeURIComponent(objectPath);
      if (decoded) paths.add(decoded);
    } catch {
    }
  }

  return Array.from(paths);
}

export function getChatImagePathsFromContent(content: string): string[] {
  const paths = new Set<string>();

  const trailingUrls = splitContentAndImageUrls(content).imageUrls;
  for (const trailing of trailingUrls) {
    try {
      const url = new URL(trailing);
      const marker = "/storage/v1/object/public/chat_images/";
      const idx = url.pathname.indexOf(marker);
      if (idx !== -1) {
        const objectPath = url.pathname.slice(idx + marker.length);
        const decoded = decodeURIComponent(objectPath);
        if (decoded) paths.add(decoded);
      }
    } catch {
    }
  }

  return Array.from(paths);
}

export function getChatImagePathsFromMessage(message: {
  content?: string | null;
  image_url?: string | null;
}): string[] {
  const paths = new Set<string>();

  if (message.image_url) {
    for (const path of getChatImagePathsFromContent(message.image_url)) {
      paths.add(path);
    }
  }

  if (message.content) {
    for (const path of getChatImagePathsFromContent(message.content)) {
      paths.add(path);
    }
  }

  return Array.from(paths);
}

export function getMessageImageUrls(message: {
  content?: string | null;
  image_url?: string | null;
}): string[] {
  const urls: string[] = [];
  if (message.image_url) {
    urls.push(message.image_url);
  }
  if (message.content) {
    urls.push(...splitContentAndImageUrls(message.content).imageUrls);
  }
  return urls;
}

export function parseMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}
