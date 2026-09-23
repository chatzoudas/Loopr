"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(message: string, email: string) {
  redirect(
    `/signup?error=${encodeURIComponent(message)}&email=${encodeURIComponent(email)}`,
  );
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    redirectWithError("Passwords do not match", email);
  }

  if (password.length < 8) {
    redirectWithError("Password must be at least 8 characters", email);
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/auth/callback`,
    },
  });

  if (error) {
    redirectWithError(error.message, email);
  }

  revalidatePath("/", "layout");
  redirect(
    "/signup?message=" +
      encodeURIComponent(
        "Check your email to verify your account. You can close this tab after confirming.",
      ),
  );
}
