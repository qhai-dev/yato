"use client"
import { Button } from "@yato/shadcn"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    function onThemeChange() {
        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
            setTheme(systemTheme === "dark" ? "light" : "dark")
        } else {
            setTheme(theme === "dark" ? "light" : "dark")
        }
    }

    // className="hover:bg-hover-0 size-8 rounded-lg border-none p-1.5 text-black dark:text-white"
    return (
        <Button variant="ghost" onClick={onThemeChange}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4.5"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                <path d="M12 3l0 18" />
                <path d="M12 9l4.65 -4.65" />
                <path d="M12 14.3l7.37 -7.37" />
                <path d="M12 19.6l8.85 -8.85" />
            </svg>
        </Button>
    )
}
