"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveKeyBackup(
  encryptedKey: string,
  salt: string,
  iv: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase.from("key_backups").upsert(
    {
      user_id: user.id,
      encrypted_key: encryptedKey,
      salt: salt,
      iv: iv,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getKeyBackup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("key_backups")
    .select("encrypted_key, salt, iv, updated_at")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data;
}
