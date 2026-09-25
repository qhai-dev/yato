"use client"
import { ScrollArea } from "@kairo/shadcn"
import * as React from "react"

import { ChatMessage } from "../chat-message"

const tags = Array.from({ length: 1 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`)

export function ChatScrollView() {
    return (
        <div className="min-h-0 w-full flex-1">
            <div className="relative h-full w-full">
                <ScrollArea>
                    <div className="p-4">
                        {tags.map((tag) => (
                            <React.Fragment key={tag}>
                                <div className="text-sm">{tag}</div>
                                <ChatMessage></ChatMessage>
                            </React.Fragment>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
