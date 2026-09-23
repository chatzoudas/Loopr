"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function sendPasswordResetEmail(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  if (process.env.NODE_ENV !== "production")
    console.log("Send password reset email to: ", email);

  if (!email) {
    return redirect("/forgot-password?error=Email is required");
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/update-password`;
  if (process.env.NODE_ENV !== "production")
    console.log("Redirect To URL: ", redirectTo);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("Reset password error: ", error);
    return redirect(
      `/forgot-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  return redirect(
    "/forgot-password?message=Check your email for the password reset link",
  );
}
