import { createClient } from '@/lib/supabase/server'
import { LoopCard } from '@/components/feed/LoopCard'
import { getBookmarkedLoops, getLoopById } from '@/lib/actions/loops'
import { LoopWithDetails } from '@/lib/types'
import { OpenedLoopModal } from '@/components/feed/OpenedLoopModal'

interface PageProps {
    searchParams: Promise<{ loop?: string }>
}

export default async function BookmarksPage({ searchParams }: PageProps) {
    const { loop: loopId } = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Please log in to view your bookmarks.
            </div>
        )
    }

    const loopsPromise = getBookmarkedLoops()
    const selectedLoopPromise = loopId ? getLoopById(loopId) : Promise.resolve(null)

    const [loops, selectedLoop] = await Promise.all([
        loopsPromise,
        selectedLoopPromise
    ]) as [LoopWithDetails[] | null, LoopWithDetails | null]

    return (
        <div className="space-y-6">
            <div className="sticky top-14 md:top-0 z-10 bg-background/95 backdrop-blur pt-4 pb-4 border-b">
                <h1 className="text-2xl font-bold px-4">Bookmarks</h1>
            </div>

            {selectedLoop && (
                <OpenedLoopModal
                    loop={selectedLoop}
                    currentUserId={user.id}
                />
            )}

            <div className="space-y-4 pt-2">
                {loops?.map((loop) => (
                    <LoopCard
                        key={loop.id}
                        loop={loop}
                        currentUserId={user.id}
                    />
                ))}
                {(!loops || loops.length === 0) && (
                    <div className="text-center py-10 text-muted-foreground">
                        No bookmarked loops yet. Save some posts for later!
                    </div>
                )}
            </div>
        </div>
    )
}