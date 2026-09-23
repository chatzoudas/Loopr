"use client";

import { usePathname } from "next/navigation";
import { KeyBackupConfig } from "@/components/messages/KeyBackupConfig";
import { RestoreBackupButton } from "@/components/messages/RestoreBackupButton";

export default function SidebarKeyBackup() {
    const pathname = usePathname();

    if (!pathname?.startsWith("/messages")) {
        return null;
    }

    return (
        <div className="w-full rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1">
            <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Chat recovery
            </div>
            <KeyBackupConfig compact />
            <RestoreBackupButton compact />
        </div>
    );
}
