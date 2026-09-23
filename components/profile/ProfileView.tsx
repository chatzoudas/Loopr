"use client";

import { useState } from "react";
import { Profile, LoopWithDetails } from "@/lib/types";
import { ProfileHeader } from "./ProfileHeader";
import { EditProfileDialog } from "./EditProfileDialog";
import { LoopCard } from "@/components/feed/LoopCard";

interface ProfileViewProps {
    profile: Profile;
    currentUser: Profile | null;
    stats: {
        loops: number;
        followers: number;
        following: number;
    };
    loops: LoopWithDetails[];
    isFollowing: boolean;
}

export function ProfileView({ profile, currentUser, stats, loops, isFollowing }: ProfileViewProps) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const isOwnProfile = currentUser?.id === profile.id;

    return (
        <div className="flex flex-col min-h-screen">
            <ProfileHeader
                profile={profile}
                isOwnProfile={isOwnProfile}
                stats={stats}
                isFollowing={isFollowing}
                onEdit={() => setIsEditDialogOpen(true)}
            />

            <div className="border-t mb-4" />

            <div className="flex-1">
                {loops.length > 0 ? (
                    loops.map(loop => (
                        <LoopCard key={loop.id} loop={loop} currentUserId={currentUser?.id} />
                    ))
                ) : (
                    <div className="p-8 text-center text-muted-foreground">
                        No loops yet.
                    </div>
                )}
            </div>

            {isOwnProfile && (
                <EditProfileDialog
                    profile={profile}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                />
            )}
        </div>
    );
}
