import * as React from "react"

import { cn } from "../../lib/utils"

function Input({ className, type, autoComplete = "off", ...props }: React.ComponentProps<"input">) {
    return (
        <input
            autoComplete={autoComplete}
            type={type}
            data-slot="input"
            className={cn(
                "hover:bg-color-fill-1 focus:active:bg-color-fill-2 bg-color-fill-0 dark:bg-input/30 focus-visible:border-design-primary aria-invalid:bg-destructive-foreground dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 file:text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive h-8 w-full min-w-0 rounded-sm border border-transparent px-2.5 py-1 text-sm caret-black transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:caret-white",
                className,
            )}
            {...props}
        />
    )
}

export { Input }
