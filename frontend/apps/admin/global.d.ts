import { languages } from "@/shared/i18n"
import messages from "@/shared/i18n/messages/zh-CN.json"

declare module "next-intl" {
    interface AppConfig {
        Locale: (typeof languages)[number]["value"]
        Messages: typeof messages
    }
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {}
    }
}
