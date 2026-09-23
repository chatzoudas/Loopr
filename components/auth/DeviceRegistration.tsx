"use client";

import { useEffect, useState } from "react";
import { generateDeviceKeypair, storeDeviceKeys, getDeviceKeys, encryptSecretKey } from "@/lib/crypto";
import { saveKeyBackup } from "@/lib/actions/crypto";
import { createClient } from "@/lib/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RestoreBackupDialog } from "@/components/messages/RestoreBackupDialog";

export function DeviceRegistration({ forceSetup = false }: { forceSetup?: boolean }) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [needsRestore, setNeedsRestore] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (forceSetup) return;

        const registerDevice = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) return;

                const existingKeys = await getDeviceKeys();

                if (existingKeys) {
                    const { data: updatedProfile, error } = await supabase
                        .from("profiles")
                        .update({ public_key: existingKeys.publicKey })
                        .eq("id", user.id)
                        .select("id")
                        .maybeSingle();

                    if (error) {
                        console.error("❌ Failed to update profile public_key:", error);
                    } else if (!updatedProfile) {
                        console.warn("⚠️ No profile row found to update public_key. Create profile first.");
                    }
                } else {
                    setNeedsRestore(true);
                }

            } catch (error) {
                console.error("Failed to register device for E2EE:", error);
            }
        };

        registerDevice();
    }, [forceSetup]);

    async function handleSetup(e: React.FormEvent) {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setIsEncrypting(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const freshKeys = generateDeviceKeypair();

            const { encryptedKeyBase64, saltBase64, ivBase64 } = await encryptSecretKey(
                freshKeys.secretKey,
                password
            );
            await saveKeyBackup(encryptedKeyBase64, saltBase64, ivBase64);

            const { error: profileError } = await supabase
                .from("profiles")
                .update({ public_key: freshKeys.publicKey })
                .eq("id", user.id);
            if (profileError) throw profileError;

            // only store localy after backup + profile went through
            await storeDeviceKeys(freshKeys);

            toast.success("Encryption setup complete!");
            router.refresh();
        } catch (error: any) {
            console.error("Encryption setup failed", error);
            toast.error(error.message || "Encryption setup failed");
            setIsEncrypting(false);
        }
    }

    if (!forceSetup) {
        if (needsRestore) {
            return (
                <RestoreBackupDialog
                    onRestoreComplete={() => setNeedsRestore(false)}
                    onSkip={() => setNeedsRestore(false)}
                />
            );
        }
        return null;
    }

    return (
        <Dialog open={true} onOpenChange={(val) => { if (!val) return; }}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Setup E2E Encryption
                    </DialogTitle>
                    <DialogDescription>
                        Loopr uses End-to-End Encryption for direct messages. Set a recovery password to securely backup your keys. You only do this once.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSetup} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="rec_password">Recovery Password</Label>
                        <Input
                            id="rec_password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="rec_confirm">Confirm Password</Label>
                        <Input
                            id="rec_confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Type it again"
                            required
                            minLength={8}
                        />
                        <p className="text-xs text-muted-foreground">Keep this safe! Without it, you cannot read old messages on a new device.</p>
                    </div>
                    <Button type="submit" disabled={isEncrypting}>
                        {isEncrypting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Keys & Finish
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
