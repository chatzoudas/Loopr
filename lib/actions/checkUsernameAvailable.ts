import { createClient } from "@/lib/supabase/client";

export async function checkUsernameAvailable(
  username: string
): Promise<boolean> {
  if (!username || username.length < 3) return false;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return !data;
}
