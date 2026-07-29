import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { PROGRESS_TYPE_LABEL, formatDateTime } from "@/lib/labels"
import type { IssueProgress } from "@/lib/types"

const TYPES = Object.keys(PROGRESS_TYPE_LABEL)

export function ProgressTimeline({
  issueId, items, onChanged,
}: {
  issueId: number; items: IssueProgress[]; onChanged: () => void
}) {
  const [type, setType] = useState("PROGRESS")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!content.trim()) return toast.error("请填写内容")
    setSaving(true)
    try {
      await api.post(`/issues/${issueId}/progress`, { type, content })
      setContent("")
      toast.success("已记录")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 添加记录 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{PROGRESS_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`记录${PROGRESS_TYPE_LABEL[type]}…`}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 添加记录
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 时间线 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">处理时间线</div>
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无处理记录</div>
          ) : (
            <div className="relative px-5 py-4">
              {items.map((item, idx) => (
                <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* 竖线 */}
                  {idx < items.length - 1 && (
                    <span className="absolute left-[5px] top-3 h-full w-px bg-border" />
                  )}
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {PROGRESS_TYPE_LABEL[item.type] || item.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
