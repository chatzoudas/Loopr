"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseMentions } from "@/lib/utils";

export async function addComment(
  loopId: string,
  content: string,
  parentId?: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to comment" };
  }

  if (!content.trim()) {
    return { error: "Comment cannot be empty" };
  }

  const { data: commentData, error } = await supabase
    .from("comments")
    .insert({
      user_id: user.id,
      loop_id: loopId,
      content: content.trim(),
      parent_id: parentId || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const { data: loop } = await supabase
    .from("loops")
    .select("user_id")
    .eq("id", loopId)
    .single();

  if (loop && loop.user_id !== user.id) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_id: loop.user_id,
      actor_id: user.id,
      type: "comment",
      loop_id: loopId,
      comment_id: commentData.id,
    });
    if (notifError) {
      console.error("Error inserting comment notification for loop author:", notifError);
    }
  }

  if (parentId) {
    const { data: parentComment } = await supabase
      .from("comments")
      .select("user_id")
      .eq("id", parentId)
      .single();

    if (
      parentComment &&
      parentComment.user_id !== user.id &&
      (!loop || parentComment.user_id !== loop.user_id)
    ) {
      const { error: parentNotifError } = await supabase.from("notifications").insert({
        recipient_id: parentComment.user_id,
        actor_id: user.id,
        type: "comment",
        loop_id: loopId,
        comment_id: commentData.id,
      });
      if (parentNotifError) {
        console.error("Error inserting comment notification for parent author:", parentNotifError);
      }
    }
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
          loop_id: loopId,
          comment_id: commentData.id,
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
  revalidatePath(`/${user.user_metadata.username}`);
  return { success: true };
}

export async function getComments(loopId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      *,
      profiles (*),
      likes:comment_likes(user_id)
      `,
    )
    .eq("loop_id", loopId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "Error fetching comments with likes relation:",
      JSON.stringify(error, null, 2),
    );

    const { data: simpleData, error: simpleError } = await supabase
      .from("comments")
      .select("*")
      .eq("loop_id", loopId)
      .order("created_at", { ascending: true });

    if (simpleError) {
      return [];
    }

    if (!simpleData || simpleData.length === 0) return [];

    const userIds = [...new Set(simpleData.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    const commentIds = simpleData.map((c) => c.id);
    const { data: likesData } = await supabase
      .from("comment_likes")
      .select("user_id, comment_id")
      .in("comment_id", commentIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]));
    const likesMap = new Map<string, { user_id: string }[]>();
    likesData?.forEach((l) => {
      if (!likesMap.has(l.comment_id)) {
        likesMap.set(l.comment_id, []);
      }
      likesMap.get(l.comment_id)?.push({ user_id: l.user_id });
    });

    return simpleData.map((c) => ({
      ...c,
      likes: likesMap.get(c.id) || [],
      parent_id: c.parent_id || null,
      profiles: profileMap.get(c.user_id) || {
        username: "Unknown",
        display_name: "Unknown User",
        avatar_url: null,
      },
    }));
  }

  return data;
}

export async function toggleCommentLike(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: comment } = await supabase
    .from("comments")
    .select("user_id, loop_id")
    .eq("id", commentId)
    .single();

  const { data: existingLike } = await supabase
    .from("comment_likes")
    .select()
    .eq("user_id", user.id)
    .eq("comment_id", commentId)
    .single();

  if (existingLike) {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("comment_id", commentId);

    if (error) return { error: error.message };

    if (comment && comment.user_id !== user.id) {
      await supabase
        .from("notifications")
        .delete()
        .eq("recipient_id", comment.user_id)
        .eq("actor_id", user.id)
        .eq("type", "comment_like")
        .eq("comment_id", commentId);
    }
  } else {
    const { error } = await supabase.from("comment_likes").insert({
      user_id: user.id,
      comment_id: commentId,
    });

    if (error) return { error: error.message };

    if (comment && comment.user_id !== user.id) {
      const { error: notifError } = await supabase.from("notifications").insert({
        recipient_id: comment.user_id,
        actor_id: user.id,
        type: "comment_like",
        comment_id: commentId,
        loop_id: comment.loop_id,
      });
      if (notifError) {
        console.error("Error inserting comment_like notification:", notifError);
      }
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  await supabase
    .from("notifications")
    .delete()
    .eq("comment_id", commentId);

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
