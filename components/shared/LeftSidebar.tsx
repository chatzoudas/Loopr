import Link from "next/link"
import Image from "next/image"
import { User, MessageSquare, LogOut, Bell, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import ClientAvatar from "@/components/shared/ClientAvatar";
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { UnreadMessagesBadge } from "../messages/UnreadMessagesBadge"
import { UnreadNotificationsBadge } from "../notifications/UnreadNotificationsBadge"
import { SignOutButton } from "../auth/SignOutButton"
import SidebarKeyBackup from "@/components/messages/SidebarKeyBackup"

export async function LeftSidebar({
    className,
    profileHref = "/profile",
}: {
    className?: string
    profileHref?: string
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    let unreadMessagesCount = 0
    let unreadNotificationsCount = 0

    if (user) {
        const [messagesResult, notificationsResult] = await Promise.all([
            supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("receiver_id", user.id)
                .eq("is_read", false),
            supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("recipient_id", user.id)
                .eq("is_read", false)
        ])

        unreadMessagesCount = messagesResult.count ?? 0
        unreadNotificationsCount = notificationsResult.count ?? 0
    }

    return (
        <aside className={cn("w-64 flex flex-col gap-2", className)}>
            <div className="p-0">
                <Link href="/" className="flex gap-2 font-bold text-2xl items-center p-1 pl-4 pr-4">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={48}
                        height={48}
                        loading="eager"
                        className="w-12 h-12 object-contain pixelated"
                    />
                    <p className="font2 text-2xl">LOOPR</p>
                </Link>
            </div>
            <Card className=" flex flex-col gap-0 p-1 mt-2">

                <nav className="flex-1 p-3 space-y-2 ">
                    <ProfileNavItem profileHref={profileHref} supabase={supabase} userId={user?.id} />

                    <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-base" asChild>
                        <Link href="/messages">
                            <span className="relative flex h-9 w-9 items-center justify-center">
                                <MessageSquare className="h-7 w-7" />
                                {user?.id ? <UnreadMessagesBadge userId={user.id} initialUnreadCount={unreadMessagesCount} /> : null}
                            </span>
                            <span className="leading-none">Messages</span>
                        </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-base" asChild>
                        <Link href="/notifications">
                            <span className="relative flex h-9 w-9 items-center justify-center">
                                <Bell className="h-7 w-7" />
                                {user?.id ? <UnreadNotificationsBadge userId={user.id} initialUnreadCount={unreadNotificationsCount} /> : null}
                            </span>
                            <span className="leading-none">Notifications</span>
                        </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-base" asChild>
                        <Link href="/bookmarks">
                            <span className="relative flex h-9 w-9 items-center justify-center">
                                <Bookmark className="h-7 w-7" />
                            </span>
                            <span className="leading-none">Bookmarks</span>
                        </Link>
                    </Button>
                    <SignOutButton />
                    <SidebarKeyBackup />
                </nav>


            </Card>
        </aside>
    )
}

async function ProfileNavItem({
    profileHref,
    supabase,
    userId,
}: {
    profileHref: string
    supabase: Awaited<ReturnType<typeof createClient>>
    userId?: string
}) {
    let avatarUrl: string | null = null
    let fallbackText = ""
    let displayNameText = ""
    let username = ""

    if (userId) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url,username,display_name")
            .eq("id", userId)
            .maybeSingle()

        avatarUrl = profile?.avatar_url ?? null
        username = profile?.username ?? ""
        fallbackText = username.trim().slice(0, 1).toUpperCase()
        displayNameText = profile?.display_name ?? ""
    }

    return (
        <Button variant="ghost" className="w-full justify-start gap-3 text-base min-h-12 py-2" asChild>
            <Link href={profileHref} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center">
                    <ClientAvatar src={avatarUrl} alt="Your avatar" fallback={<img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />} />
                </span>

                <span className="flex flex-col items-start">
                    <span className="leading-tight">{displayNameText}</span>
                    {displayNameText ? (
                        <span className="text-sm text-muted-foreground leading-tight mt-0.5 truncate max-w-40">
                            @{username}
                        </span>
                    ) : null}
                </span>
            </Link>
        </Button>
    )
}
