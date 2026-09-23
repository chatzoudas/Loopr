
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createLoop } from '@/lib/actions/loops'
import { toast } from "sonner"
import { Card } from '../ui/card'
import { uploadImage } from "@/lib/actions/storage"
import { Image as ImageIcon, X, Info } from "lucide-react"
import { splitContentAndImageUrls } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

export function CreateLoop() {
    const [content, setContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [selectedImagePreviewUrls, setSelectedImagePreviewUrls] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const overlayRef = useRef<HTMLDivElement | null>(null)

    const placeholders = [
        "What's on your mind?",
        "Share a thought…",
        "Start a new loop…",
        "What are you building today?",
        "Drop something interesting…",
        "Say it with a loop…",
    ]

    const [placeholder, setPlaceholder] = useState(placeholders[0]!)

    useEffect(() => {
        setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]!)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        return () => {
            selectedImagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
        }
    }, [selectedImagePreviewUrls])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() && selectedImages.length === 0) return

        setIsSubmitting(true)
        setIsUploadingImage(false)

        let finalContent = splitContentAndImageUrls(content).text.trimEnd()
        if (selectedImages.length > 0) {
            setIsUploadingImage(true)

            const uploadedUrls: string[] = []

            for (const img of selectedImages) {
                const uploadForm = new FormData()
                uploadForm.append("bucket", "posts")
                uploadForm.append("file", img)

                const uploadResult = await uploadImage(uploadForm)
                if (uploadResult?.error || !uploadResult?.url) {
                    toast.error(uploadResult?.error ?? "Failed to upload image")
                    setIsSubmitting(false)
                    setIsUploadingImage(false)
                    return
                }
                uploadedUrls.push(uploadResult.url)
            }

            const newUrls = uploadedUrls.join("\n")
            finalContent = finalContent ? `${finalContent}\n\n${newUrls}` : newUrls
        }

        const formData = new FormData()
        formData.append('content', finalContent)

        const result = await createLoop(formData)

        if (result?.error) {
            toast.error(result.error)
        } else {
            setContent('')
            setSelectedImages([])
            selectedImagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
            setSelectedImagePreviewUrls([])
            toast.success("Loop created successfully")
        }
        setIsSubmitting(false)
        setIsUploadingImage(false)
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

        const processToWebp = async (input: File) => {
            const objectUrl = URL.createObjectURL(input)
            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const el = new Image()
                    el.onload = () => resolve(el)
                    el.onerror = () => reject(new Error("Failed to load image"))
                    el.src = objectUrl
                })

                const maxSide = 1000
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

                const out = new File([blob], `post-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`, { type: "image/webp" })
                return out
            } finally {
                URL.revokeObjectURL(objectUrl)
            }
        }

        const maxToUpload = Math.min(filesToProcess.length, 10 - selectedImages.length)
        if (maxToUpload <= 0) {
            toast.error("You can only upload up to 10 images per loop")
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

        await handleImageSelected(files)
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
        <Card
            className={
                isDraggingOver
                    ? "relative p-2 ring-2 ring-primary/40"
                    : "relative p-2"
            }
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
            {isDraggingOver && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary/50 bg-background/80">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-10 w-10" />
                        <div className="text-sm font-medium">Drop image to attach</div>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) {
                            void handleImageSelected(e.target.files)
                        }
                    }}
                />
                <div className="relative mb-2 min-h-[100px]">
                    <div
                        ref={overlayRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 overflow-auto rounded-md px-3 py-2 text-base md:text-sm whitespace-pre-wrap text-foreground"
                        style={{ overflowWrap: 'anywhere' }}
                    >
                        {splitForFenceTint(content).map((part, idx) => {
                            if (part.type === 'fence' || part.type === 'code') {
                                return (
                                    <span key={idx} className="text-muted-foreground">
                                        {part.value}
                                    </span>
                                )
                            }
                            return <span key={idx}>{part.value}</span>
                        })}
                    </div>

                    <Textarea
                        ref={textareaRef}
                        placeholder={placeholder}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onScroll={(e) => {
                            const el = e.currentTarget
                            if (overlayRef.current) {
                                overlayRef.current.scrollTop = el.scrollTop
                                overlayRef.current.scrollLeft = el.scrollLeft
                            }
                        }}
                        className="min-h-[100px] resize-none bg-transparent text-transparent caret-foreground selection:bg-primary/20"
                    />
                </div>

                {selectedImagePreviewUrls.length > 0 && (
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {selectedImagePreviewUrls.map((url, idx) => (
                            <div key={url} className="relative rounded-md border bg-muted/20 p-2 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-3 top-3 h-8 w-8 bg-black/50 text-white hover:bg-black/70 hover:text-white rounded-full z-10"
                                    onClick={() => handleRemoveImage(idx)}
                                    disabled={isSubmitting || isUploadingImage}
                                >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Remove image</span>
                                </Button>
                                <img
                                    src={url}
                                    alt={`Selected ${idx + 1}`}
                                    className="h-32 md:h-40 w-full rounded-md object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}
                <div className='flex flex-row justify-between items-center'>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="inline h-4 w-4 text-muted-foreground/50" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Use ```code``` for code blocks, use ```ts code``` for TypeScript code etc</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handlePickImage}
                            disabled={isSubmitting || isUploadingImage}
                        >
                            <ImageIcon className="h-4 w-4" />
                            {selectedImages.length > 0 ? "Add more" : "Add image"}
                        </Button>
                        <Button type="submit" disabled={isSubmitting || isUploadingImage || (!content.trim() && selectedImages.length === 0)}>
                            {isSubmitting ? (isUploadingImage ? 'Uploading...' : 'Posting...') : 'Loop It'}
                        </Button>
                    </div>
                </div>
            </form>
        </Card>
    )
}
