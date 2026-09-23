"use client"

import { useState, useEffect, useTransition, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoopWithDetails } from "@/lib/types"
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, Send, Heart, Share, ChevronUp, ArrowDownUp, Dot, Trash2, Bookmark } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { addComment, getComments, deleteComment, toggleCommentLike } from "@/lib/actions/comments"
import { toggleLike, toggleBookmark } from "@/lib/actions/interactions"
import { deleteLoop } from "@/lib/actions/loops"
import { toast } from "sonner"
import { cn, splitContentAndImageUrls } from "@/lib/utils"
import { ImageCarousel } from "@/components/feed/ImageCarousel"
import Link from "next/link"
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

interface Comment {
    id: string
    content: string
    created_at: string
    user_id: string
    parent_id: string | null
    profiles: {
        username: string
        display_name: string | null
        avatar_url: string | null
    }
    likes: { user_id: string }[]
}

interface LoopDetailDialogProps {
    loop: LoopWithDetails
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    currentUserId?: string
    isLiked?: boolean
    likeCount?: number
    isbookmarked?: boolean
    bookmarkCount?: number
    onLikeUpdate?: (isLiked: boolean, count: number) => void
    onbookmarkUpdate?: (isbookmarked: boolean, count: number) => void
    onCommentUpdate?: (count: number) => void
}

export function LoopDetailDialog({
    loop,
    isOpen,
    onOpenChange,
    currentUserId,
    isLiked: propIsLiked,
    likeCount: propLikeCount,
    isbookmarked: propIsbookmarked,
    bookmarkCount: propbookmarkCount,
    onLikeUpdate,
    onbookmarkUpdate,
    onCommentUpdate
}: LoopDetailDialogProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState("")
    const [isPending, startTransition] = useTransition()
    const [loadingComments, setLoadingComments] = useState(false)
    const [sortOrder, setSortOrder] = useState<"top" | "newest" | "oldest">("top")

    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [replyContent, setReplyContent] = useState("")
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

    const [isLiked, setIsLiked] = useState(propIsLiked ?? (loop.likes?.some(l => l.user_id === currentUserId) ?? false))
    const [likeCount, setLikeCount] = useState(propLikeCount ?? (loop.likes?.length ?? 0))
    const [isbookmarked, setIsbookmarked] = useState(propIsbookmarked ?? (loop.bookmarks?.some(r => r.user_id === currentUserId) ?? false))
    const [bookmarkCount, setbookmarkCount] = useState(propbookmarkCount ?? (loop.bookmarks?.length ?? 0))
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    const split = splitContentAndImageUrls(loop.content)

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?loop=${loop.id}`

        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success("Link copied to clipboard")
        } catch {
            window.prompt("Copy this link", shareUrl)
        }
    }

    useEffect(() => {
        if (isOpen) {
            setLoadingComments(true)
            getComments(loop.id)
                .then((data: Comment[] | null | []) => {
                    const validComments = Array.isArray(data) ? data : []
                    setComments(validComments as Comment[])
                    if (validComments.length !== undefined) {
                        onCommentUpdate?.(validComments.length)
                    }
                })
                .catch(err => console.error("Error fetching comments:", err))
                .finally(() => setLoadingComments(false))
        }
    }, [isOpen, loop.id, onCommentUpdate])

    useEffect(() => {
        if (propIsLiked !== undefined) setIsLiked(propIsLiked)
        if (propLikeCount !== undefined) setLikeCount(propLikeCount)
    }, [propIsLiked, propLikeCount])

    useEffect(() => {
        if (propIsbookmarked !== undefined) setIsbookmarked(propIsbookmarked)
        if (propbookmarkCount !== undefined) setbookmarkCount(propbookmarkCount)
    }, [propIsbookmarked, propbookmarkCount])

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentUserId) return toast.error("Please login to like")

        const newIsLiked = !isLiked
        const newCount = newIsLiked ? likeCount + 1 : likeCount - 1

        setIsLiked(newIsLiked)
        setLikeCount(newCount)
        onLikeUpdate?.(newIsLiked, newCount)

        const result = await toggleLike(loop.id)
        if (result?.error) {
            setIsLiked(!newIsLiked)
            setLikeCount(likeCount)
            onLikeUpdate?.(!newIsLiked, likeCount)
            toast.error(result.error)
        }
    }

    const handlebookmark = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentUserId) return toast.error("Please login to bookmark")

        const newIsbookmarked = !isbookmarked
        const newCount = newIsbookmarked ? bookmarkCount + 1 : bookmarkCount - 1

        setIsbookmarked(newIsbookmarked)
        setbookmarkCount(newCount)
        onbookmarkUpdate?.(newIsbookmarked, newCount)

        const result = await toggleBookmark(loop.id)
        if (result?.error) {
            setIsbookmarked(!newIsbookmarked)
            setbookmarkCount(bookmarkCount)
            onbookmarkUpdate?.(!newIsbookmarked, bookmarkCount)
            toast.error(result.error)
        }
    }

    const handleAddComment = (parentId?: string) => {
        const content = parentId ? replyContent : newComment
        if (!content.trim()) return

        startTransition(async () => {
            const result = await addComment(loop.id, content, parentId)
            if (result.error) {
                toast.error(result.error)
            } else {
                if (parentId) {
                    setReplyContent("")
                    setReplyingTo(null)
                    setExpandedComments(prev => {
                        const newSet = new Set(prev)
                        newSet.add(parentId)
                        return newSet
                    })
                } else {
                    setNewComment("")
                }

                const updatedComments = await getComments(loop.id)
                setComments(updatedComments as Comment[])
                if (updatedComments) {
                    onCommentUpdate?.(updatedComments.length)
                }
                toast.success(parentId ? "Reply added" : "Comment added")
            }
        })
    }

    const handleDeleteComment = async (commentId: string) => {
        const result = await deleteComment(commentId)
        if (result.error) {
            toast.error(result.error)
        } else {
            const newComments = comments.filter(c => c.id !== commentId)
            setComments(newComments)
            onCommentUpdate?.(newComments.length)
            toast.success("Comment deleted")
        }
    }

    const handleToggleCommentLike = async (commentId: string) => {
        if (!currentUserId) return toast.error("Login to like comments")

        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                const currentLikes = c.likes || []
                const isLiked = currentLikes.some(l => l.user_id === currentUserId)

                const newLikes = isLiked
                    ? currentLikes.filter(l => l.user_id !== currentUserId)
                    : [...currentLikes, { user_id: currentUserId! }]

                return { ...c, likes: newLikes }
            }
            return c
        }))

        const result = await toggleCommentLike(commentId)
        if (result?.error) {
            const updatedComments = await getComments(loop.id)
            setComments(updatedComments as Comment[])
            toast.error(result.error)
        }
    }

    const toggleReplies = (commentId: string) => {
        setExpandedComments(prev => {
            const newSet = new Set(prev)
            if (newSet.has(commentId)) {
                newSet.delete(commentId)
            } else {
                newSet.add(commentId)
            }
            return newSet
        })
    }

    const renderComment = (comment: Comment, depth = 0) => {
        const isLiked = comment.likes?.some(l => l.user_id === currentUserId) ?? false
        const likeCount = comment.likes?.length || 0
        const replies = comments.filter(c => c.parent_id && c.parent_id === comment.id)
        const hasReplies = replies.length > 0
        const isExpanded = expandedComments.has(comment.id)
        const isReplying = replyingTo === comment.id

        return (
            <div key={comment.id} className={cn("flex gap-3 group", depth > 0 && "mt-4 ml-8")}>
                <Link href={`/${comment.profiles.username}`} onClick={() => onOpenChange(false)}>
                    <Avatar className="h-6 w-6 mt-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={comment.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                            <img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />
                        </AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex-1 min-w-[250px]">
                    <div className="bg-muted px-3 py-2 rounded-2xl inline-block max-w-full">
                        <div className="flex justify-between items-baseline gap-2 mb-0.5">
                            <Link href={`/${comment.profiles.username}`} onClick={() => onOpenChange(false)}>
                                <span className="font-semibold text-xs hover:underline cursor-pointer">
                                    {comment.profiles.display_name || comment.profiles.username}
                                </span>
                            </Link>
                            <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                        </div>
                        <div className="text-sm">
                            <MarkdownRenderer content={comment.content} />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mt-1 ml-1">
                        <button
                            onClick={() => handleToggleCommentLike(comment.id)}
                            className={cn(
                                "text-xs font-medium flex items-center gap-1 transition-colors",
                                isLiked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Heart className={cn("w-3 h-3", isLiked && "fill-current")} />
                            {likeCount > 0 && <span>{likeCount}</span>}
                        </button>

                        <button
                            onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                            Reply
                        </button>

                        {currentUserId === comment.user_id && (
                            <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Delete
                            </button>
                        )}
                    </div>

                    {isReplying && (
                        <div className="mt-2 flex gap-2 items-start">
                            <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                    <img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex gap-2">
                                <Textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder={`Reply to ${comment.profiles.username}...`}
                                    className="min-h-8 h-9 py-1.5 text-sm resize-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleAddComment(comment.id)
                                        }
                                    }}
                                />
                                <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => handleAddComment(comment.id)} disabled={!replyContent.trim() || isPending}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {hasReplies && (
                        <div className="mt-1">
                            {!isExpanded ? (
                                <button
                                    onClick={() => toggleReplies(comment.id)}
                                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium mt-1"
                                >
                                    <div className="w-8 h-px bg-border mr-1"></div>
                                    Show {replies.length} replies
                                </button>
                            ) : (
                                <button
                                    onClick={() => toggleReplies(comment.id)}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium mt-1 mb-2"
                                >
                                    <ChevronUp className="w-3 h-3" />
                                    Hide replies
                                </button>
                            )}

                            {isExpanded && (
                                <div className={cn("space-y-2 mt-2 border-muted", depth >= 4 ? "border-l pl-2" : "border-l-2 pl-0")}>
                                    {replies.map(reply => renderComment(reply, depth + 1))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const topLevelComments = useMemo(() => {
        const rootComments = comments.filter(c => !c.parent_id)

        switch (sortOrder) {
            case "top":
                return rootComments.sort((a, b) => {
                    const likesA = a.likes?.length || 0
                    const likesB = b.likes?.length || 0
                    if (likesA !== likesB) return likesB - likesA
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
            case "newest":
                return rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            case "oldest":
                return rootComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            default:
                return rootComments
        }
    }, [comments, sortOrder])


    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-6xl max-w-[95vw] w-full h-[80vh] p-0 gap-0 overflow-hidden flex flex-col md:flex-row">
                    <div className="sr-only">
                        <DialogTitle>Loop by {loop.profiles.display_name || loop.profiles.username}</DialogTitle>
                    </div>
                    <div className="flex-1 overflow-y-auto border-r p-6">
                        <div className="flex flex-row justify-between mb-4">
                            <Link href={`/${loop.profiles.username}`} onClick={() => onOpenChange(false)}>
                                <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={loop.profiles.avatar_url || undefined} />
                                        <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-semibold hover:underline">{loop.profiles.display_name || loop.profiles.username}</div>
                                        <div className="text-sm text-muted-foreground">@{loop.profiles.username}</div>
                                    </div>
                                </div>
                            </Link>
                            <div className="flex gap-2"><div className="flex items-center gap-4 bg-muted-foreground/5 rounded-xl px-2 py-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors",
                                        isLiked && "text-red-500"
                                    )}
                                    onClick={handleLike}
                                >
                                    <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                                    <span>{likeCount}</span>
                                </Button>
                                <div className="flex items-center gap-1.5 text-muted-foreground text-sm px-3">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>{comments.length}</span>
                                </div>


                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "text-muted-foreground hover:text-primary transition-colors",
                                        isbookmarked && "text-primary"
                                    )}
                                    onClick={handlebookmark}
                                >
                                    <Bookmark className={cn("w-4 h-4", isbookmarked && "fill-current")} />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                    onClick={handleShare}
                                >
                                    <Share className="w-4 h-4" />
                                </Button>
                            </div>
                                {currentUserId === loop.user_id && (
                                    <div className="flex items-center gap-4 bg-muted-foreground/5 rounded-xl px-2 py-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-red-500 transition-colors"
                                            onClick={() => setIsDeleteDialogOpen(true)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="prose dark:prose-invert max-w-none text-foreground mb-4">
                            <MarkdownRenderer content={split.text} />
                            <ImageCarousel images={split.imageUrls} />
                        </div>

                        <div className="text-sm text-muted-foreground mt-4">
                            {formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}
                        </div>
                    </div>
                    <div className="w-full md:w-[400px] flex flex-col h-full bg-muted/10">
                        <div className="p-4 border-b font-semibold flex items-center justify-start gap-2">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Comments
                            </div>
                            <Dot />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs p-2">
                                        <ArrowDownUp className="w-3 h-3" />
                                        {sortOrder === "top" ? "Top" : sortOrder === "newest" ? "Newest" : "Oldest"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSortOrder("top")}>
                                        Top (Most Likes)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                                        Newest First
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                                        Oldest First
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            {loadingComments ? (
                                <div className="text-center text-muted-foreground py-8">Loading comments...</div>
                            ) : comments.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">No comments yet. Be the first!</div>
                            ) : topLevelComments.length > 0 ? (
                                <div className="space-y-4 w-full">
                                    {topLevelComments.map((comment) => renderComment(comment))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No top-level comments found. ({comments.length} replies mostly?)
                                    <br />
                                    <span className="text-xs">{JSON.stringify(comments.map(c => c.parent_id))}</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-background">
                            <div className="flex gap-2">
                                <Textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Type a comment..."
                                    className="min-h-10 max-h-32 resize-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleAddComment()
                                        }
                                    }}
                                />
                                <Button
                                    size="icon"
                                    disabled={!newComment.trim() || isPending}
                                    onClick={() => handleAddComment()}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

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
                            onClick={async () => {
                                const result = await deleteLoop(loop.id, loop.profiles.username);
                                if (result?.error) {
                                    toast.error(result.error);
                                } else {
                                    toast.success("Post deleted");
                                    onOpenChange(false);
                                    window.location.reload();
                                }
                            }}
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
