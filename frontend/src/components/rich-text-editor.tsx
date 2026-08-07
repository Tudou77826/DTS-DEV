import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold, Italic, List, ListOrdered, Quote, Code2, Undo2, Redo2, Link2, Unlink, ImagePlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/** 内嵌图片的最大字节数（2MB），转 base64 后随正文一起保存。 */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export function RichTextEditor({
  value,
  onChange,
  placeholder = "详细描述问题现象、复现步骤、日志与上下文…",
  enableImages = false,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  enableImages?: boolean
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: "max-w-full rounded-md border" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm min-h-40 max-w-none px-4 py-3 text-sm outline-none dark:prose-invert",
      },
      handlePaste: enableImages ? (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? [])
        const images = items.filter((item) => item.type.startsWith("image/"))
        if (images.length === 0) return false
        for (const item of images) {
          const file = item.getAsFile()
          if (file) void insertImage(view, file)
        }
        return true
      } : undefined,
      handleDrop: enableImages ? (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const images = files.filter((file) => file.type.startsWith("image/"))
        if (images.length === 0) return false
        for (const file of images) void insertImage(view, file)
        return true
      } : undefined,
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

  const pickImage = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) insertImage(editor.view, file)
    }
    input.click()
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
        {enableImages && (
          <Tool onClick={pickImage} label="插入图片（支持粘贴/拖入）"><ImagePlus /></Tool>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <Tool active={editor.isActive("link")} onClick={setLink} label="链接"><Link2 /></Tool>
        <Tool onClick={() => editor.chain().focus().unsetLink().run()} label="取消链接"><Unlink /></Tool>
        <span className="mx-1 h-5 w-px bg-border" />
        <Tool onClick={() => editor.chain().focus().undo().run()} label="撤销"><Undo2 /></Tool>
        <Tool onClick={() => editor.chain().focus().redo().run()} label="重做"><Redo2 /></Tool>
      </div>
      {enableImages && (
        <div className="border-b border-border bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
          支持粘贴或拖入图片，单张不超过 2MB
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

/** 把图片文件转成 base64 插入编辑器。 */
function insertImage(view: import("@tiptap/pm/view").EditorView, file: File) {
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error("图片过大，请压缩后重试（最大 2MB）")
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== "string") return
    view.focus()
    const { state } = view
    const node = state.schema.nodes.image.create({ src: reader.result })
    const tr = state.tr.replaceSelectionWith(node)
    view.dispatch(tr)
  }
  reader.readAsDataURL(file)
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
