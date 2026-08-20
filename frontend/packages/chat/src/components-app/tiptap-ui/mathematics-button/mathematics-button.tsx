"use client"

import { forwardRef, useCallback } from "react"

import { Badge } from "@/components/tiptap-ui-primitive/badge"
// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
// --- Tiptap UI ---
import type { UseMathematicsConfig } from "@/components/tiptap-ui/mathematics-button"
import { MATHEMATICS_SHORTCUT_KEY, useMathematics } from "@/components/tiptap-ui/mathematics-button"
// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

export interface MathematicsButtonProps extends Omit<ButtonProps, "type">, UseMathematicsConfig {
    /**
     * Optional text to display alongside the icon.
     */
    text?: string
    /**
     * Optional show shortcut keys in the button.
     * @default false
     */
    showShortcut?: boolean
}

export function MathematicsShortcutBadge({
    shortcutKeys = MATHEMATICS_SHORTCUT_KEY,
}: {
    shortcutKeys?: string
}) {
    return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for inserting mathematical formulas in a Tiptap editor.
 *
 * For custom button implementations, use the `useMathematics` hook instead.
 */
export const MathematicsButton = forwardRef<HTMLButtonElement, MathematicsButtonProps>(
    (
        {
            editor: providedEditor,
            text,
            formula = "",
            hideWhenUnavailable = false,
            onInserted,
            showShortcut = false,
            onClick,
            children,
            ...buttonProps
        },
        ref,
    ) => {
        const { editor } = useTiptapEditor(providedEditor)
        const { isVisible, handleMathematics, label, canInsert, isActive, shortcutKeys, Icon } =
            useMathematics({
                editor,
                formula,
                hideWhenUnavailable,
                onInserted,
            })

        const handleClick = useCallback(
            (event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event)
                if (event.defaultPrevented) return
                handleMathematics()
            },
            [handleMathematics, onClick],
        )

        if (!isVisible) {
            return null
        }

        return (
            <Button
                type="button"
                disabled={!canInsert}
                variant="ghost"
                data-active-state={isActive ? "on" : "off"}
                data-disabled={!canInsert}
                role="button"
                tabIndex={-1}
                aria-label={label}
                tooltip={label}
                onClick={handleClick}
                {...buttonProps}
                ref={ref}
            >
                {children ?? (
                    <>
                        <Icon className="tiptap-button-icon" />
                        {text && <span className="tiptap-button-text">{text}</span>}
                        {showShortcut && <MathematicsShortcutBadge shortcutKeys={shortcutKeys} />}
                    </>
                )}
            </Button>
        )
    },
)

MathematicsButton.displayName = "MathematicsButton"
