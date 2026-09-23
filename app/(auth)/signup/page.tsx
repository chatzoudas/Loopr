import { signup } from './actions'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BackgroundShader } from "@/components/auth/BackgroundShader"
import Link from 'next/link'
import Image from 'next/image'
import { Shield, MessageSquare, Code2, Zap } from 'lucide-react'

type SignupPageProps = {
    searchParams?: Promise<{ message?: string; error?: string; email?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = (await searchParams) ?? {};
    const message = params.message;
    const error = params.error;
    const defaultEmail = params.email ?? "";

    return (
        <div className="flex min-h-screen relative overflow-hidden">
            <BackgroundShader />

            <div className="relative z-10 container flex h-screen w-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
                <div className="relative hidden h-full flex-col bg-[#0A0A0A] p-12 text-white lg:flex overflow-hidden border-none">
                    <div className="absolute inset-0 bg-[#0A0A0A] bg-[radial-gradient(ellipse_60%_60%_at_0%_0%,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-5" />

                    <Link href="/" className="relative z-20 flex items-center text-3xl font-bold tracking-tight transition-opacity hover:opacity-80">
                        <div className="w-16 h-16 mr-4 relative flex items-center justify-center">
                            <Image
                                src="/logo.png"
                                alt="Loopr home"
                                width={56}
                                height={56}
                                loading="eager"
                                className="w-14 h-14 object-contain"
                            />
                        </div>
                        Loopr
                    </Link>
                    <div className="relative z-20 mt-24">
                        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
                            Join the Developer Loop
                        </h1>
                        <p className="text-xl text-zinc-300 mb-10 max-w-xl leading-relaxed">
                            Create your account to start sharing your projects, discussing the latest tech,
                            and chatting securely with developers around the world.
                        </p>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 max-w-2xl">
                            <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-5 hover:bg-white/10 transition-colors backdrop-blur-sm border-none">
                                <Code2 className="h-7 w-7 text-primary" />
                                <h3 className="font-semibold text-zinc-100 text-lg">Dev-Centric Feed</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">Share snippets, GitHub repos, and daily progress in your developer loop.</p>
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-5 hover:bg-white/10 transition-colors backdrop-blur-sm border-none">
                                <Shield className="h-7 w-7 text-primary" />
                                <h3 className="font-semibold text-zinc-100 text-lg">E2E Encryption</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">Your direct messages are secured with client-side encryption. Total privacy.</p>
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-5 hover:bg-white/10 transition-colors backdrop-blur-sm border-none">
                                <MessageSquare className="h-7 w-7 text-primary" />
                                <h3 className="font-semibold text-zinc-100 text-lg">Rich Interactions</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">Threaded comments, real-time push notifications, and rich-text markdown support.</p>
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-5 hover:bg-white/10 transition-colors backdrop-blur-sm border-none">
                                <Zap className="h-7 w-7 text-primary" />
                                <h3 className="font-semibold text-zinc-100 text-lg">Lightning Fast</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">Built on Next.js 15 and Supabase for real-time reactivity and instant updates.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:p-12 flex items-center justify-center w-full">
                    <Card className="w-full max-w-[420px] bg-background/95 backdrop-blur shadow-none border-2 border-border/50">
                        <CardHeader className="space-y-1 text-center flex flex-col items-center pb-2">
                            <Link href="/" className="lg:hidden w-20 h-20 mb-4 relative flex items-center justify-center transition-opacity hover:opacity-80">
                                <Image
                                    src="/logo.png"
                                    alt="Loopr home"
                                    width={64}
                                    height={64}
                                    loading="eager"
                                    className="w-16 h-16 object-contain"
                                />
                            </Link>
                            <CardTitle className="text-2xl font-bold tracking-tight">
                                {message ? "Check your email" : "Create an account"}
                            </CardTitle>
                            <CardDescription>
                                {message ? "Confirm your email to finish setup" : "Enter your details to get started"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error ? (
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {error}
                                </div>
                            ) : null}

                            {message ? (
                                <div className="space-y-4">
                                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                                        {message}
                                    </div>
                                    <div className="text-center text-sm text-muted-foreground">
                                        After confirming, you can return to{" "}
                                        <Link href="/signin" className="underline underline-offset-4 hover:text-primary">
                                            Sign in
                                        </Link>
                                        .
                                    </div>
                                </div>
                            ) : (
                                <form className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" name="email" type="email" defaultValue={defaultEmail} placeholder="m@example.com" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input id="password" name="password" type="password" placeholder="At least 8 characters" required minLength={8} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
                                    </div>

                                    <div className="flex gap-2 flex-col pt-2">
                                        <SubmitButton formAction={signup} className="w-full" pendingText="Signing up...">Sign up</SubmitButton>
                                    </div>
                                </form>
                            )}

                            {!message && (
                                <div className="text-center text-sm text-muted-foreground mt-4 border-t pt-4">
                                    Already have an account?{" "}
                                    <Link href="/signin" className="font-semibold text-primary hover:underline underline-offset-4">
                                        Sign in here
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
