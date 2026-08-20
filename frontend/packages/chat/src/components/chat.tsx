"use client"
import { ChatComposer } from "./chat-composer"
import { ChatScrollView } from "./chat-scroll-view"

export type ChatProps = {
    className?: string
}

export function Chat() {
    return (
        <div className="flex h-full w-full flex-col items-center">
            <ChatScrollView></ChatScrollView>
            <ChatComposer></ChatComposer>
        </div>
    )
}
