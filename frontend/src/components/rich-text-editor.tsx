import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold, Italic, List, ListOrdered, Quote, Code2, Undo2, Redo2, Link2, Unlink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function RichTextEditor({
  value,
  onChange,
  placeholder = "详细描述问题现象、复现步骤、日志与上下文…",
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm min-h-40 max-w-none px-4 py-3 text-sm outline-none dark:prose-invert",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes("link").href
    const href = window.prompt("链接地址", previous || "https://")
    if (href === null) return
    if (!href) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
        <Tool active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="加粗"><Bold /></Tool>
        <Tool active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="斜体"><Italic /></Tool>
        <Tool active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="无序列表"><List /></Tool>
        <Tool active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="有序列表"><ListOrdered /></Tool>
        <Tool active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="引用"><Quote /></Tool>
        <Tool active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="代码块"><Code2 /></Tool>
        <span className="mx-1 h-5 w-px bg-border" />
        <Tool active={editor.isActive("link")} onClick={setLink} label="链接"><Link2 /></Tool>
        <Tool onClick={() => editor.chain().focus().unsetLink().run()} label="取消链接"><Unlink /></Tool>
        <span className="mx-1 h-5 w-px bg-border" />
        <Tool onClick={() => editor.chain().focus().undo().run()} label="撤销"><Undo2 /></Tool>
        <Tool onClick={() => editor.chain().focus().redo().run()} label="重做"><Redo2 /></Tool>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function Tool({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactElement<{ className?: string }>
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      className={cn("size-7", active && "bg-accent text-accent-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
