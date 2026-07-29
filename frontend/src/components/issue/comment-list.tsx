import { useEffect, useState } from "react"
import { Send, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/labels"
import { useAuth } from "@/store/auth"
import type { Comment, User } from "@/lib/types"

export function CommentList({
  issueId, items, onChanged,
}: {
  issueId: number; items: Comment[]; onChanged: () => void
}) {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<User[]>("/config/users").then(setUsers).catch(() => {})
  }, [])

  const authorName = (id: number) => users.find((u) => u.id === id)?.displayName || `用户${id}`
  const authorColor = (id: number) => users.find((u) => u.id === id)?.avatarColor

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await api.post(`/issues/${issueId}/comments`, { content })
      setContent("")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-5 py-3 text-sm font-medium">评论与协同</div>
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无评论</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((c) => (
              <div key={c.id} className="flex gap-3 px-5 py-3">
                <UserAvatar name={authorName(c.authorId)} color={authorColor(c.authorId)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{authorName(c.authorId)}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className="flex items-end gap-2 border-t border-border p-3">
          <UserAvatar name={user?.displayName} color={user?.avatarColor} />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="发表评论或补充信息…"
            rows={2}
            className="min-h-[40px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
          <Button size="icon" onClick={submit} disabled={saving || !content.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
