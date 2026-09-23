import { LeftSidebar } from "@/components/shared/LeftSidebar"
import { Navbar } from "@/components/shared/Navbar"
import { RightSidebar } from "@/components/shared/RightSidebar"
import { Toaster } from "@/components/ui/sonner"
import { createClient } from "@/lib/supabase/server"
import { OnboardingDialog } from "@/components/auth/OnboardingDialog"
import { DeviceRegistration } from "@/components/auth/DeviceRegistration"

export default async function MainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let needsOnboarding = false
    let needsKeySetup = false
    let profileHref: string | undefined = undefined
    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .single()

        if (!profile || !profile.username || !profile.display_name) {
            needsOnboarding = true
        } else {
            const { data: backup } = await supabase
                .from("key_backups")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle()

            if (!backup) {
                needsKeySetup = true
            }
        }

        if (profile?.username) {
            profileHref = `/${profile.username}`
        }
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">

            <div className="container mx-auto flex gap-6 p-4 md:p-6 max-w-7xl">
                <LeftSidebar
                    className="hidden md:flex sticky top-6 h-[calc(100vh-3rem)]"
                    profileHref={profileHref}
                />
                <main className="flex-1 min-w-0">
                    {children}
                    <Toaster />
                    <OnboardingDialog isOpen={needsOnboarding} />
                    {!needsOnboarding && needsKeySetup && (
                        <DeviceRegistration forceSetup={true} />
                    )}
                    {(!needsOnboarding && !needsKeySetup) && (
                        <DeviceRegistration forceSetup={false} />
                    )}
                </main>
                <RightSidebar className="hidden md:flex sticky top-6 h-[calc(100vh-3rem)]" />
            </div>
        </div>
    )
}
