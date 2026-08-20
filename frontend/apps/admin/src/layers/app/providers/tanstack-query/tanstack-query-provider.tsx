"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { PropsWithChildren } from "react"

import { queryClient } from "@/layers/shared/api"

export function TanstackQueryProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
