"use client"

import { useEffect, useState } from "react"
import { LoopWithDetails } from "@/lib/types"
import { getLoopById } from "@/lib/actions/loops"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer"
import { Loader2 } from "lucide-react"
import { LoopDetailDialog } from "@/components/feed/LoopDetailDialog"
import { splitContentAndImageUrls } from "@/lib/utils"
import { ImageCarousel } from "@/components/feed/ImageCarousel"

interface LoopPreviewProps {
    loopId: string
    currentUserId: string
}

export function LoopPreview({ loopId, currentUserId }: LoopPreviewProps) {
    const [loop, setLoop] = useState<LoopWithDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    useEffect(() => {
        getLoopById(loopId)
            .then((data) => {
                if (data) setLoop(data as LoopWithDetails)
            })
            .catch((err) => console.error("Failed to load loop preview", err))
            .finally(() => setLoading(false))
    }, [loopId])

    if (loading) return (
        <div className="flex items-center justify-center p-4 w-64 h-24 bg-muted/50 rounded-xl border">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
    )

    if (!loop) {
        return (
            <div className="flex items-center gap-2 p-3 w-full max-w-sm bg-background border rounded-lg text-sm text-muted-foreground">
                Loop unavailable
            </div>
        )
    }

    const split = splitContentAndImageUrls(loop.content)

    return (
        <>
            <div
                className="block w-full max-w-sm bg-background backdrop-blur-sm border rounded-lg overflow-hidden  transition-colors group/preview text-left cursor-pointer text-foreground"
                onClick={() => setIsDetailOpen(true)}
            >
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-5 w-5">
                            <AvatarImage src={loop.profiles.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px] text-foreground">
                                <img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-foreground">{loop.profiles.display_name || loop.profiles.username}</span>
                        <span className="text-xs text-muted-foreground">@{loop.profiles.username}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}
                        </span>
                    </div>

                    <div className="text-sm line-clamp-3 text-foreground markdown-preview">
                        <MarkdownRenderer content={split.text} />
                    </div>

                    {split.imageUrls.length > 0 && (
                        <div className="mt-2 rounded-md overflow-hidden h-32 w-full bg-muted relative">
                            <img
                                src={split.imageUrls[0]}
                                alt="Loop attachment"
                                className="w-full h-full object-cover"
                            />
                            {split.imageUrls.length > 1 && (
                                <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                                    + {split.imageUrls.length - 1}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <LoopDetailDialog
                loop={loop}
                isOpen={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                currentUserId={currentUserId}
            />
        </>
    )
}
