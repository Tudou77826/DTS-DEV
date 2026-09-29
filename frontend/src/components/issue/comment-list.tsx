import { useEffect, useMemo, useRef, useState } from "react"
import { AtSign, Send, Loader2, Paperclip, Download } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { toast } from "sonner"
import { formatDateTime, formatFileSize } from "@/lib/labels"
import { useAuth } from "@/store/auth"
import { useUsers } from "@/hooks/use-users"
import type { Comment, IssueAttachment, User } from "@/lib/types"

export function CommentList({
  issueId, items, onChanged,
}: {
  issueId: number; items: Comment[]; onChanged: () => void
}) {
  const { user } = useAuth()
  const users = useUsers()
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  // @ 联想态：textarea 里最后一个未完结的 "@查询词"（start = @ 的下标）
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.get<IssueAttachment[]>(`/issues/${issueId}/attachments`)
      .then((list) => setAttachments(list.filter((a) => a.sourceType === "COMMENT")))
      .catch(() => setAttachments([]))
  }, [issueId])

  const authorName = (id: number) => users.find((u) => u.id === id)?.displayName || `用户${id}`
  const authorColor = (id: number) => users.find((u) => u.id === id)?.avatarColor

  const mentionable = useMemo(() => users.filter((u) => u.id !== user?.id), [users, user?.id])
  const mentionCandidates = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return mentionable
      .filter((u) =>
        q === "" ||
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [mention, mentionable])
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

  // 光标前的文本是否落在 "@查询词" 里：@ 需在行首或空白后（避免误伤邮箱）。
  const detectMention = (text: string, caret: number) => {
    const upto = text.slice(0, caret)
    const match = upto.match(/(^|\s)@([^\s@]*)$/)
    if (!match) return null
    return { start: caret - match[2].length - 1, query: match[2] }
  }

  const syncMention = (text: string, caret: number) => {
    setMention(detectMention(text, caret))
    setMentionIndex(0)
  }

  const selectMention = (u: User) => {
    if (!mention) return
    const el = textareaRef.current
    const caret = el ? el.selectionStart ?? mention.start + 1 : mention.start + 1
    const next = content.slice(0, mention.start) + `@${u.displayName} ` + content.slice(caret)
    setContent(next)
    setMention(null)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = mention.start + u.displayName.length + 2
      el?.setSelectionRange(pos, pos)
    })
  }

  // @ 按钮：在光标处补一个 "@"，让联想浮层接手。
  const insertMentionAt = () => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? content.length
    const next = content.slice(0, caret) + "@" + content.slice(caret)
    setContent(next)
    setMention({ start: caret, query: "" })
    setMentionIndex(0)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret + 1, caret + 1)
    })
  }


  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      const mentionIds = users
        .filter((u) => content.includes(`@${u.displayName}`))
        .map((u) => u.id)
      await api.post<Comment>(`/issues/${issueId}/comments`, {
        content,
        mentionIds: mentionIds.length > 0 ? mentionIds : undefined,
      })
      setContent("")
      setMention(null)
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
          {/* 侧栏窄容器：头像+输入一行，操作按钮横向排在输入框下方，避免竖排按钮把高度撑爆 */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <UserAvatar name={user?.displayName} color={user?.avatarColor} className="size-7 shrink-0" />
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    syncMention(e.target.value, e.target.selectionStart ?? e.target.value.length)
                  }}
                  placeholder="发表评论或补充信息…，@ 唤起提及"
                  rows={2}
                  className="min-h-[40px]"
                  onKeyDown={(e) => {
                    if (mention && mentionCandidates.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setMentionIndex((i) => (i + 1) % mentionCandidates.length)
                        return
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault()
                        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
                        return
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault()
                        selectMention(mentionCandidates[mentionIndex]!)
                        return
                      }
                      if (e.key === "Escape") {
                        setMention(null)
                        return
                      }
                    }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
                  }}
                />
                {mention && (
                  <div className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-md">
                    {mentionCandidates.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">无匹配用户</p>
                    ) : (
                      mentionCandidates.map((u, i) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectMention(u) }}
                          onMouseEnter={() => setMentionIndex(i)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                            i === mentionIndex ? "bg-accent" : "hover:bg-accent/60"
                          }`}
                        >
                          <UserAvatar name={u.displayName} color={u.avatarColor} className="size-5 text-[10px]" />
                          <span>{u.displayName}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 pl-9">
              <Button size="icon" variant="ghost" className="size-7" onClick={insertMentionAt} title="插入 @ 提及">
                <AtSign className="size-3.5" />
              </Button>
              <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">⌘/Ctrl+Enter 发送</span>
              <Button size="sm" className="h-7 px-2.5" onClick={submit} disabled={saving || !content.trim()}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                发送
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员", LEADER: "负责人", DEVELOPER: "开发", SUBMITTER: "提出人",
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
