"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

type TypingPart =
    | { type: 'text'; value: string }
    | { type: 'fence'; value: string }
    | { type: 'code'; value: string }

function splitForFenceTint(input: string): TypingPart[] {
    const parts: TypingPart[] = []
    let index = 0

    while (index < input.length) {
        const open = input.indexOf('```', index)
        if (open === -1) {
            const tail = input.slice(index)
            if (tail) parts.push({ type: 'text', value: tail })
            break
        }

        const before = input.slice(index, open)
        if (before) parts.push({ type: 'text', value: before })

        const afterOpen = open + 3
        const close = input.indexOf('```', afterOpen)
        if (close === -1) {
            parts.push({ type: 'text', value: input.slice(open) })
            break
        }

        const nextNewline = input.indexOf('\n', afterOpen)
        const isBlockFence = nextNewline !== -1 && nextNewline < close

        if (isBlockFence) {
            parts.push({ type: 'fence', value: input.slice(open, nextNewline + 1) })
            const code = input.slice(nextNewline + 1, close)
            if (code) parts.push({ type: 'code', value: code })
            parts.push({ type: 'fence', value: input.slice(close, close + 3) })
            index = close + 3
        } else {
            parts.push({ type: 'fence', value: input.slice(open, open + 3) })
            const code = input.slice(afterOpen, close)
            if (code) parts.push({ type: 'code', value: code })
            parts.push({ type: 'fence', value: input.slice(close, close + 3) })
            index = close + 3
        }
    }

    return parts
}

interface MessageInputProps {
    onSend: (content: string) => void
    disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
    const [content, setContent] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    const handleSend = () => {
        if (!content.trim()) return
        onSend(content)
        setContent("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="p-4 border-t bg-background">
            <div className="flex gap-2 relative">
                <div
                    ref={overlayRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-auto rounded-md px-3 py-[13px] text-base md:text-sm whitespace-pre-wrap text-primary leading-relaxed w-[calc(100%-3.5rem)]" 
                    style={{ overflowWrap: 'anywhere' }}
                >
                    {splitForFenceTint(content).map((part, idx) => {
                        if (part.type === 'fence' || part.type === 'code') {
                            return (
                                <span key={idx} className="bg-muted/50 rounded-[2px] text-muted-foreground">
                                    {part.value}
                                </span>
                            )
                        }
                        return <span key={idx}>{part.value}</span>
                    })}


                </div>

                <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onScroll={(e) => {
                        if (overlayRef.current) {
                            overlayRef.current.scrollTop = e.currentTarget.scrollTop
                            overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
                        }
                    }}
                    placeholder="Message..."
                    className="min-h-[48px] max-h-[120px] resize-none py-[13px] leading-relaxed bg-transparent text-transparent caret-foreground selection:bg-primary/20 z-10"
                    disabled={disabled}
                />
                <Button onClick={handleSend} disabled={disabled || !content.trim()} className="size-12 z-20">
                    <Send className="w-5 h-5" />
                </Button>
            </div>
        </div>
    )
}

