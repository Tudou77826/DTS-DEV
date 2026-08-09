import { useEffect, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "@/components/rich-text-editor"
import { formatDateTime } from "@/lib/labels"
import type { Feedback } from "@/lib/types"
import { toast } from "sonner"

export function FeedbackPage() {
  const [mine, setMine] = useState<Feedback[]>([])
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setMine(await api.get<Feedback[]>("/feedback/mine"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
      <PageHeader title="使用反馈" subtitle="反馈问题、改进建议或使用体验，管理员会及时处理" />
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
                {mine.map((item) => <FeedbackItem key={item.id} item={item} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function FeedbackItem({ item }: { item: Feedback }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 text-sm">
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
    </div>
  )
}
