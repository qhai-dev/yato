import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function defaultGenerateMetadata(): Promise<Metadata> {
    const t = await getTranslations("app")

    return {
        title: {
            template: `%s-${t("title")}`,
            default: t("title"),
        },
        description: "",
    }
}
