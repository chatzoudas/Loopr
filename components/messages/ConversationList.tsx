"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Profile } from "@/lib/types"

interface ConversationListProps {
    conversations: Profile[]
    selectedId?: string
    onSelect: (id: string) => void
    unreadByUser?: Record<string, number>
}

export function ConversationList({ conversations, selectedId, onSelect, unreadByUser = {} }: ConversationListProps) {
    const [searchQuery, setSearchQuery] = useState("")

    const filteredConversations = conversations.filter(profile => {
        const query = searchQuery.toLowerCase()
        return (
            profile.username.toLowerCase().includes(query) ||
            (profile.display_name && profile.display_name.toLowerCase().includes(query))
        )
    })

    return (
        <div className="flex flex-col gap-2">
            <div className="relative px-2 pb-2">
                <Search className="absolute left-4 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>
            {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                    {searchQuery ? "No conversations found" : "No conversations yet"}
                </div>
            ) : (
                filteredConversations.map((profile) => (
                    <button
                        key={profile.id}
                        onClick={() => onSelect(profile.id)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left w-full",
                            selectedId === profile.id && "bg-muted"
                        )}
                    >
                        <Avatar>
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-medium truncate">{profile.display_name || profile.username}</div>
                            <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
                        </div>
                        {(unreadByUser[profile.id] ?? 0) > 0 ? (
                            <span className={`h-5 ${(unreadByUser[profile.id] ?? 0) > 9 ? "min-w-6 px-1.5" : "min-w-5 px-1"} rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center font-bold tabular-nums ring-2 ring-card shadow-sm`}>
                                {unreadByUser[profile.id] > 9 ? "9+" : unreadByUser[profile.id]}
                            </span>
                        ) : null}
                    </button>
                ))
            )}
        </div>
    )
}
