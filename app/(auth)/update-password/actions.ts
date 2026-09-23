"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateUserPassword(formData: FormData) {
  const supabase = await createClient();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return redirect("/update-password?error=Both password fields are required");
  }

  if (password !== confirmPassword) {
    return redirect("/update-password?error=Passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return redirect(
      `/update-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  return redirect(
    "/signin?message=Password updated successfully, please log in with your new password",
  );
}
