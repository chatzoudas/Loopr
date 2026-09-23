"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    clearDeviceKeys,
    decryptSecretKey,
    encryptSecretKey,
    generateDeviceKeypair,
    storeDeviceKeys,
    getDeviceKeys,
} from "@/lib/crypto";
import { saveKeyBackup, getKeyBackup } from "@/lib/actions/crypto";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";

interface KeyBackupConfigProps {
    compact?: boolean;
    isOpen?: boolean;
    hideTrigger?: boolean;
    onOpenChange?: (open: boolean) => void;
    onBackupSaved?: () => void;
}

type BackupMode = "create" | "change" | "reset";

const RESET_CONFIRMATION = "RESET";

export function KeyBackupConfig({
    compact = false,
    isOpen,
    hideTrigger = false,
    onOpenChange,
    onBackupSaved,
}: KeyBackupConfigProps) {
    const [mode, setMode] = useState<BackupMode>("create");
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetConfirmation, setResetConfirmation] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const [backupExists, setBackupExists] = useState(false);
    const [backupUpdatedAt, setBackupUpdatedAt] = useState<string | null>(null);
    const open = isOpen ?? internalOpen;

    useEffect(() => {
        if (open) {
            void checkBackup();
        }
    }, [open]);

    function setOpen(nextOpen: boolean) {
        if (onOpenChange) {
            onOpenChange(nextOpen);
        } else {
            setInternalOpen(nextOpen);
        }
    }

    function resetForm() {
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
        setResetConfirmation("");
    }

    function closeDialog() {
        setOpen(false);
        resetForm();
    }

    function selectMode(nextMode: BackupMode) {
        setMode(nextMode);
        resetForm();
    }

    async function checkBackup() {
        try {
            const data = await getKeyBackup();
            if (data && data.encrypted_key) {
                setBackupExists(true);
                setBackupUpdatedAt(data.updated_at ?? null);
                setMode("change");
            } else {
                setBackupExists(false);
                setBackupUpdatedAt(null);
                setMode("create");
            }
        } catch {
            setBackupExists(false);
            setBackupUpdatedAt(null);
            setMode("create");
        }
    }

    async function syncProfilePublicKey(publicKey: string) {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return;
        }

        const { data: updatedProfile, error } = await supabase
            .from("profiles")
            .update({ public_key: publicKey })
            .eq("id", user.id)
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("Failed to update public_key:", error);
            return;
        }

        if (!updatedProfile) {
            console.warn("No profile row found to update public_key.");
        }
    }

    async function handleBackup(e: React.FormEvent) {
        e.preventDefault();

        const requiresCurrentPassword = mode === "change";
        const isReset = mode === "reset";

        if (requiresCurrentPassword && !currentPassword) {
            toast.error("Enter your current recovery password first.");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        if (isReset && resetConfirmation !== RESET_CONFIRMATION) {
            toast.error(`Type ${RESET_CONFIRMATION} to confirm the reset.`);
            return;
        }

        setIsLoading(true);
        try {
            if (mode === "change") {
                const backup = await getKeyBackup();
                if (!backup?.encrypted_key || !backup.salt || !backup.iv) {
                    throw new Error("No recovery backup found to update.");
                }

                const secretKey = await decryptSecretKey(
                    backup.encrypted_key,
                    backup.salt,
                    backup.iv,
                    currentPassword
                );

                const { encryptedKeyBase64, saltBase64, ivBase64 } = await encryptSecretKey(
                    secretKey,
                    password
                );

                await saveKeyBackup(encryptedKeyBase64, saltBase64, ivBase64);

                toast.success("Recovery password updated without changing your chats.");
                closeDialog();
                return;
            }

            if (mode === "reset") {
                const freshKeys = generateDeviceKeypair();

                const { encryptedKeyBase64, saltBase64, ivBase64 } = await encryptSecretKey(
                    freshKeys.secretKey,
                    password
                );

                await saveKeyBackup(encryptedKeyBase64, saltBase64, ivBase64);
                await syncProfilePublicKey(freshKeys.publicKey);

                await clearDeviceKeys();
                await storeDeviceKeys(freshKeys);

                toast.success("Recovery key reset. Old chats will no longer decrypt on this device.");
                closeDialog();
                window.setTimeout(() => window.location.reload(), 250);
                return;
            }

            const keys = await getDeviceKeys();
            if (!keys) {
                toast.error("No local keys found. Please complete encryption setup first.");
                return;
            }

            const { encryptedKeyBase64, saltBase64, ivBase64 } = await encryptSecretKey(
                keys.secretKey,
                password
            );

            await saveKeyBackup(encryptedKeyBase64, saltBase64, ivBase64);
            await syncProfilePublicKey(keys.publicKey);

            toast.success("Backup saved securely.");
            closeDialog();
            onBackupSaved?.();
            setBackupExists(true);
            setBackupUpdatedAt(new Date().toISOString());
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to save backup.";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open) {
                    resetForm();
                }
            }}
        >
            {!hideTrigger ? (
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        className={compact ? "w-full justify-start gap-2 h-9 text-xs px-3" : "w-full justify-start gap-3 h-12 text-base"}
                    >
                        <span className={compact ? "flex h-5 w-5 items-center justify-center" : "flex h-9 w-9 items-center justify-center"}>
                            <Lock className={compact ? "h-4 w-4" : "h-6 w-6"} />
                        </span>
                        <span className="leading-none">Chat Recovery Settings</span>
                    </Button>
                </DialogTrigger>
            ) : null}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {backupExists
                            ? mode === "reset"
                                ? "Reset Chat Recovery"
                                : "Manage Chat Recovery"
                            : "Chat Recovery Password"}
                    </DialogTitle>
                    <DialogDescription>
                        {backupExists ? (
                            <>
                                A backup already exists
                                {backupUpdatedAt ? ` (updated ${new Date(backupUpdatedAt).toLocaleString()})` : ""}.
                                {mode === "reset"
                                    ? " Resetting creates a brand new keypair and old chats on this device will no longer decrypt."
                                    : " Enter your current recovery password to change the password without changing your chats."}
                            </>
                        ) : (
                            "Set a password to encrypt your secret key and store it on the server. You'll need this password to read your messages on a new device."
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleBackup} className="space-y-4 mt-4">
                    {backupExists ? (
                        <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 p-1">
                            <Button
                                type="button"
                                variant={mode === "change" ? "secondary" : "ghost"}
                                className="h-10"
                                onClick={() => selectMode("change")}
                            >
                                Change password
                            </Button>
                            <Button
                                type="button"
                                variant={mode === "reset" ? "destructive" : "ghost"}
                                className="h-10"
                                onClick={() => selectMode("reset")}
                            >
                                Reset key
                            </Button>
                        </div>
                    ) : null}

                    {mode === "change" && backupExists ? (
                        <>
                            <div>
                                <label className="text-sm font-medium">Current Recovery Password</label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter your old password"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">New Recovery Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Confirm New Password</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                        </>
                    ) : null}

                    {mode === "reset" && backupExists ? (
                        <>
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                Resetting creates a fresh keypair. Your existing chats will stop decrypting on this device.
                            </div>
                            <div>
                                <label className="text-sm font-medium">New Recovery Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Confirm New Password</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Type RESET to confirm</label>
                                <Input
                                    type="text"
                                    value={resetConfirmation}
                                    onChange={(e) => setResetConfirmation(e.target.value)}
                                    placeholder="RESET"
                                    required
                                />
                            </div>
                        </>
                    ) : null}

                    {!backupExists ? (
                        <>
                            <div>
                                <label className="text-sm font-medium">Recovery Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Confirm Password</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm password"
                                    required
                                />
                            </div>
                        </>
                    ) : null}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full"
                        variant={mode === "reset" ? "destructive" : "default"}
                    >
                        {isLoading
                            ? "Saving..."
                            : backupExists
                                ? mode === "reset"
                                    ? "Reset Recovery Key"
                                    : "Update Password"
                                : "Save Backup"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
