'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
    pendingText?: string;
}

export function SubmitButton({ children, pendingText, className, ...props }: SubmitButtonProps) {
    const { pending } = useFormStatus()

    return (
        <Button {...props} disabled={pending || props.disabled} className={cn("cursor-pointer", className)}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {pendingText || children}
                </>
            ) : (
                children
            )}
        </Button>
    )
}