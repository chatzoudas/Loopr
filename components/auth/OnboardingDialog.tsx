"use client";

import { useState, useEffect, useActionState, useRef } from "react";
import { completeOnboarding } from "@/lib/actions/profile";
import { checkUsernameAvailable } from "@/lib/actions/checkUsernameAvailable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const LANGUAGE_OPTIONS = [
    "C",
    "C#",
    "C++",
    "Delphi",
    "Java",
    "JavaScript",
    "Perl",
    "PHP",
    "Python",
    "Rust",
    "SQL",
    "Swift",
];

const LANGUAGE_ICONS: Record<string, string> = {
    "C": "/langicons/C.webp",
    "C#": "/langicons/C_.webp",
    "C++": "/langicons/C__.webp",
    "Delphi": "/langicons/Delphi_Object_Pascal.webp",
    "Java": "/langicons/Java.webp",
    "JavaScript": "/langicons/JavaScript.webp",
    "Perl": "/langicons/Perl.webp",
    "PHP": "/langicons/PHP.webp",
    "Python": "/langicons/Python.webp",
    "Rust": "/langicons/Rust.webp",
    "SQL": "/langicons/SQL.webp",
    "Swift": "/langicons/Swift.webp",
};

export function OnboardingDialog({ isOpen }: { isOpen: boolean }) {
    const [state, action, isPending] = useActionState(completeOnboarding, null);
    const [open, setOpen] = useState(isOpen);
    const [username, setUsername] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<null | "checking" | "available" | "taken">(null);
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
    const [customLanguage, setCustomLanguage] = useState("");

    useEffect(() => {
        setOpen(isOpen);
    }, [isOpen]);

    useEffect(() => {
        if (state?.success) {
            setOpen(false);
        }
    }, [state?.success]);

    function toggleLanguage(language: string) {
        setSelectedLanguages((prev) => {
            if (prev.includes(language)) {
                return prev.filter((item) => item !== language);
            }
            return [...prev, language];
        });
    }

    function addCustomLanguage() {
        const next = customLanguage.trim();
        if (!next) return;
        if (selectedLanguages.includes(next)) {
            setCustomLanguage("");
            return;
        }
        setSelectedLanguages((prev) => [...prev, next]);
        setCustomLanguage("");
    }

    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (!username || username.length < 3) {
            setUsernameStatus(null);
            setUsernameError(null);
            return;
        }
        setUsernameStatus("checking");
        setUsernameError(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            let cancelled = false;
            checkUsernameAvailable(username)
                .then((available) => {
                    if (cancelled) return;
                    setUsernameStatus(available ? "available" : "taken");
                    setUsernameError(available ? null : "Username already taken");
                })
                .catch(() => {
                    if (cancelled) return;
                    setUsernameStatus(null);
                    setUsernameError("Error checking username");
                });
            return () => {
                cancelled = true;
            };
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [username]);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && isOpen) return;
            setOpen(val);
        }}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Welcome to Loopr</DialogTitle>
                    <DialogDescription>
                        Please set up your profile to continue. You need a unique username and a display name.
                    </DialogDescription>
                </DialogHeader>
                <form action={action} className="grid gap-4 py-4">
                    <input type="hidden" name="tech_stack" value={selectedLanguages.join(",")} />
                    <div className="grid gap-2">
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                            id="display_name"
                            name="display_name"
                            placeholder="John Doe"
                            required
                            minLength={2}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            name="username"
                            placeholder="johndoe"
                            required
                            minLength={3}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="off"
                        />
                        <span className="text-xs text-muted-foreground">You cannot change your username later.</span>
                        <span className={
                            username.length < 3
                                ? "text-xs text-muted-foreground"
                                : usernameStatus === "available"
                                    ? "text-green-600 text-xs"
                                    : usernameStatus === "taken"
                                        ? "text-red-600 text-xs"
                                        : "text-xs"
                        }>
                            {username.length < 3 && "Enter at least 3 characters."}
                            {username.length >= 3 && usernameStatus === "checking" && "Checking username..."}
                            {username.length >= 3 && usernameStatus === "available" && "Username available"}
                            {username.length >= 3 && usernameStatus === "taken" && "Username already taken"}
                            {username.length >= 3 && usernameStatus === null && usernameError}
                        </span>
                    </div>

                    <div className="grid gap-2">
                        <Label>Programming Languages (optional)</Label>
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGE_OPTIONS.map((language) => {
                                const selected = selectedLanguages.includes(language);
                                return (
                                    <Button
                                        key={language}
                                        type="button"
                                        variant={selected ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 rounded-full px-3 gap-1.5"
                                        onClick={() => toggleLanguage(language)}
                                    >
                                        {LANGUAGE_ICONS[language] && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={LANGUAGE_ICONS[language]} alt="" className="w-4 h-4 object-contain" />
                                        )}
                                        {language}
                                    </Button>
                                );
                            })}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={customLanguage}
                                onChange={(e) => setCustomLanguage(e.target.value)}
                                placeholder="Add custom language"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomLanguage();
                                    }
                                }}
                            />
                            <Button type="button" variant="outline" onClick={addCustomLanguage}>
                                Add
                            </Button>
                        </div>
                    </div>

                    {state?.error && (
                        <p className="text-sm text-red-500">{state.error}</p>
                    )}
                    <DialogFooter>
                        <Button type="submit" disabled={isPending || usernameStatus === "taken" || usernameStatus === "checking"}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Profile
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
