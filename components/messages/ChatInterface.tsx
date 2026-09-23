"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { Profile } from "@/lib/types"
import { ConversationList } from "./ConversationList"
import { MessageBubble } from "./MessageBubble"
import { MessageInput } from "./MessageInput"
import { useChat } from "./useChat"
import { createClient } from "@/lib/supabase/client"
import { Message } from "@/lib/types"

interface ChatInterfaceProps {
    currentUser: Profile
    initialConversations: Profile[]
    initialSelectedId?: string
    initialUnreadByUser?: Record<string, number>
}

export function ChatInterface({ currentUser, initialConversations, initialSelectedId, initialUnreadByUser = {} }: ChatInterfaceProps) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(
        initialSelectedId || null
    )
    const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>(initialUnreadByUser)
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        if (initialSelectedId) {
            setSelectedUserId(initialSelectedId)
        }
    }, [initialSelectedId])

    useEffect(() => {
        if (!selectedUserId) return

        setUnreadByUser((prev) => ({
            ...prev,
            [selectedUserId]: 0,
        }))
    }, [selectedUserId])

    const { messages, loading, sendMessage, deleteMessage } = useChat(currentUser.id, selectedUserId)
    const scrollRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isNearBottom, setIsNearBottom] = useState(true)
    const selectedConversation = initialConversations.find((conversation) => conversation.id === selectedUserId)

    const latestSeenOutgoingMessageId = messages
        .filter((m) => m.sender_id === currentUser.id && m.is_read)
        .at(-1)?.id

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }

    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        setIsNearBottom(scrollHeight - scrollTop - clientHeight < 500)
    }

    useEffect(() => {
        if (!scrollRef.current) return

        const resizeObserver = new ResizeObserver(() => {
            // no smooth scrolling here it jitters like crazy when images load
            if (isNearBottom) {
                scrollToBottom()
            }
        })

        if (scrollRef.current.firstElementChild) {
            resizeObserver.observe(scrollRef.current.firstElementChild)
            Array.from(scrollRef.current.firstElementChild.children).forEach(child => {
                resizeObserver.observe(child)
            })
        }

        return () => resizeObserver.disconnect()
    }, [isNearBottom, selectedUserId, messages.length])

    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        const isMyLatestMessage = lastMessage?.sender_id === currentUser.id

        if (isMyLatestMessage || isNearBottom || messages.length <= 50) {
            setTimeout(() => {
                scrollToBottom()
            }, 50)

            setTimeout(() => {
                scrollToBottom()
            }, 250)
        }
    }, [messages, currentUser.id])
    useEffect(() => {
        const channel = supabase
            .channel(`messages_unread_${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${currentUser.id}`,
                },
                (payload) => {
                    const incomingMessage = payload.new as Message
                    if (incomingMessage.is_read) return
                    if (incomingMessage.sender_id === selectedUserId) return

                    setUnreadByUser((prev) => ({
                        ...prev,
                        [incomingMessage.sender_id]: (prev[incomingMessage.sender_id] ?? 0) + 1,
                    }))
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${currentUser.id}`,
                },
                (payload) => {
                    const updatedMessage = payload.new as Message
                    const previousMessage = payload.old as Message

                    if (!previousMessage?.is_read && updatedMessage?.is_read) {
                        setUnreadByUser((prev) => ({
                            ...prev,
                            [updatedMessage.sender_id]: Math.max((prev[updatedMessage.sender_id] ?? 1) - 1, 0),
                        }))
                    }
                },
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentUser.id, selectedUserId, supabase])

    const formatTimestamp = (date: Date) => {
        const now = new Date()
        const oneDay = 24 * 60 * 60 * 1000
        const sixDays = 6 * oneDay
        const diff = now.getTime() - date.getTime()

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        }

        if (diff < sixDays) {
            return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="flex h-full border rounded-lg overflow-hidden bg-card">
            <div className="w-1/4 border-r flex flex-col">
                <div className="p-4 border-b font-semibold">Messages</div>
                <div className="flex-1 overflow-y-auto p-2">
                    <ConversationList
                        conversations={initialConversations}
                        selectedId={selectedUserId || undefined}
                        onSelect={setSelectedUserId}
                        unreadByUser={unreadByUser}
                    />
                </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
                {selectedUserId ? (
                    <>
                        <div className="p-4 border-b font-semibold flex items-center gap-2 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                            {selectedConversation?.username ? (
                                <Link
                                    href={`/${selectedConversation.username}`}
                                    className="hover:underline"
                                >
                                    @{selectedConversation.username}
                                </Link>
                            ) : (
                                "Chat"
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef} onScroll={handleScroll}>
                            <div className="flex flex-col">
                                {messages.map((msg, index) => {
                                    const messageDate = new Date(msg.created_at)
                                    const prevMsg = messages[index - 1]
                                    const prevDate = prevMsg ? new Date(prevMsg.created_at) : null
                                    const shouldShowTimestamp = !prevDate || (messageDate.getTime() - prevDate.getTime() > 15 * 60 * 1000)

                                    const nextMsg = messages[index + 1]
                                    const nextDate = nextMsg ? new Date(nextMsg.created_at) : null

                                    const isNextClose = nextMsg && nextDate && (nextDate.getTime() - messageDate.getTime() <= 15 * 60 * 1000)

                                    const isPrevSameSender = prevMsg && prevMsg.sender_id === msg.sender_id
                                    const isNextSameSender = nextMsg && nextMsg.sender_id === msg.sender_id

                                    const isConnectedToPrev = isPrevSameSender && !shouldShowTimestamp
                                    const isConnectedToNext = isNextSameSender && isNextClose

                                    let position: 'single' | 'top' | 'middle' | 'bottom' = 'single'
                                    if (isConnectedToPrev && isConnectedToNext) position = 'middle'
                                    else if (isConnectedToPrev && !isConnectedToNext) position = 'bottom'
                                    else if (!isConnectedToPrev && isConnectedToNext) position = 'top'

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isConnectedToPrev ? 'mt-0.5' : 'mt-4'} first:mt-0`}
                                        >
                                            {shouldShowTimestamp && (
                                                <div className="flex justify-center mb-4 mt-2">
                                                    <span className="text-xs text-muted-foreground px-2 py-1 rounded-full">
                                                        {formatTimestamp(messageDate)}
                                                    </span>
                                                </div>
                                            )}
                                            <MessageBubble
                                                message={msg}
                                                isMe={msg.sender_id === currentUser.id}
                                                position={position}
                                                onDelete={deleteMessage}
                                            />
                                            {msg.sender_id === currentUser.id && msg.id === latestSeenOutgoingMessageId && (
                                                <div className="text-[11px] text-muted-foreground text-right mt-1 pr-1">
                                                    Seen
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {loading && messages.length === 0 && <div className="text-center text-xs text-muted-foreground">Loading...</div>}
                                {messages.length === 0 && !loading && (
                                    <div className="text-center text-muted-foreground mt-10">
                                        No messages yet. Start the conversation!
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        <MessageInput onSend={sendMessage} />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a conversation to start chatting
                    </div>
                )}
            </div>
        </div>
    )
}
