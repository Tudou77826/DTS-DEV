import { useEffect, useMemo, useRef, useState } from "react"
import { AtSign, Send, Loader2, X, Paperclip, Download } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { toast } from "sonner"
import { formatDateTime, formatFileSize } from "@/lib/labels"
import { useAuth } from "@/store/auth"
import type { Comment, IssueAttachment, User } from "@/lib/types"

interface PendingFile {
  file: File
  id: string
}

export function CommentList({
  issueId, items, onChanged,
}: {
  issueId: number; items: Comment[]; onChanged: () => void
}) {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentioned, setMentioned] = useState<Set<number>>(new Set())
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<User[]>("/config/users").then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    api.get<IssueAttachment[]>(`/issues/${issueId}/attachments`)
      .then((list) => setAttachments(list.filter((a) => a.sourceType === "COMMENT")))
      .catch(() => setAttachments([]))
  }, [issueId])

  const authorName = (id: number) => users.find((u) => u.id === id)?.displayName || `用户${id}`
  const authorColor = (id: number) => users.find((u) => u.id === id)?.avatarColor

  const mentionable = useMemo(() => users.filter((u) => u.id !== user?.id), [users, user?.id])
  const commentsBySource = useMemo(() => {
    const map = new Map<number, IssueAttachment[]>()
    for (const attachment of attachments) {
      if (!attachment.sourceId) continue
      const list = map.get(attachment.sourceId) || []
      list.push(attachment)
      map.set(attachment.sourceId, list)
    }
    return map
  }, [attachments])

  const toggleMention = (u: User) => {
    setMentioned((current) => {
      const next = new Set(current)
      if (next.has(u.id)) {
        next.delete(u.id)
      } else {
        next.add(u.id)
        setContent((value) => `${value}@${u.displayName} `.trimStart())
      }
      return next
    })
  }

  const pickFiles = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).map((file) => ({ file, id: `${file.name}-${file.size}-${Date.now()}` }))
    setPendingFiles((current) => [...current, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePending = (id: string) => setPendingFiles((current) => current.filter((p) => p.id !== id))

  const submit = async () => {
    if (!content.trim() && pendingFiles.length === 0) return
    setSaving(true)
    try {
      const created = await api.post<Comment>(`/issues/${issueId}/comments`, {
        content,
        mentionIds: mentioned.size > 0 ? Array.from(mentioned) : undefined,
      })
      if (pendingFiles.length > 0) {
        for (const pending of pendingFiles) {
          const form = new FormData()
          form.append("file", pending.file)
          form.append("sourceType", "COMMENT")
          form.append("sourceId", String(created.id))
          await api.post<IssueAttachment>(`/issues/${issueId}/attachments`, form)
        }
      }
      setContent("")
      setMentioned(new Set())
      setMentionOpen(false)
      setPendingFiles([])
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
            {items.map((c) => {
              const files = commentsBySource.get(c.id) || []
              return (
                <div key={c.id} className="flex gap-3 px-5 py-3">
                  <UserAvatar name={authorName(c.authorId)} color={authorColor(c.authorId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{authorName(c.authorId)}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      {files.length > 0 && (
                        <Badge variant="secondary" className="gap-1 py-0 text-[10px]">
                          <Paperclip className="size-2.5" /> {files.length} 个附件
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      <MentionText content={c.content} mentionIds={c.mentionIds} users={users} />
                    </p>
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {files.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={`/api/attachments/${attachment.id}/download`}
                            onClick={(e) => {
                              e.preventDefault()
                              api.download(`/attachments/${attachment.id}/download`, attachment.originalName)
                                .catch(() => toast.error("下载失败"))
                            }}
                            className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs hover:bg-accent"
                          >
                            <Download className="size-3 text-muted-foreground" />
                            <span className="max-w-[240px] truncate">{attachment.originalName}</span>
                            <span className="text-muted-foreground">({formatFileSize(attachment.fileSize)})</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 输入框 */}
        <div className="border-t border-border p-3">
          {mentioned.size > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {users.filter((u) => mentioned.has(u.id)).map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1">
                  <UserAvatar name={u.displayName} color={u.avatarColor} className="size-4 text-[9px]" />
                  @{u.displayName}
                  <button className="rounded-full hover:text-destructive" onClick={() => toggleMention(u)} aria-label={`移除 ${u.displayName}`}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {pendingFiles.map((pending) => (
                <Badge key={pending.id} variant="secondary" className="gap-1">
                  <Paperclip className="size-3" />
                  <span className="max-w-[160px] truncate">{pending.file.name}</span>
                  <span className="text-muted-foreground">({formatFileSize(pending.file.size)})</span>
                  <button className="rounded-full hover:text-destructive" onClick={() => removePending(pending.id)} aria-label="移除文件">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {mentionOpen && (
            <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2">
              {mentionable.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">暂无可提及的用户</p>
              ) : (
                mentionable.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggleMention(u)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                      mentioned.has(u.id) ? "bg-accent/60" : ""
                    }`}
                  >
                    <UserAvatar name={u.displayName} color={u.avatarColor} className="size-5 text-[10px]" />
                    <span>{u.displayName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{u.role === "LEADER" ? "负责人" : "开发"}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
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
            <div className="flex flex-col gap-2">
              <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} title="附带附件">
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
              <Button size="icon" variant={mentionOpen ? "secondary" : "outline"} onClick={() => setMentionOpen((v) => !v)} title="提及人员">
                <AtSign className="size-4" />
              </Button>
              <Button size="icon" onClick={submit} disabled={saving || (!content.trim() && pendingFiles.length === 0)}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** 渲染评论内容，并把被 @ 提及人员的名字高亮。 */
function MentionText({ content, mentionIds, users }: { content: string; mentionIds?: string; users: User[] }) {
  const ids = (mentionIds || "").split(",").map((v) => Number(v)).filter((n) => Number.isFinite(n))
  const names = users.filter((u) => ids.includes(u.id)).map((u) => u.displayName).filter(Boolean)
  if (names.length === 0) return <>{content}</>
  const pattern = new RegExp(`(@${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|@")})`, "g")
  const parts = content.split(pattern)
  return (
    <>
      {parts.map((part, index) =>
        names.some((n) => part === `@${n}`)
          ? <span key={index} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{part}</span>
          : <span key={index}>{part}</span>,
      )}
    </>
  )
}
