"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  splitContentAndImageUrls,
  getPostImagePathsFromContent,
  parseMentions,
} from "@/lib/utils";

export async function createLoop(formData: FormData) {
  const supabase = await createClient();
  const content = formData.get("content") as string;

  if (!content) {
    return { error: "Content is required" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: loopData, error } = await supabase
    .from("loops")
    .insert({
      user_id: user.id,
      content,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const mentionedUsernames = parseMentions(content);
  if (mentionedUsernames.length > 0) {
    const { data: mentionedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .in("username", mentionedUsernames);

    if (mentionedProfiles && mentionedProfiles.length > 0) {
      const notifications = mentionedProfiles
        .filter((p) => p.id !== user.id)
        .map((p) => ({
          recipient_id: p.id,
          actor_id: user.id,
          type: "mention" as const,
          loop_id: loopData.id,
        }));

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert(notifications);
        if (notifError)
          console.error("Error inserting mention notifications:", notifError);
      }
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function getLoops(filter: "for-you" | "following" = "for-you") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("loops")
    .select(
      `
      *,
      profiles:user_id (*),
      likes (user_id),
      bookmarks (user_id),
      comments (id)
    `,
    )
    .order("created_at", { ascending: false });

  if (filter === "following" && user) {
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (following && following.length > 0) {
      const followingIds = following.map((f) => f.following_id);
      query = query.in("user_id", followingIds);
    } else {
      return [];
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching loops:", error);
    return [];
  }

  return data;
}

export async function getLoopById(loopId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("loops")
    .select(
      `
      *,
      profiles:user_id (*),
      likes (user_id),
      bookmarks (user_id),
      comments (id)
    `,
    )
    .eq("id", loopId)
    .single();

  if (error) {
    console.error("Error fetching loop:", error);
    return null;
  }

  return data;
}

export async function deleteLoop(
  loopId: string,
  usernameToRevalidate?: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: loop, error: loopError } = await supabase
    .from("loops")
    .select("id,user_id,content")
    .eq("id", loopId)
    .single();

  if (loopError || !loop) {
    return { error: loopError?.message ?? "Loop not found" };
  }

  if (loop.user_id !== user.id) {
    return { error: "Forbidden" };
  }

  await supabase.from("notifications").delete().eq("loop_id", loopId);

  const imagePaths = getPostImagePathsFromContent(loop.content);
  const { data: deleted, error: deleteError } = await supabase
    .from("loops")
    .delete()
    .eq("id", loopId)
    .eq("user_id", user.id)
    .select("id");

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (!deleted || deleted.length === 0) {
    const { data: stillThere, error: stillThereError } = await supabase
      .from("loops")
      .select("id,user_id")
      .eq("id", loopId)
      .maybeSingle();

    if (stillThereError) {
      return { error: stillThereError.message };
    }

    if (!stillThere) {
      revalidatePath("/");
      if (usernameToRevalidate) revalidatePath(`/${usernameToRevalidate}`);
      return { success: true, warning: "Loop was already deleted." };
    }

    if (stillThere.user_id !== user.id) {
      return { error: "Forbidden" };
    }

    return {
      error:
        "Delete blocked by Supabase RLS. Run the SQL policies in specs/main/contracts/fix_rls.sql (loops delete policy).",
    };
  }

  let warning: string | undefined;
  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("posts")
      .remove(imagePaths);

    if (storageError) {
      console.warn("Failed to delete post images:", storageError);
      warning = "Loop deleted, but failed to delete one or more images.";
    }
  }

  revalidatePath("/");
  if (usernameToRevalidate) revalidatePath(`/${usernameToRevalidate}`);
  return { success: true, warning };
}

export async function getTrendingLoops() {
  const supabase = await createClient();
  const limitCount = 5;

  const { data: loops, error } = await supabase
    .from("loops")
    .select(
      `
      *,
      profiles:user_id (*),
      likes (user_id),
      bookmarks (user_id),
      comments (id)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching trending loops:", error);
    return [];
  }

  if (!loops || loops.length === 0) return [];

  let daysBack = 7;
  let filteredLoops = [];

  while (daysBack <= 365) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    filteredLoops = loops.filter(
      (loop) => new Date(loop.created_at) >= fromDate,
    );

    if (
      filteredLoops.length >= limitCount ||
      filteredLoops.length === loops.length
    ) {
      break;
    }

    daysBack += 7;
  }
const loopsWithScore = filteredLoops.map((loop) => ({
    ...loop,
    score:
      (loop.likes?.length || 0) +
      (loop.bookmarks?.length || 0) * 2 +
      (loop.comments?.length || 0),
  }));
  return loopsWithScore.sort((a, b) => b.score - a.score).slice(0, limitCount);
}

export async function getBookmarkedLoops() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("loop_id")
    .eq("user_id", user.id);

  if (!bookmarks || bookmarks.length === 0) return [];

  const loopIds = bookmarks.map((r) => r.loop_id);

  const { data, error } = await supabase
    .from("loops")
    .select(
      `
      *,
      profiles:user_id (*),
      likes (user_id),
      bookmarks (user_id),
      comments (id)
    `,
    )
    .in("id", loopIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching bookmarked loops:", error);
    return [];
  }

  return data;
}
