"use client"

import { computePosition, flip, shift } from "@floating-ui/dom"
import { Button } from "@kairo/shadcn"
import Document from "@tiptap/extension-document"
import Mention from "@tiptap/extension-mention"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { Placeholder } from "@tiptap/extensions"
import { useEditor, EditorContent, Editor, posToDOMRect, ReactRenderer } from "@tiptap/react"
import { Plus, AtSign, ArrowUp } from "lucide-react"

import { MentionList } from "./MentionList"
import { suggestion } from "./suggestion"

export function ChatComposer() {
    const editor = useEditor({
        extensions: [
            Document,
            Paragraph.configure({
                HTMLAttributes: {
                    class: "my-custom-paragraph",
                },
            }),
            Text,
            Placeholder.configure({
                placeholder: `输入"/" 引用技能或文件，输入"@" 引用成员或智能体`,
            }),
            Mention.configure({
                HTMLAttributes: {
                    class: "mention",
                },
                suggestions: [
                    suggestion,
                    {
                        char: "@",
                        items: ({ query }) => {
                            return ["用户1", "用户2", "用户3"]
                                .filter((item) =>
                                    item.toLowerCase().startsWith(query.toLowerCase()),
                                )
                                .slice(0, 5)
                        },
                        render: () => {
                            let component: any
                            return {
                                onStart: (props) => {
                                    component = new ReactRenderer(MentionList, {
                                        props,
                                        editor: props.editor,
                                    })

                                    if (!props.clientRect) {
                                        return
                                    }

                                    component.element.style.position = "absolute"

                                    document.body.appendChild(component.element)

                                    updatePosition(props.editor, component.element)
                                },

                                onUpdate(props) {
                                    component.updateProps(props)

                                    if (!props.clientRect) {
                                        return
                                    }

                                    updatePosition(props.editor, component.element)
                                },

                                onKeyDown(props) {
                                    if (props.event.key === "Escape") {
                                        component.destroy()

                                        return true
                                    }

                                    return component.ref?.onKeyDown(props)
                                },

                                onExit() {
                                    component.element.remove()
                                    component.destroy()
                                },
                            }
                        },
                    },
                ],
            }),
        ],
        immediatelyRender: true,
        content: "",
        editorProps: {
            attributes: {
                class: "focus:outline-none",
            },
        },
    })

    return (
        <div className="w-full max-w-212 px-6 py-4">
            <div className="bg-test rounded-2xl p-1">
                <div className="bg-background flex w-full flex-col gap-1 rounded-xl p-3">
                    <EditorContent editor={editor} className="max-h-55.5 overflow-y-auto" />
                    <div className="flex items-center justify-between">
                        <div className="flex shrink-0 gap-1.5">
                            <Button variant="outline" size="icon" className="rounded-full">
                                <Plus></Plus>
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full">
                                <AtSign />
                            </Button>
                        </div>
                        <div>
                            <Button disabled variant="outline" size="icon" className="rounded-full">
                                <ArrowUp />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const updatePosition = (editor: Editor, element: HTMLElement) => {
    const virtualElement = {
        getBoundingClientRect: () =>
            posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
    }

    computePosition(virtualElement, element, {
        placement: "bottom-start",
        strategy: "absolute",
        middleware: [shift(), flip()],
    }).then(({ x, y, strategy }) => {
        element.style.width = "max-content"
        element.style.position = strategy
        element.style.left = `${x}px`
        element.style.top = `${y}px`
    })
}
