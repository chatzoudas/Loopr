import { Message } from "@/lib/types"
import { cn, splitContentAndImageUrls, getMessageImageUrls } from "@/lib/utils"
import { Check, CheckCheck, Ellipsis, Copy, Clock, Info, Trash2 } from "lucide-react"
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer"
import { LoopPreview } from "@/components/messages/LoopPreview"
import { ImageCarousel } from "@/components/feed/ImageCarousel"
import { EncryptedImageDisplay } from "@/components/messages/EncryptedImageDisplay"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { toast } from "sonner"

interface MessageBubbleProps {
    message: Message
    isMe: boolean
    position?: 'single' | 'top' | 'middle' | 'bottom'
    onDelete?: (id: string) => void | Promise<void>
}

export function MessageBubble({ message, isMe, position = 'single', onDelete }: MessageBubbleProps) {
    const timeString = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const handleCopy = () => {
        navigator.clipboard.writeText(displayContent)
        toast.success("Message copied to clipboard")
    }

    const handleDelete = () => {
        onDelete?.(message.id);
    }

    const isValidHttpUrl = (value: string): boolean => {
        try {
            const parsed = new URL(value)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
            const withoutProtocol = value.replace(/^https?:\/\//i, '')
            if (/https?:\/\//i.test(withoutProtocol)) return false
            return true
        } catch {
            return false
        }
    }

    const stripTrailingPunctuation = (value: string) => value.replace(/[.,;!?\)\]\}]+$/, '')

    const { text: textWithoutImages, imageUrls: embeddedImageUrls } =
        splitContentAndImageUrls(message.content || "")
    const imageUrls = Array.from(
        new Set([...getMessageImageUrls(message), ...embeddedImageUrls]),
    )

    const regularImageUrls = imageUrls.filter((u) => !u.startsWith("e2ee-img://"))
    const e2eeImageTokens = imageUrls.filter((u) => u.startsWith("e2ee-img://"))

    const urlTokens = textWithoutImages.match(/https?:\/\/[^\s]+/g) ?? []
    const validLoopEntries = urlTokens
        .map((token) => {
            const cleaned = stripTrailingPunctuation(token)
            if (!isValidHttpUrl(cleaned)) return null
            const parsed = new URL(cleaned)
            const candidateLoopId = parsed.searchParams.get('loop')
            if (!candidateLoopId || !/^[a-zA-Z0-9-]+$/.test(candidateLoopId)) return null
            return { token, loopId: candidateLoopId }
        })
        .filter((entry): entry is { token: string; loopId: string } => entry !== null)

    const loopIds = validLoopEntries.map((entry) => entry.loopId)

    const displayContent = validLoopEntries.length > 0
        ? validLoopEntries.reduce((content, entry) => content.replace(entry.token, ''), textWithoutImages).trim()
        : textWithoutImages

    const isOnlyImage = !displayContent && loopIds.length === 0 && (regularImageUrls.length > 0 || e2eeImageTokens.length > 0) && imageUrls.length > 0

    const getBubbleClasses = () => {
        const padding = isOnlyImage ? "p-0 overflow-hidden" : ((!displayContent && (loopIds.length > 0 || imageUrls.length > 0)) ? "p-2" : "px-3 py-2")
        const base = `max-w-[85%] ${padding} text-sm transition-all`


        if (isMe) {
            const color = isOnlyImage ? "" : "bg-primary text-primary-foreground"
            switch (position) {
                case 'top':
                    return cn(base, color, "rounded-2xl rounded-br-sm")
                case 'middle':
                    return cn(base, color, "rounded-l-2xl rounded-r-sm")
                case 'bottom':
                    return cn(base, color, "rounded-2xl rounded-tr-sm")
                default:
                    return cn(base, color, "rounded-2xl")
            }
        } else {
            const color = isOnlyImage ? "" : "bg-muted text-foreground"
            switch (position) {
                case 'top':
                    return cn(base, color, "rounded-2xl rounded-bl-sm")
                case 'middle':
                    return cn(base, color, "rounded-r-2xl rounded-l-sm")
                case 'bottom':
                    return cn(base, color, "rounded-2xl rounded-tl-sm")
                default:
                    return cn(base, color, "rounded-2xl")
            }
        }
    }

    return (
        <div className={cn("flex w-full group items-center gap-2", isMe ? "justify-end" : "justify-start")}>
            {isMe && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 outline-none">
                        <Ellipsis className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {displayContent && (
                            <DropdownMenuItem onClick={handleCopy}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Copy Text</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={handleDelete} className="text-red-500 hover:text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Message</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="opacity-100 cursor-default">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Sent {timeString}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="opacity-100 cursor-default">
                            {message.is_read ? <CheckCheck className="mr-2 h-4 w-4 text-green-500" /> : <Check className="mr-2 h-4 w-4" />}
                            <span>{message.is_read ? "Read" : "Sent"}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <div className={cn(getBubbleClasses(), isMe ? "[&_a]:!text-primary-foreground" : "")}>
                <div>
                    {displayContent && (
                        <MarkdownRenderer content={displayContent} variant="chat" />
                    )}
                    {regularImageUrls.length > 0 && (
                        <div className={cn(displayContent ? "mt-2 pt-2 border-t border-border/20" : "")}>
                            <ImageCarousel images={regularImageUrls} noMargin={isOnlyImage} />
                        </div>
                    )}
                    {e2eeImageTokens.length > 0 && (
                        <div className={cn(displayContent || regularImageUrls.length > 0 ? "mt-2 pt-2 border-t border-border/20" : "", "space-y-2")}>
                            {e2eeImageTokens.map((token) => (
                                <EncryptedImageDisplay key={token} token={token} />
                            ))}
                        </div>
                    )}
                    {loopIds.length > 0 && (
                        <div className={cn((displayContent || imageUrls.length > 0) ? "mt-2 pt-2 border-t border-border/20" : "", "space-y-2", isMe ? "text-primary-foreground" : "")}>
                            {loopIds.map((loopId, index) => (
                                <div key={`${message.id}-${loopId}-${index}`} className="rounded-lg overflow-hidden">
                                    <LoopPreview
                                        loopId={loopId}
                                        currentUserId={isMe ? message.sender_id : message.receiver_id}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {!isMe && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 outline-none">
                        <Ellipsis className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {displayContent && (
                            <DropdownMenuItem onClick={handleCopy}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Copy Text</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="opacity-100 cursor-default">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Sent {timeString}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
