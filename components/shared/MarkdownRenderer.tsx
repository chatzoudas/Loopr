"use client"

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
    content: string
    variant?: 'feed' | 'chat'
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }

        if (typeof document === 'undefined') return false
        const el = document.createElement('textarea')
        el.value = text
        el.setAttribute('readonly', 'true')
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        el.style.top = '0'
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        return ok
    } catch {
        return false
    }
}

function CodeBlock({ code, language, variant }: { code: string; language?: string; variant?: 'feed' | 'chat' }) {
    const [copied, setCopied] = useState(false)

    const isChat = variant === 'chat'

    return (
        <div className={cn("group relative", isChat ? "my-2" : "")}>
            <button
                type="button"
                className="absolute right-1 top-1 rounded-sm border bg-background/70 px-2 py-1 text-xs text-muted-foreground backdrop-blur opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 hover:text-foreground z-10"
                aria-label="Copy code"
                onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const ok = await copyTextToClipboard(code)
                    if (!ok) return
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1200)
                }}
            >
                {copied ? 'Copied' : 'Copy'}
            </button>

            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    borderRadius: isChat ? '0.5rem' : '0.125rem',
                    padding: isChat ? '0.75rem 3.5rem 0.75rem 0.75rem' : '0.25rem 3.5rem 0.25rem 0.5rem',
                    fontSize: isChat ? '0.8125rem' : '0.875rem',
                    lineHeight: '1.625',
                }}
                className={cn("overflow-x-auto  bg-[#1e1e1e] font-mono", isChat ? "shadow-sm" : "")}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    )
}

type ContentPart =
    | { type: 'text'; value: string }
    | { type: 'code'; value: string; language?: string }

const LANG_ALIASES: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'rs': 'rust',
    'sh': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'md': 'markdown',
    'cs': 'csharp',
    'c++': 'cpp'
}

function parseFenceLanguageTag(raw: string): string | undefined {
    const s = raw.trim()
    if (!s) return undefined
    if (/\s/.test(s)) return undefined
    const lower = s.toLowerCase()
    return LANG_ALIASES[lower] || lower
}

function splitByTripleBackticks(input: string): ContentPart[] {
    const normalizedInput = (input ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const parts: ContentPart[] = []
    let index = 0

    while (index < normalizedInput.length) {
        const open = normalizedInput.indexOf('```', index)
        if (open === -1) {
            const tail = normalizedInput.slice(index)
            if (tail) parts.push({ type: 'text', value: tail })
            break
        }

        const before = normalizedInput.slice(index, open)
        if (before) parts.push({ type: 'text', value: before })

        const afterOpen = open + 3
        const close = normalizedInput.indexOf('```', afterOpen)
        if (close === -1) {
            parts.push({ type: 'text', value: normalizedInput.slice(open) })
            break
        }

        const nextNewline = normalizedInput.indexOf('\n', afterOpen)
        const nextSpace = normalizedInput.indexOf(' ', afterOpen)

        let firstSeparator = -1
        if (nextNewline !== -1 && nextSpace !== -1) {
            firstSeparator = Math.min(nextNewline, nextSpace)
        } else if (nextNewline !== -1) {
            firstSeparator = nextNewline
        } else if (nextSpace !== -1) {
            firstSeparator = nextSpace
        }

        const hasPossibleTag = firstSeparator !== -1 && firstSeparator < close

        if (hasPossibleTag) {
            const possibleTag = normalizedInput.slice(afterOpen, firstSeparator)
            const language = parseFenceLanguageTag(possibleTag)

            if (language) {
                const contentStart = firstSeparator + 1
                let code = normalizedInput.slice(contentStart, close)

                if (code.endsWith('\n')) {
                    code = code.slice(0, -1)
                }

                parts.push({ type: 'code', value: code, language })
            } else {
                let code = normalizedInput.slice(afterOpen, close)
                if (code.startsWith('\n')) code = code.slice(1)
                if (code.endsWith('\n')) code = code.slice(0, -1)
                parts.push({ type: 'code', value: code })
            }

            index = close + 3
            if (normalizedInput[index] === '\n') index += 1
        } else {
            let code = normalizedInput.slice(afterOpen, close)
            if (code.startsWith('\n')) code = code.slice(1)
            if (code.endsWith('\n')) code = code.slice(0, -1)
            parts.push({ type: 'code', value: code })
            index = close + 3
        }
    }

    return parts
}

function Boldify({ text }: { text: string }) {
    const parts = text.split(/(\*\*.*?\*\*)/g)

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const boldText = part.slice(2, -2)
                    return <strong key={i}><Mentionify text={boldText} /></strong>
                }
                return <Mentionify key={i} text={part} />
            })}
        </>
    )
}

function Mentionify({ text }: { text: string }) {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g)

    return (
        <>
            {parts.map((part, i) => {
                if (part.match(/^@[a-zA-Z0-9_]+$/)) {
                    const username = part.slice(1)
                    return (
                        <Link
                            key={i}
                            href={`/${username}`}
                            className="text-primary hover:underline font-medium pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </Link>
                    )
                }
                return <span key={i}>{part}</span>
            })}
        </>
    )
}

function Linkify({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/[^\s]+)/g)

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

    return (
        <>
            {parts.map((part, i) => {
                if (part.match(/^https?:\/\/[^\s]+$/)) {
                    if (!isValidHttpUrl(part)) {
                        return <Mentionify key={i} text={part} />
                    }

                    const match = part.match(/^(.*)([.,;!?)])$/)
                    // strip trailing dot/comma etc so links dont break
                    if (match) {
                        const [original, url = '', punctuation = ''] = match
                        return (
                            <span key={i}>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground underline decoration-foreground/30 hover:decoration-foreground/60 transition-colors pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {url}
                                </a>
                                <Boldify text={punctuation} />
                            </span>
                        )
                    }

                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground underline decoration-foreground/30 hover:decoration-foreground/60 transition-colors pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    )
                }
                return <Boldify key={i} text={part} />
            })}
        </>
    )
}

export function MarkdownRenderer({ content, variant = 'feed' }: MarkdownRendererProps) {
    const parts = splitByTripleBackticks(content)

    return (
        <div className="space-y-2">
            {parts.map((part, i) => {
                if (part.type === 'code') {
                    return (
                        <CodeBlock
                            key={i}
                            code={part.value}
                            language={part.language}
                            variant={variant}
                        />
                    )
                }

                return (
                    <span key={i} className="whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>
                        <Linkify text={part.value} />
                    </span>
                )
            })}
        </div>
    )
}
