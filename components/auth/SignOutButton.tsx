"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signout } from "@/app/(auth)/signin/actions";
import { createClient } from "@/lib/supabase/client";
import { clearDeviceKeys, getDeviceKeys } from "@/lib/crypto";
import { useTransition, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SignOutButton() {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    const handleSignOut = () => {
        startTransition(async () => {
            try {
                try {
                    await clearDeviceKeys();
                } catch (e) {
                    console.error("Error clearing device keys", e);
                }
            } catch (e) {
                console.error("Error clearing device keys", e);
            }
            await signout();
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12 text-base hover:text-red-500"
                    disabled={isPending}
                >
                    <span className="flex h-9 w-9 items-center justify-center">
                        <LogOut className="h-7 w-7" />
                    </span>
                    <span className="leading-none">Sign Out</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You will need to re-enter your recovery password to access and send messages from this device again.

                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleSignOut();
                        }}
                        disabled={isPending}
                        className="bg-red-500 text-white hover:bg-red-600 focus:ring-red-500"
                    >
                        {isPending ? "Signing out..." : "Sign Out"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}