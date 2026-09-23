import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile/ProfileView";

interface PageProps {
    params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
    const { username } = await params;
    const supabase = await createClient();

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

    if (profileError || !profile) {
        notFound();
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    let currentUserProfile = null;
    if (authUser) {
        const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
        currentUserProfile = data;
    }

    const { data: loops, error: loopsError } = await supabase
        .from("loops")
        // explicit fk or supabase guesses the join wrong
        .select(
            `
            *,
            profiles!loops_user_id_fkey (*),
            likes (user_id),
            bookmarks (user_id),
            comments (id)
            `
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

    if (loopsError) {
        console.error("Error fetching profile loops:", loopsError);
    }

    const { count: loopsCount } = await supabase
        .from("loops")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);

    const { count: followersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id);

    const { count: followingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id);

    const stats = {
        loops: loopsCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0,
    };

    let isFollowing = false;
    if (authUser && profile.id !== authUser.id) {
        const { data: followData } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", authUser.id)
            .eq("following_id", profile.id)
            .single();
        isFollowing = !!followData;
    }

    return (
        <ProfileView
            profile={profile}
            currentUser={currentUserProfile}
            stats={stats}
            loops={loops || []}
            isFollowing={isFollowing}
        />
    );
}
