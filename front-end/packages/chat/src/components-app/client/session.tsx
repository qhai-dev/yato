"use client"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@kairo/shadcn-semi"
import { Fragment, useState } from "react"

import { ChatPanel } from "./chat-panel"
import { Header } from "./header"
import { Sidebar } from "./sidebar"

type Props = {
    id: string
}

export function Conversation({ id }: Props) {
    const [isShow] = useState(false)

    console.log(id)

    return (
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
            <ResizablePanel minSize="387px" id="left" className="flex h-full flex-col">
                <Header />
                <ChatPanel />
            </ResizablePanel>
            {isShow && (
                <Fragment>
                    <ResizableHandle withHandle />
                    <ResizablePanel minSize="480px" id="right" className="h-full">
                        <Sidebar />
                    </ResizablePanel>
                </Fragment>
            )}
        </ResizablePanelGroup>
    )
}
