import { useRef, useState } from "react"
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/store/auth"
import { formatDateTime } from "@/lib/labels"
import { toast } from "sonner"
import type { IssueAttachment } from "@/lib/types"

export function AttachmentPanel({
  issueId,
  items,
  onChanged,
}: {
  issueId: number
  items: IssueAttachment[]
  onChanged: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const user = useAuth((state) => state.user)

  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("sourceType", "ISSUE")
      form.append("file", file)
      await api.upload(`/issues/${issueId}/attachments`, form)
      toast.success("附件已上传")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async (item: IssueAttachment) => {
    if (!window.confirm(`确认删除附件“${item.originalName}”？`)) return
    try {
      await api.del(`/attachments/${item.id}`)
      toast.success("附件已删除")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">附件</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">截图、日志与复现材料，单文件不超过 50MB</p>
          </div>
          <input ref={inputRef} type="file" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Upload className="size-4 animate-pulse" /> : <Paperclip className="size-4" />}
            {uploading ? "上传中" : "上传附件"}
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            暂无附件
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.originalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSize(item.fileSize)} · {item.uploaderName || "未知用户"} · {formatDateTime(item.createdAt)}
                  </div>
                </div>
                <Button variant="ghost" size="icon" title="下载"
                  onClick={() => api.download(`/attachments/${item.id}/download`, item.originalName)}>
                  <Download className="size-4" />
                </Button>
                {(user?.role === "ADMIN" || user?.id === item.uploaderId) && (
                  <Button variant="ghost" size="icon" title="删除" onClick={() => remove(item)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
