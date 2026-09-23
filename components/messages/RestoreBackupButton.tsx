"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { decryptSecretKey, injectRestoredKey, getDeviceKeys } from "@/lib/crypto";
import { getKeyBackup } from "@/lib/actions/crypto";
import { createClient } from "@/lib/supabase/client";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { toast } from "sonner";

interface RestoreBackupButtonProps {
    compact?: boolean;
}

export function RestoreBackupButton({ compact = false }: RestoreBackupButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function handleRestore(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);

        try {
            const currentKeys = await getDeviceKeys();
            if (process.env.NODE_ENV !== "production") console.log("🔐 Current device_id BEFORE restore:", currentKeys?.deviceId);

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
            if (process.env.NODE_ENV !== "production") console.log("🔓 Restored public_key:", publicKeyBase64.substring(0, 20) + "...");

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
            setPassword("");
        } catch (error: any) {
            console.error("❌ Restore error details:", error);
            toast.error(error.message || "Incorrect password or failed to restore.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <Button
                variant="ghost"
                className={compact ? "w-full justify-start gap-2 h-9 text-xs px-3" : "w-full justify-start gap-3 h-12 text-base"}
                onClick={() => setIsOpen(true)}
            >
                <span className={compact ? "flex h-5 w-5 items-center justify-center" : "flex h-9 w-9 items-center justify-center"}>
                    <RotateCcw className={compact ? "h-4 w-4" : "h-6 w-6"} />
                </span>
                <span className="leading-none">Restore Chats</span>
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restore Encrypted Messages</DialogTitle>
                        <DialogDescription>
                            Enter your recovery password to restore your message history from a backup.
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
                        <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? "Restoring..." : "Restore Messages"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
