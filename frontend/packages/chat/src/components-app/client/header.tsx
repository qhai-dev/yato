"use client"

import { Button } from "@kairo/shadcn"
import { Folder, Settings2, Ellipsis, Users, Bot } from "lucide-react"

export function Header() {
    return (
        <div className="flex h-16 w-full items-center justify-between px-3">
            <div className="flex items-center gap-2 p-2">
                <div className="size-10 shrink-0 rounded-full bg-red-500"></div>
                <div className="flex flex-col justify-center gap-0.5">
                    <div className="truncate text-sm font-medium">任务名称</div>
                    <div className="flex items-center gap-1.5 text-xs leading-none">
                        <Users className="size-3" />
                        <span>12</span>
                        <Bot className="size-3" />
                        <span>10</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 p-2">
                <Button variant="ghost" size="icon" className="cursor-pointer">
                    <Folder />
                </Button>
                <Button variant="ghost" size="icon" className="cursor-pointer">
                    <Settings2 />
                </Button>
                <Button variant="ghost" size="icon" className="cursor-pointer">
                    <Ellipsis />
                </Button>
            </div>
        </div>
    )
}
