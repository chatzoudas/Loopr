"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleLike(loopId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: loop } = await supabase
    .from("loops")
    .select("user_id")
    .eq("id", loopId)
    .single();

  const { data: existingLike } = await supabase
    .from("likes")
    .select()
    .eq("user_id", user.id)
    .eq("loop_id", loopId)
    .single();

  if (existingLike) {
    await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("loop_id", loopId);

    if (loop && loop.user_id !== user.id) {
      await supabase
        .from("notifications")
        .delete()
        .eq("recipient_id", loop.user_id)
        .eq("actor_id", user.id)
        .eq("type", "like")
        .eq("loop_id", loopId);
    }
  } else {
    await supabase.from("likes").insert({
      user_id: user.id,
      loop_id: loopId,
    });

    if (loop && loop.user_id !== user.id) {
      const { error: notifError } = await supabase.from("notifications").insert({
        recipient_id: loop.user_id,
        actor_id: user.id,
        type: "like",
        loop_id: loopId,
      });
      if (notifError) {
        console.error("Error inserting like notification:", notifError);
      }
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function toggleBookmark(loopId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: existingBookmark } = await supabase
    .from("bookmarks")
    .select()
    .eq("user_id", user.id)
    .eq("loop_id", loopId)
    .single();

  if (existingBookmark) {
    await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("loop_id", loopId);
  } else {
    await supabase.from("bookmarks").insert({
      user_id: user.id,
      loop_id: loopId,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function toggleFollow(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const { data: existingFollow } = await supabase
    .from("follows")
    .select()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .single();

  if (existingFollow) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    await supabase
      .from("notifications")
      .delete()
      .eq("recipient_id", targetUserId)
      .eq("actor_id", user.id)
      .eq("type", "follow");
  } else {
    await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_id: targetUserId,
      actor_id: user.id,
      type: "follow",
    });
    if (notifError) {
      console.error("Error inserting follow notification:", notifError);
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}
