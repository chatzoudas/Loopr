"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Heart, MessageSquare, MoreHorizontal, Share, Trash2, Bookmark } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer"
import { LoopWithDetails } from "@/lib/types"
import { toggleLike, toggleBookmark } from "@/lib/actions/interactions"
import { useState, useCallback } from "react"
import { toast } from "sonner"
import { cn, splitContentAndImageUrls } from "@/lib/utils"
import { ImageCarousel } from "@/components/feed/ImageCarousel"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteLoop } from "@/lib/actions/loops"
import { useRouter } from "next/navigation"
import { LoopDetailDialog } from "@/components/feed/LoopDetailDialog"

interface LoopCardProps {
    loop: LoopWithDetails
    currentUserId?: string
}

export function LoopCard({ loop, currentUserId }: LoopCardProps) {
    const [isLiked, setIsLiked] = useState(loop.likes?.some(l => l.user_id === currentUserId) ?? false)
    const [likeCount, setLikeCount] = useState(loop.likes?.length ?? 0)
    const [isbookmarked, setIsbookmarked] = useState(loop.bookmarks?.some(r => r.user_id === currentUserId) ?? false)
    const [bookmarkCount, setbookmarkCount] = useState(loop.bookmarks?.length ?? 0)
    const [commentCount, setCommentCount] = useState(loop.comments?.length ?? 0)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const router = useRouter()

    const isOwner = !!currentUserId && loop.user_id === currentUserId
    const split = splitContentAndImageUrls(loop.content)

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentUserId) return toast.error("Please login to like")

        const newIsLiked = !isLiked
        setIsLiked(newIsLiked)
        setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1)

        const result = await toggleLike(loop.id)
        if (result?.error) {
            setIsLiked(!newIsLiked)
            setLikeCount(prev => !newIsLiked ? prev + 1 : prev - 1)
            toast.error(result.error)
        }
    }

    const handlebookmark = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentUserId) return toast.error("Please login to bookmark")

        const newIsbookmarked = !isbookmarked
        setIsbookmarked(newIsbookmarked)
        setbookmarkCount(prev => newIsbookmarked ? prev + 1 : prev - 1)

        const result = await toggleBookmark(loop.id)
        if (result?.error) {
            setIsbookmarked(!newIsbookmarked)
            setbookmarkCount(prev => !newIsbookmarked ? prev + 1 : prev - 1)
            toast.error(result.error)
        }
    }

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation()
        const url = `${window.location.origin}/?loop=${loop.id}`
        navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
    }

    const handleDelete = async () => {
        if (!isOwner) return

        const result = await deleteLoop(loop.id, loop.profiles.username)
        if (result?.error) {
            toast.error(result.error)
            return
        }

        toast.success(result?.warning ?? "Loop deleted")
        router.refresh()
    }

    const handleDetailOpenChange = useCallback((open: boolean) => {
        setIsDetailOpen(open)
    }, [])

    const handleLikeUpdate = useCallback((newIsLiked: boolean, newCount: number) => {
        setIsLiked(newIsLiked)
        setLikeCount(newCount)
    }, [])

    const handlebookmarkUpdate = useCallback((newIsbookmarked: boolean, newCount: number) => {
        setIsbookmarked(newIsbookmarked)
        setbookmarkCount(newCount)
    }, [])

    const handleCommentUpdate = useCallback((count: number) => {
        setCommentCount(count)
    }, [])

    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

    return (
        <>
            <Card
                className="border-b rounded-none shadow-none border-x-0 sm:border-x sm:rounded-xl sm:mb-4 p-0 gap-0 cursor-pointer transition-colors"
                onClick={() => setIsDetailOpen(true)}
            >
                <CardHeader className="flex flex-row items-center gap-4 p-4 pb-2">
                    <div onClick={stopPropagation}>
                        <Link href={`/${loop.profiles.username}`}>
                            <Avatar>
                                <AvatarImage src={loop.profiles.avatar_url ?? undefined} alt={loop.profiles.username} />
                                <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                            <Link href={`/${loop.profiles.username}`} className="font-semibold hover:underline" onClick={stopPropagation}>
                                {loop.profiles.display_name || loop.profiles.username}
                            </Link>
                            <span className="text-muted-foreground text-sm">@{loop.profiles.username}</span>
                            <span className="text-muted-foreground text-sm">·</span>
                            <span className="text-muted-foreground text-sm">
                                {formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}
                            </span>
                        </div>
                    </div>

                    {isOwner && (
                        <div onClick={stopPropagation}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Open post menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem variant="destructive" onSelect={() => {
                                        setIsDeleteDialogOpen(true)
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="px-4 pt-0 pb-3">
                    <MarkdownRenderer content={split.text} />
                    <ImageCarousel images={split.imageUrls} />
                </CardContent>
                <CardFooter className="px-3 sm:px-4 pt-1 pb-4 flex items-center justify-center">
                    <div className="flex w-full max-w-full items-center justify-around gap-1 rounded-xl bg-muted-foreground/5 px-1.5 py-1 text-muted-foreground min-[1050px]:w-fit min-[1050px]:justify-between min-[1050px]:gap-13 min-[1050px]:px-2" onClick={stopPropagation}>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("shrink-0 gap-1 px-2 min-[1050px]:gap-2 min-[1050px]:px-3", isLiked && "text-red-500 hover:text-red-600")}
                            onClick={handleLike}
                        >
                            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                            <span className="hidden min-[1050px]:inline">{likeCount}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 gap-1 px-2 min-[1050px]:gap-2 min-[1050px]:px-3"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsDetailOpen(true)
                            }}
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden min-[1050px]:inline">{commentCount}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("shrink-0 px-2 min-[1050px]:px-3", isbookmarked && "text-primary")}
                            onClick={handlebookmark}
                        >
                            <Bookmark className={cn("h-4 w-4", isbookmarked && "fill-current")} />
                        </Button>
                        <Button variant="ghost" size="sm" className="shrink-0 px-2 min-[1050px]:px-3" onClick={handleShare}>
                            <Share className="h-4 w-4" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            <LoopDetailDialog
                loop={loop}
                isOpen={isDetailOpen}
                onOpenChange={handleDetailOpenChange}
                currentUserId={currentUserId}
                isLiked={isLiked}
                likeCount={likeCount}
                isbookmarked={isbookmarked}
                bookmarkCount={bookmarkCount}
                onLikeUpdate={handleLikeUpdate}
                onbookmarkUpdate={handlebookmarkUpdate}
                onCommentUpdate={handleCommentUpdate}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this post? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
