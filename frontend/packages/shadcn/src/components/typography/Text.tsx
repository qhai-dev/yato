import { cva, type VariantProps } from "class-variance-authority"
// import { Slot } from "radix-ui";
import * as React from "react"

import { cn } from "../../lib/utils"
const textVariants = cva("", {
    variants: {
        type: {
            primary: " ",
            secondary: "",
            tertiary: "text-typography-0 text-2xl leading-[1.2]",
            quaternary: "text-typography-0 text-2xl leading-[1.2]",
            warning: "text-typography-0 text-2xl leading-[1.2]",
            danger: "text-typography-0 text-2xl leading-[1.2]",
            success: "",
        },
        size: {
            normal: "",
            small: "",
        },
    },
    defaultVariants: {
        type: "primary",
    },
})

type TextProps = React.ComponentProps<"span"> & VariantProps<typeof textVariants>

export function Text({ className, children, type }: TextProps) {
    // const Comp = asChild ? Slot.Root : "span";
    return (
        <span data-slot="text" className={cn(textVariants({ className, type }))}>
            {children}
        </span>
    )
}
