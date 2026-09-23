"use client";

import { useEffect, useTransition, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageSquare, UserPlus, AtSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Notification } from "@/lib/types";
import { markNotificationsAsRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/client";

const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
        case 'like':
        case 'comment_like':
            return <Heart className="h-4 w-4 text-red-500 fill-current" />;
        case 'comment':
            return <MessageSquare className="h-4 w-4 text-blue-500" />;
        case 'follow':
            return <UserPlus className="h-4 w-4 text-green-500" />;
        case 'mention':
            return <AtSign className="h-4 w-4 text-orange-500" />;
        default:
            return null;
    }
};

const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
        case 'like':
            return 'liked your loop';
        case 'comment_like':
            return 'liked your comment';
        case 'comment':
            return 'commented on your loop';
        case 'follow':
            return 'started following you';
        case 'mention':
            if (notification.comment_id) {
                return 'mentioned you in a comment';
            } else if (notification.loop_id) {
                return 'mentioned you in a post';
            }
            return 'mentioned you';
        default:
            return 'interacted with you';
    }
};

const getNotificationLink = (notification: Notification, actorUsername: string) => {
    if (notification.type === 'follow') {
        return actorUsername ? `/${actorUsername}` : '#';
    }
    if (notification.message_id) {
        return `/messages`;
    }
    if (notification.loop_id) {
        return `/?loop=${notification.loop_id}`;
    }
    return '#';
};

export function NotificationItem({ notification, isUnreadVisual, onObserve }: { notification: Notification, isUnreadVisual: boolean, onObserve?: () => void }) {
    const actor = notification.actor;
    const actorName = actor?.display_name || actor?.username || 'Someone';
    const actorUsername = actor?.username || '';

    const href = getNotificationLink(notification, actorUsername);

    return (
        <Link href={href} className="block" onClick={onObserve}>
            <div className={cn(
                "relative p-4 border-b flex gap-4 hover:bg-muted/50 transition-colors",
                isUnreadVisual && "bg-muted/20"
            )}>
                {isUnreadVisual && (
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500" title="Unread" />
                )}
                <div className="flex flex-col items-center justify-center gap-2 pt-1">
                    <div className="relative">
                        {getNotificationIcon(notification.type)}
                    </div>
                </div>

                <div className="flex flex-col flex-1 gap-1 pr-6">
                    <Avatar className="h-8 w-8 mb-1">
                        <AvatarImage src={actor?.avatar_url || undefined} />
                        <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                        <span className="font-semibold hover:underline">
                            {actorName}
                        </span>{' '}
                        {notification.type === 'follow' && actorUsername && (
                            <span className="text-muted-foreground font-normal">@{actorUsername} </span>
                        )}
                        {getNotificationText(notification)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </div>
                </div>
            </div>
        </Link>
    );
}

export function NotificationList({ notifications: initialNotifications, userId }: { notifications: Notification[], userId?: string }) {
    const [isPending, startTransition] = useTransition();
    const [visibleUnreadIds, setVisibleUnreadIds] = useState<Set<string>>(new Set());
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
    const addedIdsRef = useRef<Set<string>>(new Set(initialNotifications.map(n => n.id)));
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        setNotifications(initialNotifications);
        initialNotifications.forEach(n => addedIdsRef.current.add(n.id));
    }, [initialNotifications]);

    useEffect(() => {
        if (!supabase || !userId) return;

        let isMounted = true;

        const channel = supabase
            .channel(`realtime:notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${userId}`,
                },
                async (payload) => {
                    if (!isMounted) return;

                    const notificationId = payload.new.id;

                    if (addedIdsRef.current.has(notificationId)) {
                        return;
                    }

                    addedIdsRef.current.add(notificationId);

                    const { data, error } = await supabase
                        .from('notifications')
                        .select(`
                            *,
                            actor:actor_id (
                                id,
                                username,
                                display_name,
                                avatar_url
                            )
                        `)
                        .eq('id', notificationId)
                        .single();

                    if (!error && data && isMounted) {
                        setNotifications(prev => {
                            if (prev.some(n => n.id === notificationId)) {
                                return prev;
                            }
                            return [data as Notification, ...prev];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${userId}`,
                },
                (payload) => {
                    if (!isMounted) return;

                    setNotifications(prev =>
                        prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
                    );
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [supabase, userId]);

    useEffect(() => {
        setVisibleUnreadIds(prev => {
            const next = new Set(prev);
            let addedNew = false;

            notifications.forEach(n => {
                if (!n.is_read && !next.has(n.id)) {
                    next.add(n.id);
                    addedNew = true;
                }
            });

            return addedNew ? next : prev;
        });

        const unreadExists = notifications.some(n => !n.is_read);
        if (unreadExists) {
            window.dispatchEvent(new CustomEvent('clear-unread-notifications'));

            startTransition(() => {
                markNotificationsAsRead();
            });
        }
    }, [notifications]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setVisibleUnreadIds(new Set());
            }
        };

        const handleBlur = () => {
            setVisibleUnreadIds(new Set());
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    if (!notifications || notifications.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                No notifications yet.
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isUnreadVisual={visibleUnreadIds.has(notification.id)} onObserve={() => {
                        setVisibleUnreadIds(prev => {
                            const next = new Set(prev);
                            next.delete(notification.id);
                            return next;
                        });
                    }} />
            ))}
        </div>
    );
}
