"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Image as ImageIcon, X } from "lucide-react"
import { toast } from "sonner"
import { uploadEncryptedChatImage } from "@/lib/actions/storage"
import { encryptBytes, buildE2eeImageToken } from "@/lib/crypto"

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
    onSend: (content: string, imageUrl?: string | null) => void
    disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
    const [content, setContent] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [selectedImagePreviewUrls, setSelectedImagePreviewUrls] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [isDraggingOver, setIsDraggingOver] = useState(false)

    useEffect(() => {
        return () => {
            selectedImagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
        }
    }, [selectedImagePreviewUrls])

    const handleSend = async () => {
        if (!content.trim() && selectedImages.length === 0) return

        setIsUploadingImage(true)
        const textContent = content.trimEnd()

        if (selectedImages.length > 0) {
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i]!

                const rawBytes = new Uint8Array(await img.arrayBuffer())
                const { ciphertext, keyBase64, nonceBase64 } = encryptBytes(rawBytes)

                const uploadForm = new FormData()
                uploadForm.append("file", new Blob([ciphertext as BlobPart], { type: "application/octet-stream" }), "img.bin")

                const uploadResult = await uploadEncryptedChatImage(uploadForm)
                if (uploadResult?.error || !uploadResult?.path) {
                    toast.error(uploadResult?.error ?? "Failed to upload image")
                    setIsUploadingImage(false)
                    return
                }

                const token = buildE2eeImageToken(uploadResult.path, keyBase64, nonceBase64)

                if (i === 0 && textContent) {
                    onSend(textContent, token)
                } else {
                    onSend("", token)
                }
            }
        } else {
            onSend(textContent)
        }

        setContent("")
        setSelectedImages([])
        selectedImagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
        setSelectedImagePreviewUrls([])
        setIsUploadingImage(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void handleSend()
        }
    }

    const handlePickImage = () => {
        fileInputRef.current?.click()
    }

    const handleImageSelected = async (fileList: FileList | File[]) => {
        const filesToProcess = Array.from(fileList).filter(f => f.type.startsWith("image/"))
        if (filesToProcess.length === 0) {
            toast.error("Please choose an image file")
            return
        }

        // cant mix text with images so just clear it
        setContent("")

        const processToWebp = async (input: File) => {
            const objectUrl = URL.createObjectURL(input)
            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const el = new Image()
                    el.onload = () => resolve(el)
                    el.onerror = () => reject(new Error("Failed to load image"))
                    el.src = objectUrl
                })

                const maxSide = 2000
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
                const targetW = Math.max(1, Math.round(img.width * scale))
                const targetH = Math.max(1, Math.round(img.height * scale))

                const canvas = document.createElement("canvas")
                canvas.width = targetW
                canvas.height = targetH
                const ctx = canvas.getContext("2d")
                if (!ctx) throw new Error("Canvas not supported")
                ctx.drawImage(img, 0, 0, targetW, targetH)

                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        (b) => (b ? resolve(b) : reject(new Error("WebP conversion failed"))),
                        "image/webp",
                        0.82
                    )
                })

                const out = new File([blob], `chat-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`, { type: "image/webp" })
                return out
            } finally {
                URL.revokeObjectURL(objectUrl)
            }
        }

        const maxToUpload = Math.min(filesToProcess.length, 10 - selectedImages.length)
        if (maxToUpload <= 0) {
            toast.error("You can only upload up to 10 images")
            return
        }

        try {
            const newImages: File[] = []
            const newPreviewUrls: string[] = []
            for (let i = 0; i < maxToUpload; i++) {
                const processed = await processToWebp(filesToProcess[i]!)
                const previewUrl = URL.createObjectURL(processed)
                newImages.push(processed)
                newPreviewUrls.push(previewUrl)
            }
            setSelectedImages(prev => [...prev, ...newImages])
            setSelectedImagePreviewUrls(prev => [...prev, ...newPreviewUrls])
        } catch (e) {
            console.error(e)
            toast.error("Couldn't process one or more images")
        }

        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)

        const files = e.dataTransfer.files
        if (!files || files.length === 0) return

        if (!disabled && !isUploadingImage) {
            await handleImageSelected(files)
        }
    }

    const handleRemoveImage = (indexToRemove: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== indexToRemove))
        setSelectedImagePreviewUrls(prev => {
            const newList = [...prev]
            URL.revokeObjectURL(newList[indexToRemove]!)
            newList.splice(indexToRemove, 1)
            return newList
        })
    }

    return (
        <div
            className={`p-4 border-t bg-background relative ${isDraggingOver ? 'ring-2 ring-inset ring-primary/40' : ''}`}
            onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingOver(true)
            }}
            onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingOver(true)
            }}
            onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (e.currentTarget === e.target) setIsDraggingOver(false)
            }}
            onDrop={(e) => {
                void handleDrop(e)
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={disabled || isUploadingImage}
                onChange={(e) => {
                    if (e.target.files?.length) {
                        void handleImageSelected(e.target.files)
                    }
                }}
            />

            {isDraggingOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none border-2 border-dashed border-primary">
                    <div className="flex flex-col items-center gap-2 text-primary">
                        <ImageIcon className="h-8 w-8" />
                        <span className="font-medium">Drop images to attach</span>
                    </div>
                </div>
            )}

            {selectedImagePreviewUrls.length > 0 && (
                <div className="flex gap-2 p-2 mb-2 overflow-x-auto">
                    {selectedImagePreviewUrls.map((url, idx) => (
                        <div key={url} className="relative flex-shrink-0 w-24 h-24 rounded-md border bg-muted/20">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-6 w-6 bg-black/50 text-white hover:bg-black/70 hover:text-white rounded-full z-10"
                                onClick={() => handleRemoveImage(idx)}
                                disabled={isUploadingImage}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                            <img
                                src={url}
                                alt={`Selected ${idx + 1}`}
                                className="w-full h-full object-cover rounded-md"
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-12 flex-shrink-0 border"
                    onClick={handlePickImage}
                    disabled={disabled || isUploadingImage}
                    type="button"
                >
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                </Button>

                {selectedImages.length === 0 && (
                    <div className="flex-1 relative">
                        <div
                            ref={overlayRef}
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 overflow-auto rounded-md px-3 py-[13px] text-base md:text-sm whitespace-pre-wrap text-primary leading-relaxed"
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
                            className="min-h-[48px] max-h-[120px] resize-none py-[13px] w-full leading-relaxed bg-transparent text-transparent caret-foreground selection:bg-primary/20 z-10"
                            disabled={disabled || isUploadingImage}
                        />
                    </div>
                )}

                {selectedImages.length > 0 && (
                    <div className="flex-1 flex items-center justify-start px-3 text-muted-foreground">
                        Press send to share image(s)
                    </div>
                )}

                <Button
                    onClick={() => void handleSend()}
                    disabled={disabled || isUploadingImage || (!content.trim() && selectedImages.length === 0)}
                    className="size-12 flex-shrink-0 z-20"
                >
                    <Send className="w-5 h-5" />
                </Button>
            </div>
        </div>
    )
}