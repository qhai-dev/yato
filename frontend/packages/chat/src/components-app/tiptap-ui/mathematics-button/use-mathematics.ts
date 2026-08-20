"use client"

import { type Editor } from "@tiptap/react"
import { useCallback, useEffect, useState } from "react"

// --- Icons ---
import { SigmaIcon } from "@/components/tiptap-icons/sigma-icon"
// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { getEditorExtension } from "@/lib/tiptap-advanced-utils"
// --- Lib ---
import { isExtensionAvailable, isNodeTypeSelected } from "@/lib/tiptap-utils"

export const MATHEMATICS_SHORTCUT_KEY = "mod+shift+m"

/**
 * Configuration for the mathematics functionality
 */
export interface UseMathematicsConfig {
    /**
     * The Tiptap editor instance.
     */
    editor?: Editor | null
    /**
     * Optional mathematical formula to insert when triggered
     * If not provided, will insert delimiter from the extension options
     */
    formula?: string
    /**
     * Whether the button should hide when mathematics is not available.
     * @default false
     */
    hideWhenUnavailable?: boolean
    /**
     * Callback function called after a successful formula insertion.
     */
    onInserted?: () => void
}

/**
 * Checks if mathematics can be inserted in the current editor state
 */
export function canInsertMathematics(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false
    if (!isExtensionAvailable(editor, "Mathematics") || isNodeTypeSelected(editor, ["image"]))
        return false

    const { selection } = editor.state
    const { $from } = selection

    // Disable in code blocks
    if ($from.parent.type.name === "codeBlock") return false

    return true
}

/**
 * Checks if mathematics is currently active by detecting math elements in DOM
 */
export function isMathematicsActive(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false

    try {
        const { from } = editor.state.selection
        const domAtPos = editor.view.domAtPos(from)
        if (!domAtPos || !domAtPos.node) return false

        let currentNode = domAtPos.node as Node

        for (let i = 0; i < 5; i++) {
            if (
                currentNode instanceof Element &&
                currentNode.classList &&
                (currentNode.classList.contains("Tiptap-mathematics-editor") ||
                    currentNode.closest(".Tiptap-mathematics-editor"))
            ) {
                return true
            }

            if (currentNode.parentNode) {
                currentNode = currentNode.parentNode
            } else {
                break
            }
        }

        return false
    } catch (error) {
        console.error("Failed to check mathematics active state:", error)
        return false
    }
}

/**
 * Extracts the delimiter character from a mathematical formula regex
 */
function extractDelimiterFromRegex(regex: RegExp): string | undefined {
    const regexSource = regex.source
    const delimiterMatch = regexSource.match(/^(.)\(\[\^\1\]\*\)\1$/)
    return delimiterMatch ? delimiterMatch[1] : undefined
}

/**
 * Inserts a mathematical formula with appropriate delimiters
 */
export function insertMathematicalFormula(editor: Editor | null, formula: string = ""): boolean {
    if (!editor || !editor.isEditable) return false
    if (!canInsertMathematics(editor)) return false

    try {
        if (formula) {
            return editor.chain().focus().insertContent(formula).run()
        }

        const extensionOptions = getEditorExtension(editor, "Mathematics")?.options
        if (!extensionOptions) return false

        let delimiter = "$"

        if (extensionOptions.regex instanceof RegExp) {
            const extractedDelimiter = extractDelimiterFromRegex(extensionOptions.regex)
            if (extractedDelimiter) {
                delimiter = extractedDelimiter
            }
        }

        return editor.chain().focus().insertContent(`${delimiter} ${delimiter}`).run()
    } catch {
        return false
    }
}

/**
 * Determines if the mathematics button should be shown
 */
export function shouldShowButton(props: {
    editor: Editor | null
    hideWhenUnavailable: boolean
}): boolean {
    const { editor, hideWhenUnavailable } = props

    if (!editor) return false

    if (!hideWhenUnavailable) {
        return true
    }

    if (!editor.isEditable) return false

    if (!isExtensionAvailable(editor, "Mathematics")) return false

    if (!editor.isActive("code")) {
        return canInsertMathematics(editor)
    }

    return true
}

/**
 * Custom hook that provides mathematics functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage - no params needed
 * function MySimpleMathButton() {
 *   const { isVisible, handleMathematics } = useMathematics()
 *
 *   if (!isVisible) return null
 *
 *   return <button onClick={handleMathematics}>Insert Formula</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedMathButton() {
 *   const { isVisible, handleMathematics, label, isActive } = useMathematics({
 *     editor: myEditor,
 *     formula: "E=mc^2",
 *     hideWhenUnavailable: true,
 *     onInserted: () => console.log('Formula inserted!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       onClick={handleMathematics}
 *       aria-pressed={isActive}
 *       aria-label={label}
 *     >
 *       Insert Formula
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useMathematics(config?: UseMathematicsConfig) {
    const {
        editor: providedEditor,
        formula = "",
        hideWhenUnavailable = false,
        onInserted,
    } = config || {}

    const { editor } = useTiptapEditor(providedEditor)
    const [isVisible, setIsVisible] = useState<boolean>(true)
    const canInsert = canInsertMathematics(editor)
    const isActive = isMathematicsActive(editor)

    useEffect(() => {
        if (!editor) return

        const handleSelectionUpdate = () => {
            setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
        }

        handleSelectionUpdate()

        editor.on("selectionUpdate", handleSelectionUpdate)

        return () => {
            editor.off("selectionUpdate", handleSelectionUpdate)
        }
    }, [editor, hideWhenUnavailable])

    const handleMathematics = useCallback(() => {
        if (!editor) return false

        const success = insertMathematicalFormula(editor, formula)
        if (success) {
            onInserted?.()
        }
        return success
    }, [editor, formula, onInserted])

    return {
        isVisible,
        isActive,
        handleMathematics,
        canInsert,
        label: "Mathematics",
        shortcutKeys: MATHEMATICS_SHORTCUT_KEY,
        Icon: SigmaIcon,
    }
}
