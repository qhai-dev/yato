import type { Direction } from "@yato/shadcn"
import { DirectionProvider, ToastProvider, TooltipProvider } from "@yato/shadcn"
import { PropsWithChildren } from "react"

export function ShadcnProvider({ children, dir }: PropsWithChildren<{ dir: Direction }>) {
    return (
        <DirectionProvider direction={dir}>
            <ToastProvider>
                <TooltipProvider>{children}</TooltipProvider>
            </ToastProvider>
        </DirectionProvider>
    )
}
