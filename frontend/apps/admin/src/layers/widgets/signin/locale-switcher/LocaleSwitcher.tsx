"use client"

import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Globe,
} from "@yato/shadcn"
import { useLocale, Locale } from "next-intl"

import { languages, languageMap } from "@/layers/shared/i18n"

type Props = {
    action: (locale: Locale) => Promise<void>
}

export function LocaleSwitcher({ action }: Props) {
    const locale = useLocale()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                nativeButton={false}
                render={
                    <div className="flex w-56 items-center justify-end">
                        <Button variant="ghost">
                            <Globe size={20} />
                            {languageMap[locale]?.name}
                        </Button>
                    </div>
                }
            ></DropdownMenuTrigger>
            <DropdownMenuContent
                sideOffset={8}
                align="end"
                className="border-highlight-2 bg-panel-bg box-border max-h-96 w-50 overflow-y-auto rounded-xl border-[0.5px] p-1 shadow-lg"
            >
                {languages.map((item, index) => (
                    <DropdownMenuItem
                        className="text-secondary hover:bg-state-hove rounded-lg px-3 py-2 text-sm"
                        key={index}
                        onClick={() => action(item.value)}
                    >
                        {item.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
