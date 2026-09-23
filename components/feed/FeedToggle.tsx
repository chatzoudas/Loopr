"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from "react"

export function FeedToggle() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentTab = searchParams.get("feed") || "for-you"
    const [activeTab, setActiveTab] = useState(currentTab)

    useEffect(() => {
        setActiveTab(currentTab)
    }, [currentTab])

    const handleTabChange = (value: string) => {
        setActiveTab(value)
        const params = new URLSearchParams(searchParams)
        params.set("feed", value)
        router.push(`/?${params.toString()}`)
    }

    return (
        <Tabs value={activeTab} className="w-full mb-0" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="for-you" className="cursor-pointer dark:data-[state=active]:bg-muted-secondary">For You</TabsTrigger>
                <TabsTrigger value="following" className="cursor-pointer dark:data-[state=active]:bg-muted-secondary">Following</TabsTrigger>
            </TabsList>
        </Tabs>
    )
}
