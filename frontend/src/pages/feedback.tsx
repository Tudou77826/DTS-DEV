import { useEffect, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "@/components/rich-text-editor"
import { formatDateTime } from "@/lib/labels"
import type { Feedback } from "@/lib/types"
import { useAuth } from "@/store/auth"
import { toast } from "sonner"

export function FeedbackPage() {
  const { user } = useAuth()
  const isLeader = user?.role === "LEADER"
  const [mine, setMine] = useState<Feedback[]>([])
  const [all, setAll] = useState<Feedback[] | null>(null)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [my, full] = await Promise.all([
        api.get<Feedback[]>("/feedback/mine"),
        isLeader ? api.get<Feedback[]>("/feedback").catch(() => []) : Promise.resolve([]),
      ])
      setMine(my)
      setAll(isLeader ? full : null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [isLeader])

  const submit = async () => {
    if (!content.trim()) return toast.error("请填写反馈内容")
    setSubmitting(true)
    try {
      await api.post("/feedback", { content })
      toast.success("反馈已提交")
      setContent("")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title="站内反馈" subtitle="反馈问题、改进建议或使用体验，项目负责人会及时处理" />
      <PageBody className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-2">
              <Label>反馈内容（支持粘贴/拖入图片，单张不超过 2MB）</Label>
              <RichTextEditor value={content} onChange={setContent} enableImages placeholder="请描述你的反馈…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} 提交反馈
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLeader && all && (
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">全部反馈（{all.length}）</div>
              {all.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无反馈</div>
              ) : (
                <div className="divide-y divide-border">
                  {all.map((item) => <FeedbackItem key={item.id} item={item} onProcessed={load} />)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">我提交的反馈（{mine.length}）</div>
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-4 animate-spin" /> 加载中…
              </div>
            ) : mine.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无反馈</div>
            ) : (
              <div className="divide-y divide-border">
                {mine.map((item) => <FeedbackItem key={item.id} item={item} onProcessed={load} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function FeedbackItem({ item, onProcessed }: { item: Feedback; onProcessed: () => void }) {
  const { user } = useAuth()
  const canProcess = (user?.role === "LEADER" || user?.id === item.handledBy) && item.status === "OPEN"
  const [reply, setReply] = useState("")
  const [saving, setSaving] = useState(false)

  const process = async () => {
    setSaving(true)
    try {
      await api.post(`/feedback/${item.id}/process`, { reply: reply.trim() || undefined })
      toast.success("已处理")
      onProcessed()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "处理失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{item.userName || "用户"}</span>
        <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
        <Badge variant={item.status === "OPEN" ? "destructive" : "secondary"} className="ml-auto">
          {item.status === "OPEN" ? "待处理" : "已处理"}
        </Badge>
      </div>
      <div
        className="prose prose-sm mt-2 max-w-none text-sm dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
      {item.reply && (
        <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">处理回复（{item.handlerName || ""}）</span>
          <p className="mt-0.5 whitespace-pre-wrap">{item.reply}</p>
        </div>
      )}
      {canProcess && (
        <div className="mt-3 flex items-start gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="填写处理回复…"
            rows={2}
            className="flex-1"
          />
          <Button size="sm" onClick={process} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "处理"}
          </Button>
        </div>
      )}
    </div>
  )
}
