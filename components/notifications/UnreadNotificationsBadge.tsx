"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface UnreadNotificationsBadgeProps {
    userId: string
    initialUnreadCount: number
}

export function UnreadNotificationsBadge({ userId, initialUnreadCount }: UnreadNotificationsBadgeProps) {
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        if (!userId) return

        let isMounted = true

        const syncUnreadCount = async () => {
            const { count } = await supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("recipient_id", userId)
                .eq("is_read", false)

            if (isMounted) {
                setUnreadCount(count ?? 0)
            }
        }

        const channel = supabase
            .channel(`unread_notifications_${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `recipient_id=eq.${userId}`,
                },
                syncUnreadCount,
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "notifications",
                    filter: `recipient_id=eq.${userId}`,
                },
                syncUnreadCount,
            )
            .subscribe()

        const handleClearOptimistic = () => {
            if (isMounted) {
                setUnreadCount(0)
            }
        }
        window.addEventListener('clear-unread-notifications', handleClearOptimistic)

        return () => {
            isMounted = false
            supabase.removeChannel(channel)
            window.removeEventListener('clear-unread-notifications', handleClearOptimistic)
        }
    }, [supabase, userId])

    if (unreadCount <= 0) {
        return null
    }

    const label = unreadCount > 9 ? "9+" : String(unreadCount)
    const isOverflow = unreadCount > 9

    return (
        <span
            className={`absolute -top-1.5 -right-1.5 ${isOverflow ? "min-w-6 px-1.5" : "min-w-5 px-1"} h-5 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center font-bold tabular-nums ring-2 ring-background shadow-sm`}
            aria-label={`${unreadCount} unread notifications`}
            title={`${unreadCount} unread notifications`}
        >
            {label}
        </span>
    )
}
