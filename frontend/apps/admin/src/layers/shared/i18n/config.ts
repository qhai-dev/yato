import { Locale } from "next-intl"

export const languages = [
    { name: "简体中文", dir: "ltr", value: "zh-CN" },
    { name: "English (United States)'", dir: "ltr", value: "en-US" },
    { name: "العربية (تونس)", dir: "rtl", value: "ar-TN" },
] as const

export const languageMap = Object.fromEntries(languages.map((l) => [l.value, l])) as Readonly<
    Record<Locale, (typeof languages)[number]>
>

export const defaultLocale: Locale = "zh-CN"
