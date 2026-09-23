import { createClient } from '@/lib/supabase/server'
import { FeedToggle } from '@/components/feed/FeedToggle'
import { CreateLoop } from '@/components/feed/CreateLoop'
import { LoopCard } from '@/components/feed/LoopCard'
import { getLoops, getLoopById } from '@/lib/actions/loops'
import { LoopWithDetails } from '@/lib/types'
import { OpenedLoopModal } from '@/components/feed/OpenedLoopModal'

interface PageProps {
    searchParams: Promise<{ feed?: string; loop?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
    const { feed, loop: loopId } = await searchParams
    const currentFeed = (feed === "following" ? "following" : "for-you") as "for-you" | "following"

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const loopsPromise = getLoops(currentFeed)
    const selectedLoopPromise = loopId ? getLoopById(loopId) : Promise.resolve(null)

    const [loops, selectedLoop] = await Promise.all([
        loopsPromise,
        selectedLoopPromise
    ]) as [LoopWithDetails[] | null, LoopWithDetails | null]

    return (
        <div className="space-y-6">
            <div className="sticky top-14 md:top-0 z-10 bg-background/95 backdrop-blur pt-4 pb-2">
                <FeedToggle />
            </div>

            {user && <CreateLoop />}

            {selectedLoop && (
                <OpenedLoopModal
                    loop={selectedLoop}
                    currentUserId={user?.id}
                />
            )}

            <div className="space-y-4">
                {loops?.map((loop) => (
                    <LoopCard
                        key={loop.id}
                        loop={loop}
                        currentUserId={user?.id}
                    />
                ))}
                {(!loops || loops.length === 0) && (
                    <div className="text-center py-10 text-muted-foreground">
                        {currentFeed === "following"
                            ? "Try to follow someone!"
                            : "No loops yet. Be the first to post!"}
                    </div>
                )}
            </div>
        </div>
    )
}
