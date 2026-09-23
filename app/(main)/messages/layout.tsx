"use client";

import { useEffect, useState } from "react";
import { KeyBackupConfig } from "@/components/messages/KeyBackupConfig";
import { RestoreBackupDialog } from "@/components/messages/RestoreBackupDialog";
import { getDeviceKeys } from "@/lib/crypto";
import { getKeyBackup } from "@/lib/actions/crypto";

export default function MessagesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [showRestore, setShowRestore] = useState(false);
    const [showRecoverySetup, setShowRecoverySetup] = useState(false);
    const [restoreChecked, setRestoreChecked] = useState(false);

    useEffect(() => {
        const checkRestore = async () => {
            try {
                const localKey = await getDeviceKeys();
                const backup = await getKeyBackup();

                if (!backup) {
                    setShowRecoverySetup(true);
                    setShowRestore(false);
                } else if (!localKey) {
                    setShowRestore(true);
                    setShowRecoverySetup(false);
                } else {
                    setShowRestore(false);
                    setShowRecoverySetup(false);
                }
            } catch (error) {
                console.error("Error checking for restore:", error);
            }
            setRestoreChecked(true);
        };

        checkRestore();
    }, []);

    useEffect(() => {
        const openSetup = () => {
            setShowRestore(false);
            setShowRecoverySetup(true);
        };

        const openRestore = () => {
            setShowRecoverySetup(false);
            setShowRestore(true);
        };

        window.addEventListener("loopr:open-recovery-setup", openSetup);
        window.addEventListener("loopr:open-recovery-restore", openRestore);

        return () => {
            window.removeEventListener("loopr:open-recovery-setup", openSetup);
            window.removeEventListener("loopr:open-recovery-restore", openRestore);
        };
    }, []);

    if (!restoreChecked) {
        return <div className="h-[calc(100vh-3rem)] flex flex-col" />;
    }

    return (
        <div className="h-[calc(100vh-3rem)] flex flex-col">
            {showRecoverySetup ? (
                <KeyBackupConfig
                    isOpen={showRecoverySetup}
                    hideTrigger
                    onOpenChange={(open) => setShowRecoverySetup(open)}
                    onBackupSaved={() => setShowRecoverySetup(false)}
                />
            ) : null}
            {showRestore ? (
                <RestoreBackupDialog
                    onRestoreComplete={() => setShowRestore(false)}
                    onSkip={() => setShowRestore(false)}
                />
            ) : null}
            <div className="flex justify-end "></div>
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
