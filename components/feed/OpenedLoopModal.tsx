"use client"

import { LoopDetailDialog } from "@/components/feed/LoopDetailDialog"
import { LoopWithDetails } from "@/lib/types"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface OpenedLoopModalProps {
    loop: LoopWithDetails
    currentUserId?: string
}

export function OpenedLoopModal({ loop, currentUserId }: OpenedLoopModalProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            const newSearchParams = new URLSearchParams(searchParams.toString())
            newSearchParams.delete('loop')

            const newUrl = newSearchParams.toString()
                ? `${pathname}?${newSearchParams.toString()}`
                : pathname

            router.push(newUrl)
        }
    }

    return (
        <LoopDetailDialog
            loop={loop}
            isOpen={true}
            onOpenChange={handleOpenChange}
            currentUserId={currentUserId}
        />
    )
}
