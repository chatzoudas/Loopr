"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { decryptSecretKey, injectRestoredKey } from "@/lib/crypto";
import { getKeyBackup } from "@/lib/actions/crypto";
import { createClient } from "@/lib/supabase/client";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { toast } from "sonner";

interface RestoreBackupDialogProps {
    onRestoreComplete: () => void;
    onSkip: () => void;
}

export function RestoreBackupDialog({ onRestoreComplete, onSkip }: RestoreBackupDialogProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function handleRestore(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);

        try {
            const backup = await getKeyBackup();
            if (!backup) {
                throw new Error("No backup found on the server.");
            }

            const secretKey = await decryptSecretKey(
                backup.encrypted_key,
                backup.salt,
                backup.iv,
                password
            );

            if (process.env.NODE_ENV !== "production") console.log("✅ Decrypted secret key from backup:", {
                secretKeyLength: secretKey.length,
                secretKeyType: secretKey.constructor.name,
            });

            const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
            const publicKeyBase64 = encodeBase64(keyPair.publicKey);

            if (process.env.NODE_ENV !== "production") console.log("🔑 Derived public key from restored secret:", {
                publicKeyBase64: publicKeyBase64.substring(0, 20) + "...",
            });

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: updatedProfile, error: updateError } = await supabase
                    .from("profiles")
                    .update({ public_key: publicKeyBase64 })
                    .eq("id", user.id)
                    .select("id")
                    .maybeSingle();
                if (updateError) {
                    console.error("❌ Failed to update public key:", updateError);
                } else if (!updatedProfile) {
                    console.warn("⚠️ No profile row found to update public_key. Create profile first.");
                } else {
                    if (process.env.NODE_ENV !== "production") console.log("✅ Updated public_key in profiles table");
                }
            }

            const injected = await injectRestoredKey(secretKey);
            if (process.env.NODE_ENV !== "production") console.log("✅ Injected restored key into IndexedDB:", {
                publicKey: injected.publicKey.substring(0, 20) + "...",
                hasSecretKey: !!injected.secretKey,
            });

            window.dispatchEvent(new Event("loopr:crypto-restored"));

            toast.success("Messages restored successfully.");
            setIsOpen(false);

            window.location.reload();
            onRestoreComplete();
        } catch (error: any) {
            console.error("❌ Restore error details:", error);
            toast.error(error.message || "Incorrect password or failed to restore.");
        } finally {
            setIsLoading(false);
        }
    }

    function handleSkip() {
        setIsOpen(false);
        onSkip();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Restore Encrypted Messages</DialogTitle>
                    <DialogDescription>
                        You have an E2EE key backup on the server. Enter your recovery password to restore your message history.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRestore} className="space-y-4 mt-4">
                    <div>
                        <label className="text-sm font-medium">Recovery Password</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isLoading} className="flex-1">
                            {isLoading ? "Restoring..." : "Restore"}
                        </Button>
                        <Button type="button" variant="outline" disabled={isLoading} onClick={handleSkip} className="flex-1">
                            Skip
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
