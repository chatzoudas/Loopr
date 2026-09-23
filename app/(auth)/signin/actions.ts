"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/auth/callback`,
        },
      });

      if (resendError) {
        redirect(
          `/signin?error=${encodeURIComponent("Could not authenticate user: " + resendError.message)}&email=${encodeURIComponent(email)}`,
        );
      }

      redirect(
        "/signin?message=" +
          encodeURIComponent(
            "Please verify your email. A new verification link has been sent.",
          ) +
          `&email=${encodeURIComponent(email)}`,
      );
    }

    redirect(
      `/signin?error=Could not authenticate user&email=${encodeURIComponent(email)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

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
    redirect(
      `/signin?error=Could not authenticate user&email=${encodeURIComponent(email)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/signin?message=Check email to continue sign in process");
}

export async function signInWithGithub() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/auth/callback`,
    },
  });

  if (error) {
    redirect("/signin?error=Could not authenticate user");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/signin");
}
