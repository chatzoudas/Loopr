"use client"

import { useEffect, useState } from "react"
import { getSignedChatImageUrl } from "@/lib/actions/storage"
import { decryptBytes, parseE2eeImageToken } from "@/lib/crypto"

interface EncryptedImageDisplayProps {
    token: string
    className?: string
}

export function EncryptedImageDisplay({ token, className }: EncryptedImageDisplayProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let objectUrl: string | null = null

        async function load() {
            const parsed = parseE2eeImageToken(token)
            if (!parsed) {
                setError("Invalid image")
                return
            }

            const { url, error: signedErr } = await getSignedChatImageUrl(parsed.path)
            if (signedErr || !url) {
                setError("Could not load image")
                return
            }

            const res = await fetch(url)
            if (!res.ok) {
                setError("Could not load image")
                return
            }

            const ciphertext = new Uint8Array(await res.arrayBuffer())
            const decrypted = decryptBytes(ciphertext, parsed.key, parsed.nonce)
            if (!decrypted) {
                setError("Decryption failed")
                return
            }

            objectUrl = URL.createObjectURL(new Blob([decrypted as BlobPart], { type: "image/webp" }))
            setBlobUrl(objectUrl)
        }

        void load()

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [token])

    if (error) {
        return (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {error}
            </div>
        )
    }

    if (!blobUrl) {
        return <div className="w-48 h-32 rounded-md bg-muted animate-pulse" />
    }

    return (
        <img
            src={blobUrl}
            alt="Encrypted image"
            className={className ?? "max-w-full rounded-md object-contain"}
            style={{ maxHeight: 400 }}
        />
    )
}
