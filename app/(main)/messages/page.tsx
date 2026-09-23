import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatInterface } from "@/components/messages/ChatInterface"
import { Profile } from "@/lib/types"

export default async function MessagesPage(
    props: {
        searchParams: Promise<{ [key: string]: string | string[] | undefined }>
    }
) {
    const searchParams = await props.searchParams;
    const initialTargetId = searchParams.userId as string | undefined;

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/signin")
    }

    const { data: messages, error } = await supabase
        .from("messages")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100)

    if (error) {
        console.error("Error fetching conversations:", error)
    }

    const partnerIds = new Set<string>()
    messages?.forEach(msg => {
        if (msg.sender_id !== user.id) partnerIds.add(msg.sender_id)
        if (msg.receiver_id !== user.id) partnerIds.add(msg.receiver_id)
    })

    let partners: Profile[] = []
    if (partnerIds.size > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", Array.from(partnerIds))

        partners = profiles || []
    }

    const unreadByUser: Record<string, number> = {}
    const { data: unreadMessages } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .eq("is_read", false)

    unreadMessages?.forEach((message) => {
        unreadByUser[message.sender_id] = (unreadByUser[message.sender_id] ?? 0) + 1
    })

    if (initialTargetId && initialTargetId !== user.id) {
        if (!partners.some(p => p.id === initialTargetId)) {
            const { data: targetProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", initialTargetId)
                .single()

            if (targetProfile) {
                partners.unshift(targetProfile)
            }
        }
    }

    const { data: currentUserProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    if (!currentUserProfile) {
        return <div>Error loading profile</div>
    }

    return (
        <ChatInterface
            currentUser={currentUserProfile}
            initialConversations={partners}
            initialSelectedId={initialTargetId}
            initialUnreadByUser={unreadByUser}
        />
    )
}
