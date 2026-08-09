import { useEffect, useState } from "react"
import { Loader2, KeyRound, MessageSquareText, SlidersHorizontal } from "lucide-react"
import { api } from "@/lib/api"
import { PageBody, PageHeader } from "@/components/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/labels"
import { useAuth } from "@/store/auth"
import { toast } from "sonner"
import { CustomizationPage, AdminGate } from "@/pages/customization"
import type { Feedback } from "@/lib/types"

/**
 * 管理员页面：共享密码门禁后，提供「接入定制」与「使用反馈处理」。
 * 入口在左下角用户菜单（不校验身份，凭管理员密码进入）。
 */
export function AdminPage() {
  const { isAdminActive, verifyAdminPassword, logoutAdmin } = useAuth()
  const [unlocked, setUnlocked] = useState(isAdminActive())

  const unlock = async (password: string) => {
    await verifyAdminPassword(password)
    setUnlocked(true)
  }

  // 管理员令牌失效时退出管理态，回到密码门禁
  useEffect(() => {
    if (!unlocked) return
    if (!isAdminActive()) {
      setUnlocked(false)
      logoutAdmin()
    }
  }, [isAdminActive, unlocked, logoutAdmin])

  if (!unlocked) {
    return <AdminGate onUnlock={(password) => void unlock(password)} title="管理员页面" />
  }

  return (
    <>
      <PageHeader title="管理员页面" subtitle="接入定制与使用反馈处理（管理员专属）" />
      <PageBody>
        <Tabs defaultValue="customization">
          <TabsList>
            <TabsTrigger value="customization"><SlidersHorizontal className="size-4" /> 接入定制</TabsTrigger>
            <TabsTrigger value="feedback"><MessageSquareText className="size-4" /> 使用反馈处理</TabsTrigger>
          </TabsList>
          <TabsContent value="customization" className="mt-4">
            <CustomizationPage embedded />
          </TabsContent>
          <TabsContent value="feedback" className="mt-4">
            <FeedbackAdminPanel />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  )
}

function FeedbackAdminPanel() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await api.get<Feedback[]>("/feedback"))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const open = items.filter((i) => i.status === "OPEN").length

  return (
    <>
      <PageHeader
        title="使用反馈处理"
        subtitle={`待处理 ${open} 条，共 ${items.length} 条`}
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" /> 加载中…
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无反馈</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => <FeedbackRow key={item.id} item={item} onChanged={load} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function FeedbackRow({ item, onChanged }: { item: Feedback; onChanged: () => void }) {
  const [reply, setReply] = useState("")
  const [saving, setSaving] = useState(false)
  const isOpen = item.status === "OPEN"

  const process = async () => {
    setSaving(true)
    try {
      await api.post(`/feedback/${item.id}/process`, { reply: reply.trim() || undefined })
      toast.success("已处理")
      onChanged()
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
        <Badge variant={isOpen ? "destructive" : "secondary"} className="ml-auto">
          {isOpen ? "待处理" : "已处理"}
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
      {isOpen && (
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
