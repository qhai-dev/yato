import { PropsWithChildren } from "react"

import { AgenticLayout } from "@/layers/app/layouts"

export default function Layout({ children }: PropsWithChildren) {
    return (
        <div>
            <AgenticLayout>{children}</AgenticLayout>
        </div>
    )
}
