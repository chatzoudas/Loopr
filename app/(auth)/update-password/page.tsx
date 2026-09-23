import { Suspense } from 'react'
import { updateUserPassword } from './actions'
import { SubmitButton } from "@/components/auth/SubmitButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthToast } from "@/components/auth/AuthToast"
import { BackgroundShader } from "@/components/auth/BackgroundShader"
import Link from 'next/link'
import Image from 'next/image'

export default function UpdatePasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
            <BackgroundShader />
            <Suspense>
                <AuthToast />
            </Suspense>
            <Card className="w-full max-w-md relative z-10 border-border/50 bg-background/95 backdrop-blur shadow-xl">
                <CardHeader className="space-y-1 text-center flex flex-col items-center pb-2">
                    <Link href="/" className="w-20 h-20 mb-4 relative flex items-center justify-center transition-opacity hover:opacity-80">
                        <Image
                            src="/logo.png"
                            alt="Loopr home"
                            width={64}
                            height={64}
                            loading="eager"
                            className="w-16 h-16 object-contain"
                        />
                    </Link>
                    <CardTitle className="text-2xl font-bold tracking-tight">Update Password</CardTitle>
                    <CardDescription>
                        Enter your new password below
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form action={updateUserPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input id="password" name="password" type="password" required minLength={6} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
                        </div>
                        <div className="flex gap-2 flex-col pt-2">
                            <SubmitButton type="submit" className="w-full" pendingText="Updating...">Update Password</SubmitButton>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}