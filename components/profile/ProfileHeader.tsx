"use client";

import { Profile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useState, useTransition, useEffect } from "react";
import { toggleFollow } from "@/lib/actions/interactions";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LANGUAGE_ICONS: Record<string, string> = {
    "C": "/langicons/C.webp",
    "C#": "/langicons/C_.webp",
    "C++": "/langicons/C__.webp",
    "Delphi": "/langicons/Delphi_Object_Pascal.webp",
    "Java": "/langicons/Java.webp",
    "JavaScript": "/langicons/JavaScript.webp",
    "Perl": "/langicons/Perl.webp",
    "PHP": "/langicons/PHP.webp",
    "Python": "/langicons/Python.webp",
    "Rust": "/langicons/Rust.webp",
    "SQL": "/langicons/SQL.webp",
    "Swift": "/langicons/Swift.webp",
};

interface ProfileHeaderProps {
    profile: Profile;
    isOwnProfile: boolean;
    stats: {
        loops: number;
        followers: number;
        following: number;
    };
    isFollowing?: boolean;
    onEdit?: () => void;
}

export function ProfileHeader({ profile, isOwnProfile, stats: propStats, isFollowing: propIsFollowing = false, onEdit }: ProfileHeaderProps) {
    const [isPending, startTransition] = useTransition();
    const [isFollowing, setIsFollowing] = useState(propIsFollowing);
    const [stats, setStats] = useState(propStats);
    const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

    useEffect(() => {
        setIsFollowing(propIsFollowing);
        setStats(propStats);
    }, [propIsFollowing, propStats]);

    const handleFollowClick = () => {
        if (isFollowing) {
            setShowUnfollowDialog(true);
        } else {
            executeFollowToggle();
        }
    };

    const executeFollowToggle = () => {
        if (isPending) return;

        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setStats(prev => ({
            ...prev,
            followers: wasFollowing ? prev.followers - 1 : prev.followers + 1
        }));
        setShowUnfollowDialog(false);

        startTransition(async () => {
            const result = await toggleFollow(profile.id);
            if (result?.error) {
                setIsFollowing(wasFollowing);
                setStats(prev => ({
                    ...prev,
                    followers: wasFollowing ? prev.followers : prev.followers
                }));
                console.error(result.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 p-6 ">
            <div className="flex justify-between items-start">
                <div className="flex gap-4">
                    <Avatar className="w-30 h-30 text-2xl font-bold">
                        <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.username} />
                        <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0">
                        <h1 className="text-3xl font-bold">{profile.display_name || profile.username}</h1>
                        <p className="text-muted-foreground text-lg">@{profile.username}</p>
                    </div>
                </div>
                <div>
                    {isOwnProfile ? (
                        <Button variant="outline" onClick={onEdit}>Edit Profile</Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant={isFollowing ? "destructive" : "default"}
                                onClick={handleFollowClick}
                                disabled={isPending}
                            >
                                {isFollowing ? "Unfollow" : "Follow"}
                            </Button>
                            <Button variant="secondary" asChild >
                                <Link href={`/messages?userId=${profile.id}`}>Message</Link>
                            </Button>

                            <Dialog open={showUnfollowDialog} onOpenChange={setShowUnfollowDialog}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Unfollow @{profile.username}?</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to shorten your loop by unfollowing this user?
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowUnfollowDialog(false)}>Cancel</Button>
                                        <Button variant="destructive" onClick={executeFollowToggle}>Unfollow</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
            </div>

            {profile.bio && (
                <div className="text-sm whitespace-pre-wrap">
                    {profile.bio}
                </div>
            )}

            {profile.tech_stack && profile.tech_stack.length > 0 && (
                <TooltipProvider>
                    <div className="flex gap-2 flex-wrap">
                        {profile.tech_stack.map((tech) => (
                            <Tooltip key={tech}>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center p-1.5 bg-secondary text-secondary-foreground rounded-full cursor-default">
                                        {LANGUAGE_ICONS[tech] ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={LANGUAGE_ICONS[tech]} alt={tech} className="w-7 h-7 object-contain" />
                                        ) : (
                                            <span className="w-7 h-7 flex items-center justify-center text-sm font-bold uppercase">{tech[0]}</span>
                                        )}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>{tech}</TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            )}

            <div className="flex gap-6 text-sm">
                <div className="flex gap-1">
                    <span className="font-bold">{stats.loops}</span>
                    <span className="text-muted-foreground">Loops</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold">{stats.followers}</span>
                    <span className="text-muted-foreground">Followers</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold">{stats.following}</span>
                    <span className="text-muted-foreground">Following</span>
                </div>
            </div>

            <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>Joined {format(new Date(profile.created_at), "d MMMM yyyy")}</span>
                </div>
            </div>
        </div>
    );
}
