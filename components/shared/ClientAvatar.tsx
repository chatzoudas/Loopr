"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function ClientAvatar({ src, alt, fallback }: { src?: string | null; alt?: string; fallback?: React.ReactNode }) {
    return (
        <Avatar className="h-9 w-9">
            {src ? <AvatarImage src={src} alt={alt} /> : <AvatarFallback>{fallback}</AvatarFallback>}
        </Avatar>
    );
}
