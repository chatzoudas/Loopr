"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getPostImagePathsFromContent,
  getChatImagePathsFromMessage,
} from "@/lib/utils";

function getStoragePathFromPublicUrl(url: string, bucket: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const display_name = formData.get("display_name") as string;
  const bio = formData.get("bio") as string;
  const tech_stack_raw = formData.get("tech_stack") as string;

  const remove_avatar = formData.get("remove_avatar") === "1";
  const avatar_file = formData.get("avatar_file");

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  if (existingProfileError) {
    console.error("Error fetching profile:", existingProfileError);
    throw new Error("Failed to update profile");
  }

  const tech_stack = tech_stack_raw
    ? tech_stack_raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .filter((t, index, arr) => arr.indexOf(t) === index)
    : [];

  let nextAvatarUrl: string | null | undefined = undefined;

  if (remove_avatar) {
    nextAvatarUrl = null;
  }

  if (avatar_file instanceof File && avatar_file.size > 0) {
    const maxAvatarBytes = 2 * 1024 * 1024;
    if (!avatar_file.type?.startsWith("image/")) {
      throw new Error("Invalid avatar file");
    }
    if (avatar_file.size > maxAvatarBytes) {
      throw new Error("Avatar too large");
    }

    const bucket = "avatars";

    const objectPath = `${user.id}/avatar-${Date.now()}.png`;
    const bytes = await avatar_file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("Error uploading avatar:", uploadError);
      throw new Error("Failed to update profile");
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    nextAvatarUrl = data.publicUrl;

    const existingAvatarUrl = existingProfile?.avatar_url;
    if (existingAvatarUrl) {
      const existingPath = getStoragePathFromPublicUrl(
        existingAvatarUrl,
        bucket,
      );
      if (existingPath && existingPath !== objectPath) {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove([existingPath]);
        if (removeError) {
          console.warn("Failed to remove old avatar:", removeError);
        }
      }
    }
  } else if (remove_avatar) {
    const existingAvatarUrl = existingProfile?.avatar_url;
    if (existingAvatarUrl) {
      const bucket = "avatars";
      const existingPath = getStoragePathFromPublicUrl(
        existingAvatarUrl,
        bucket,
      );
      if (existingPath) {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove([existingPath]);
        if (removeError) {
          console.warn("Failed to remove avatar:", removeError);
        }
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    display_name,
    bio,
    tech_stack,
    updated_at: new Date().toISOString(),
  };

  if (nextAvatarUrl !== undefined) {
    updatePayload.avatar_url = nextAvatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    console.error("Error updating profile:", error);
    throw new Error("Failed to update profile");
  }

  if (existingProfile?.username) {
    revalidatePath(`/${existingProfile.username}`);
  }
  revalidatePath("/", "layout");
}

export async function completeOnboarding(
  prevState: unknown,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const username = formData.get("username") as string;
  const display_name = formData.get("display_name") as string;
  const tech_stack_raw = formData.get("tech_stack") as string;

  if (!username || username.length < 3) {
    return { error: "Username must be at least 3 characters long" };
  }
  if (!display_name || display_name.length < 2) {
    return { error: "Display name must be at least 2 characters long" };
  }

  const tech_stack = tech_stack_raw
    ? tech_stack_raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .filter((t, index, arr) => arr.indexOf(t) === index)
    : [];

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name,
    tech_stack,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Username already taken" };
    }
    console.error("Error creating profile:", error);
    return { error: "Failed to create profile" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.avatar_url) {
      const existingPath = getStoragePathFromPublicUrl(
        profile.avatar_url,
        "avatars",
      );
      if (existingPath) {
        await supabase.storage.from("avatars").remove([existingPath]);
      }
    }

    const { data: loops } = await supabase
      .from("loops")
      .select("content")
      .eq("user_id", user.id);

    if (loops && loops.length > 0) {
      const allPaths = new Set<string>();
      for (const loop of loops) {
        const paths = getPostImagePathsFromContent(loop.content);
        paths.forEach((p) => allPaths.add(p));
      }

      const pathsArray = Array.from(allPaths);
      if (pathsArray.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < pathsArray.length; i += batchSize) {
          const batch = pathsArray.slice(i, i + batchSize);
          // storage remove caps out so chunk it
          await supabase.storage.from("posts").remove(batch);
        }
      }
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("content, image_url")
      .eq("sender_id", user.id);

    if (messages && messages.length > 0) {
      const allPaths = new Set<string>();
      for (const msg of messages) {
        const paths = getChatImagePathsFromMessage(msg);
        paths.forEach((p) => allPaths.add(p));
      }

      const pathsArray = Array.from(allPaths);
      if (pathsArray.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < pathsArray.length; i += batchSize) {
          const batch = pathsArray.slice(i, i + batchSize);
          await supabase.storage.from("chat_images").remove(batch);
        }
      }
    }
  } catch (err) {
    console.error("Error cleaning up storage for account deletion:", err);
  }

  const { error } = await supabase.rpc("delete_user");

  if (error) {
    console.error("Error deleting account:", error);
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
