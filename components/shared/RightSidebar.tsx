
"use client"
import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Flame, Search } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, splitContentAndImageUrls } from "@/lib/utils"
import { Input } from "../ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { createClient } from "@/lib/supabase/client"
import type { Profile, LoopWithDetails } from "@/lib/types"
import { getTrendingLoops } from "@/lib/actions/loops"
import { LoopDetailDialog } from "@/components/feed/LoopDetailDialog"
import { formatDistanceToNow } from "date-fns"

export function RightSidebar({ className }: { className?: string }) {
    const pathname = usePathname()
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<Profile[]>([])
    const [loading, setLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [trendingLoops, setTrendingLoops] = useState<LoopWithDetails[]>([])
    const [selectedLoop, setSelectedLoop] = useState<LoopWithDetails | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        startTransition(async () => {
            try {
                const loops = await getTrendingLoops()
                setTrendingLoops(loops as unknown as LoopWithDetails[])
            } catch (error) {
                console.error("Failed to load trending loops:", error)
            }
        })
    }, [])

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            setShowDropdown(false)
            return
        }
        setLoading(true)
        const timeout = setTimeout(async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("profiles")
                .select("id,username,display_name,avatar_url")
                .ilike("username", `%${query}%`)
                .limit(8)
            setResults((data as Profile[]) || [])
            setShowDropdown(true)
            setLoading(false)
        }, 300)
        return () => clearTimeout(timeout)
    }, [query])

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false)
            }
        }
        if (showDropdown) {
            document.addEventListener("mousedown", handleClick)
            return () => document.removeEventListener("mousedown", handleClick)
        }
    }, [showDropdown])

    function handleSelectUser(username: string) {
        setShowDropdown(false)
        setQuery("")
        router.push(`/${username}`)
    }

    if (pathname && pathname.startsWith("/messages")) {
        return null
    }

    return (
        <aside className={cn("w-64 flex flex-col gap-2", className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                <Input
                    ref={inputRef}
                    placeholder="Search users"
                    className="h-[50px] text-base shadow-sm pl-10 "
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => query && setShowDropdown(true)}
                    autoComplete="off"
                />
                {showDropdown && (
                    <div
                        ref={dropdownRef}
                        className="absolute left-1/2 top-[110%] z-20 mt-2 w-[20rem] min-w-[20rem] -translate-x-1/2 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-y-auto p-2"
                    >
                        {loading ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">Searching...</div>
                        ) : results.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">No users found</div>
                        ) : (
                            results.map(user => (
                                <button
                                    key={user.id}
                                    className="flex items-center w-full px-4 py-3 gap-3 rounded-lg hover:bg-accent transition-colors text-left"
                                    onClick={() => handleSelectUser(user.username)}
                                    tabIndex={0}
                                >
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={user.avatar_url ?? undefined} alt={user.username} />
                                        <AvatarFallback><img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" /></AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.display_name || user.username}</span>
                                        <span className="text-xs text-muted-foreground">@{user.username}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
            <Card className="min-h-md flex flex-col p-0 gap-0 mt-2">
                <CardHeader className="p-2 pl-4 pb-0">
                    <CardTitle className="text-lg flex flex-row items-center justify-center">
                        Trending
                        <Flame className="inline-block size-5 ml-2 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                    </CardTitle>
                    <div className="border-b w-full my-2" />
                </CardHeader>
                <nav className="flex-1 p-2 space-y-2">
                    {trendingLoops.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground p-4">
                            {isPending ? "Loading trends..." : "No trending loops yet"}
                        </div>
                    ) : (
                        trendingLoops.map((loop) => {
                            const split = splitContentAndImageUrls(loop.content)
                            const textContent = split.text.split('\n')[0].replace(/[#*`]/g, '').trim()
                            const imageCount = split.imageUrls.length
                            const hasCode = loop.content.includes("```")

                            const displayTitle = textContent || (imageCount > 0 ? "Image Post" : "Untitled Loop")

                            return (
                                <button
                                    key={loop.id}
                                    className="w-full text-left p-2 hover:bg-accent rounded-md transition-colors group flex flex-col gap-1"
                                    onClick={() => {
                                        setSelectedLoop(loop)
                                        setIsDetailOpen(true)
                                    }}
                                >
                                    <div className="font-medium text-sm line-clamp-2 leading-snug">
                                        {displayTitle}
                                        {imageCount > 0 && (
                                            <span className="text-muted-foreground ml-1 font-normal">
                                                (Images: {imageCount})
                                            </span>
                                        )}
                                        {hasCode && (
                                            <span className="text-muted-foreground ml-1 font-normal">
                                                (code)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Avatar className="w-4 h-4">
                                                <AvatarImage src={loop.profiles.avatar_url || undefined} />
                                                <AvatarFallback className="text-[10px]">
                                                    <img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate max-w-20">@{loop.profiles.username}</span>
                                        </span>
                                        <span>{formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}</span>
                                    </div>
                                </button>
                            )
                        })
                    )}
                </nav>
            </Card>

            {selectedLoop && (
                <LoopDetailDialog
                    loop={selectedLoop}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                />
            )}
        </aside>
    )
}
