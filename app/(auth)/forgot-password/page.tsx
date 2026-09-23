import { Suspense } from 'react'
import { sendPasswordResetEmail } from './actions'
import { SubmitButton } from "@/components/auth/SubmitButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthToast } from "@/components/auth/AuthToast"
import { BackgroundShader } from "@/components/auth/BackgroundShader"
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
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
                    <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your email address to receive a password reset link
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form action={sendPasswordResetEmail} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="flex gap-2 flex-col pt-2">
                            <SubmitButton type="submit" className="w-full" pendingText="Sending...">Send Reset Link</SubmitButton>
                        </div>
                    </form>
                    <div className="text-center text-sm text-muted-foreground">
                        Remember your password?{" "}
                        <Link href="/signin" className="underline underline-offset-4 hover:text-primary">
                            Log in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}