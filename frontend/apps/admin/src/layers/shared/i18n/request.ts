import { getRequestConfig } from "next-intl/server"

import { getCookieLocale } from "./cookie"

export default getRequestConfig(async () => {
    const locale = await getCookieLocale()

    const mod = await import(`./messages/${locale}.json`)

    return {
        locale,
        messages: mod.default,
    }
})
