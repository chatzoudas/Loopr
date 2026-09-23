import { getNotifications } from "@/lib/actions/notifications";
import { NotificationList } from "@/components/notifications/NotificationList";
import { Notification } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Please log in to view your notifications.
            </div>
        )
    }

    const notifications = await getNotifications();

    return (
        <div className="space-y-0 relative">
            <div className="sticky top-14 md:top-0 z-10 bg-background/95 backdrop-blur pt-4 pb-4 border-b">
                <h1 className="text-2xl font-bold px-4">Notifications</h1>
            </div>

            <div className="flex-1 w-full min-h-[50vh]">
                <NotificationList notifications={notifications as Notification[]} userId={user.id} />
            </div>
        </div>
    );
}
