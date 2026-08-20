import { PropsWithChildren } from "react"

import "@/layers/app/styles/index.css"
import {
    TanstackQueryProvider,
    NextIntlProvider,
    NextThemesProvider,
    ShadcnProvider,
} from "@/layers/app/providers"

export default async function RootLayout({ children }: PropsWithChildren) {
    const locale = "zh-CN"
    const dir = "ltr"

    return (
        <html lang={locale} dir={dir} suppressHydrationWarning>
            <body className="h-full w-full overflow-hidden select-auto">
                <NextIntlProvider>
                    <NextThemesProvider>
                        <TanstackQueryProvider>
                            <ShadcnProvider dir={dir}>{children}</ShadcnProvider>
                        </TanstackQueryProvider>
                    </NextThemesProvider>
                </NextIntlProvider>
            </body>
        </html>
    )
}
