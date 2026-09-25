"use client"

import type { Direction } from "@kairo/shadcn"
import { DirectionProvider, ToastProvider, TooltipProvider } from "@kairo/shadcn"
import { PropsWithChildren } from "react"

export default function AppInitializer({ children, dir }: PropsWithChildren<{ dir: Direction }>) {
    return (
        <DirectionProvider direction={dir}>
            <ToastProvider>
                <TooltipProvider>{children}</TooltipProvider>
            </ToastProvider>
        </DirectionProvider>
    )
}
