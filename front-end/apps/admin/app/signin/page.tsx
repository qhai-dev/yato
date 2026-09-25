// import { Separator, Text, Title } from "@yato/shadcn"
// import { Locale, useTranslations } from "next-intl"

// import { setCookieLocale } from "@/layers/shared/i18n"
// import { LocaleSwitcher, ThemeToggle } from "@/layers/widgets/signin"

export default function Page() {
    // const t = useTranslations("signin")

    // async function changeLocaleAction(locale: Locale) {
    //     console.log(locale)
    // }

    return (
        <div className="bg-muted box-border flex min-h-screen w-full justify-center p-6">
            <div className="bg-background flex w-full shrink-0 flex-col rounded-2xl p-6">
                <div className="flex w-full items-center justify-end gap-1 max-sm:hidden">
                    {/*<LocaleSwitcher action={changeLocaleAction} />
                    <Separator orientation="vertical" />
                    <ThemeToggle />*/}
                </div>
                <div className="flex w-full grow flex-col items-center justify-center px-6 pb-12 md:px-27">
                    <div className="flex w-full flex-col sm:w-100">
                        <div className="my-8 flex flex-col items-start gap-2">
                            {/*<Title heading={2}>{t("title")}</Title>*/}
                            {/*<Text>{t("welcome")}</Text>*/}
                        </div>
                        {/*<NormalForm />*/}
                    </div>
                </div>
            </div>
        </div>
    )
}
