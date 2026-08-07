import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { IssueMeta } from "@/components/issue/issue-meta"
import { IssueActions } from "@/components/issue/issue-actions"
import { ProgressTimeline } from "@/components/issue/progress-timeline"
import { InvestigationPanel } from "@/components/issue/investigation-panel"
import { CommentList } from "@/components/issue/comment-list"
import { OperationTimeline } from "@/components/issue/operation-timeline"
import { AttachmentPanel } from "@/components/issue/attachment-panel"
import { RelationPanel } from "@/components/issue/relation-panel"
import {
  PRIORITY_META, formatDateTime, formatDuration,
} from "@/lib/labels"
import type {
  Issue, IssueProgress, Comment, OperationLog, VersionInvestigation, Priority,
  IssueAttachment, IssueRelation,
} from "@/lib/types"
import { useCustomization } from "@/store/customization"

export function IssueDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [progress, setProgress] = useState<IssueProgress[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [ops, setOps] = useState<OperationLog[]>([])
  const [investigations, setInvestigations] = useState<VersionInvestigation[]>([])
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const [relations, setRelations] = useState<IssueRelation[]>([])
  const [loading, setLoading] = useState(true)
  const customization = useCustomization((state) => state.value)
  const investigationsEnabled = customization?.features.investigations !== false
  const attachmentsEnabled = customization?.features.attachments !== false
  const relationsEnabled = customization?.features.relations !== false

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [i, p, c, o, inv, files, links] = await Promise.all([
        api.get<Issue>(`/issues/${id}`),
        api.get<IssueProgress[]>(`/issues/${id}/progress`),
        api.get<Comment[]>(`/issues/${id}/comments`),
        api.get<OperationLog[]>(`/issues/${id}/operations`),
        investigationsEnabled ? api.get<VersionInvestigation[]>(`/investigations?issueId=${id}`) : Promise.resolve([]),
        attachmentsEnabled ? api.get<IssueAttachment[]>(`/issues/${id}/attachments`) : Promise.resolve([]),
        relationsEnabled ? api.get<IssueRelation[]>(`/issues/${id}/relations`) : Promise.resolve([]),
      ])
      setIssue(i); setProgress(p); setComments(c); setOps(o); setInvestigations(inv)
      setAttachments(files); setRelations(links)
    } finally {
      setLoading(false)
    }
  }, [id, investigationsEnabled, attachmentsEnabled, relationsEnabled])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <>
      <PageHeader title="" actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> 返回
        </Button>
      } />
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
      </div>
    </>
  )

  if (!issue) return <div className="p-6 text-sm text-muted-foreground">问题不存在</div>

  return (
    <>
      <PageHeader
        title={issue.title}
        subtitle={issue.code}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> 返回
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/issues/${issue.id}/edit`}>
                <Pencil className="size-4" /> 编辑
              </Link>
            </Button>
            <IssueActions issue={issue} onChanged={load} />
          </>
        }
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 左侧主体 */}
          <div className="space-y-4 lg:col-span-2">
            {/* 概览条 */}
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <StatusBadge status={issue.status} />
                <Badge variant="secondary" className={PRIORITY_META[issue.priority as Priority]?.className}>
                  {PRIORITY_META[issue.priority as Priority]?.label}优先级
                </Badge>
                {issue.overdue && <Badge variant="destructive">已超期</Badge>}
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">责任人</span>
                  {issue.assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar name={issue.assigneeName} color={issue.assigneeColor} className="size-5" />
                      <span>{issue.assigneeName}</span>
                    </div>
                  ) : <span className="text-muted-foreground">未分配</span>}
                </div>
                <Separator orientation="vertical" className="h-5" />
                <span className="text-sm text-muted-foreground">
                  定位时长 <span className="font-medium text-foreground">{formatDuration(issue.locateDurationMin)}</span>
                </span>
              </CardContent>
            </Card>

            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">基础信息</TabsTrigger>
                <TabsTrigger value="progress">处理记录 ({progress.length})</TabsTrigger>
                {investigationsEnabled && <TabsTrigger value="investigation">版本排查 ({investigations.length})</TabsTrigger>}
                <TabsTrigger value="comments">评论 ({comments.length})</TabsTrigger>
                {attachmentsEnabled && <TabsTrigger value="attachments">附件 ({attachments.length})</TabsTrigger>}
                {relationsEnabled && <TabsTrigger value="relations">关联 ({relations.length})</TabsTrigger>}
                <TabsTrigger value="timeline">操作时间线</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <IssueMeta issue={issue} />
              </TabsContent>
              <TabsContent value="progress" className="mt-4">
                <ProgressTimeline issueId={issue.id} items={progress} onChanged={load} />
              </TabsContent>
              {investigationsEnabled && <TabsContent value="investigation" className="mt-4">
                <InvestigationPanel issueId={issue.id} items={investigations} onChanged={load} />
              </TabsContent>}
              <TabsContent value="comments" className="mt-4">
                <CommentList issueId={issue.id} items={comments} onChanged={load} />
              </TabsContent>
              {attachmentsEnabled && <TabsContent value="attachments" className="mt-4">
                <AttachmentPanel issueId={issue.id} items={attachments} onChanged={load} />
              </TabsContent>}
              {relationsEnabled && <TabsContent value="relations" className="mt-4">
                <RelationPanel issueId={issue.id} items={relations} onChanged={load} />
              </TabsContent>}
              <TabsContent value="timeline" className="mt-4">
                <OperationTimeline items={ops} />
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧侧栏 */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <Row label="提出人" value={issue.submitterName || "-"} />
                <Row label="工号" value={issue.submitterNo || "-"} />
                <Row label="提出时间" value={formatDateTime(issue.raisedAt)} />
                <Row label="所属模块" value={issue.moduleName || "-"} />
                {issue.subModule && <Row label="子模块" value={issue.subModule} />}
                <Row label="来源产品" value={issue.productName || "-"} />
                <Row label="问题领域" value={issue.domainName || "-"} />
                <Row label="发现版本" value={issue.foundVersionName || "-"} />
                {issue.expectedFinishAt && <Row label="期望解决" value={formatDateTime(issue.expectedFinishAt)} />}
                {issue.dtsTicketNo && <Row label="DTS 单号" value={issue.dtsTicketNo} />}
                {issue.planFinishAt && <Row label="计划完成" value={formatDateTime(issue.planFinishAt)} />}
                {issue.locatedAt && <Row label="开始定位" value={formatDateTime(issue.locatedAt)} />}
                {issue.resolvedAt && <Row label="解决时间" value={formatDateTime(issue.resolvedAt)} />}
                {issue.closedAt && <Row label="关闭时间" value={formatDateTime(issue.closedAt)} />}
                <Row label="最后更新" value={formatDateTime(issue.updatedAt)} />
              </CardContent>
            </Card>

            {(issue.collaboratorNames?.length || issue.rootCause || issue.resolution || issue.workaround) && (
              <Card>
                <CardContent className="space-y-3 p-5 text-sm">
                  {issue.collaboratorNames && issue.collaboratorNames.length > 0 && (
                    <div>
                      <div className="mb-1 text-muted-foreground">协同处理人</div>
                      <div className="flex flex-wrap gap-1.5">
                        {issue.collaboratorNames.map((n, i) => <Badge key={i} variant="secondary">{n}</Badge>)}
                      </div>
                    </div>
                  )}
                  {issue.rootCause && <DetailBlock label="根本原因" content={issue.rootCause} />}
                  {issue.workaround && <DetailBlock label="临时规避方案" content={issue.workaround} />}
                  {issue.resolution && <DetailBlock label="处理结论" content={issue.resolution} />}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function DetailBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{content}</p>
    </div>
  )
}
