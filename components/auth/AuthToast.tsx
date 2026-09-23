"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"

export function AuthToast() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error")
    const message = searchParams.get("message")
    const lastShownRef = useRef<string>("")

    useEffect(() => {
        const key = `${error}|${message}`

        if (key === lastShownRef.current) return

        if (error) {
            toast.error(error)
            lastShownRef.current = key
        }
        if (message) {
            toast.success(message)
            lastShownRef.current = key
        }
    }, [error, message])

    return null
}
