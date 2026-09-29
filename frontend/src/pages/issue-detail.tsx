import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom"
import { ArrowLeft, Loader2, Pencil, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IssueMeta } from "@/components/issue/issue-meta"
import { IssueActions } from "@/components/issue/issue-actions"
import { ProgressTimeline } from "@/components/issue/progress-timeline"
import { CommentList } from "@/components/issue/comment-list"
import { TimelineDrawer } from "@/components/issue/timeline-drawer"
import { AttachmentPanel } from "@/components/issue/attachment-panel"
import { RelationPanel } from "@/components/issue/relation-panel"
import { AiLocationPanel, AiLocationIndicator } from "@/components/issue/ai-location-panel"
import { IssueFlowDiagram } from "@/components/issue/issue-flow-diagram"
import { FoldWhenEmpty } from "@/components/issue/fold-when-empty"
import type { FlowStation } from "@/components/issue/issue-flow-spine"
import { formatShortDateTime } from "@/lib/labels"
import { Badge } from "@/components/ui/badge"
import type {
  Issue, IssueProgress, Comment, OperationLog,
  IssueAttachment, IssueRelation,
} from "@/lib/types"
import { useCustomization } from "@/store/customization"



/** 主功能区三个 Tab 对应三种职能：提出（测试/提出人）、处理（开发）、AI 辅助 */
type FlowTab = "raised" | "handling" | "ai"

/** 旧版 7 Tab 的 key 兼容映射，老链接不失效 */
const LEGACY_TAB_MAP: Record<string, FlowTab> = {
  info: "raised",
  attachments: "raised",
  relations: "raised",
  progress: "handling",
  "ai-location": "ai",
  comments: "raised",
  timeline: "raised",
}

function resolveTab(searchParams: URLSearchParams): FlowTab {
  if (searchParams.has("aiQuestion")) return "ai"
  const tab = searchParams.get("tab")
  if (tab && (["raised", "handling", "ai"] as const).includes(tab as FlowTab)) return tab as FlowTab
  if (tab && LEGACY_TAB_MAP[tab]) return LEGACY_TAB_MAP[tab]
  return "raised"
}

/** 流程图节点 → 下方职能 Tab：提出看提出区，AI 看 AI 区，其余人工节点看处理区。 */
function stationTarget(station: FlowStation): { tab: FlowTab; title: string } {
  if (station.kind === "ai") return { tab: "ai", title: "查看 AI 辅助处理" }
  if (station.kind === "handler" || station.id !== "raised") {
    return { tab: "handling", title: "查看问题处理" }
  }
  return { tab: "raised", title: "查看问题提出" }
}

export function IssueDetailPage() {
  const [searchParams] = useSearchParams()
  const { id } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [progress, setProgress] = useState<IssueProgress[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [ops, setOps] = useState<OperationLog[]>([])
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const [relations, setRelations] = useState<IssueRelation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FlowTab>(() => resolveTab(searchParams))
  const customization = useCustomization((state) => state.value)
  const attachmentsEnabled = customization?.features.attachments !== false
  const relationsEnabled = customization?.features.relations !== false

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [i, p, c, o, files, links] = await Promise.all([
        api.get<Issue>(`/issues/${id}`),
        api.get<IssueProgress[]>(`/issues/${id}/progress`),
        api.get<Comment[]>(`/issues/${id}/comments`),
        api.get<OperationLog[]>(`/issues/${id}/operations`),
        attachmentsEnabled ? api.get<IssueAttachment[]>(`/issues/${id}/attachments`) : Promise.resolve([]),
        relationsEnabled ? api.get<IssueRelation[]>(`/issues/${id}/relations`) : Promise.resolve([]),
      ])
      setIssue(i); setProgress(p); setComments(c); setOps(o)
      setAttachments(files); setRelations(links)
    } finally {
      setLoading(false)
    }
  }, [id, attachmentsEnabled, relationsEnabled])

  useEffect(() => { load() }, [load])

  // 标题栏下沿：时间线抽屉与把手的锚点。页面拥有布局知识，量好再传给抽屉。
  const [headerBottom, setHeaderBottom] = useState(84)
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("main > div.flex.items-center.justify-between")
      if (header) setHeaderBottom(Math.round(header.getBoundingClientRect().bottom))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

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
          {/* 左侧主体：流程图 + 三个职能分区（min-w-0 允许内部横向滚动，不撑破网格） */}
          <div className="min-w-0 space-y-4 lg:col-span-2">
            {/* 流程图（替代原概览条，原状态信息并入卡片头；点节点切下方职能分区） */}
            <IssueFlowDiagram
              issue={issue}
              ops={ops}
              onStationClick={(station) => setActiveTab(stationTarget(station).tab)}
              stationTitle={(station) => stationTarget(station).title}
            />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FlowTab)}>
              <TabsList>
                <TabsTrigger value="raised">问题提出</TabsTrigger>
                <TabsTrigger value="handling">问题处理 ({progress.length})</TabsTrigger>
                <TabsTrigger value="ai">
                  <Sparkles className="size-3.5 text-teal-700 dark:text-teal-400" />AI 辅助
                  <AiLocationIndicator issueId={issue.id} />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="raised" className="mt-4 space-y-4">
                <IssueMeta issue={issue} />
                {attachmentsEnabled && (
                  <FoldWhenEmpty title="附件" count={attachments.length} hint="截图、日志与复现材料">
                    <AttachmentPanel issueId={issue.id} items={attachments} onChanged={load} />
                  </FoldWhenEmpty>
                )}
                {relationsEnabled && (
                  <FoldWhenEmpty title="问题关联" count={relations.length} hint="标记相关问题或重复问题">
                    <RelationPanel issueId={issue.id} items={relations} onChanged={load} />
                  </FoldWhenEmpty>
                )}
              </TabsContent>
              <TabsContent value="handling" className="mt-4">
                <ProgressTimeline issueId={issue.id} items={progress} onChanged={load} />
              </TabsContent>
              <TabsContent value="ai" className="mt-4">
                <AiLocationPanel issue={issue} />
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧侧栏：Issue 级信息（不属于任何职能分区） */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <MetaCell label="提出人" value={issue.submitterName} />
                  <MetaCell label="工号" value={issue.submitterNo} />
                  <MetaCell label="提出" value={formatShortDateTime(issue.raisedAt)} />
                  <MetaCell label="期望解决" value={formatShortDateTime(issue.expectedFinishAt)} />
                  <MetaCell
                    label="模块"
                    value={[issue.moduleName, issue.subModule].filter(Boolean).join(" / ") || null}
                    wide
                  />
                  <MetaCell label="来源产品" value={issue.productName} />
                  <MetaCell label="问题领域" value={issue.domainName} />
                  <MetaCell label="发现版本" value={issue.foundVersionName} />
                  <MetaCell label="DTS 单号" value={issue.dtsTicketNo} />
                  <MetaCell label="标注" value={issue.issueFlag ? (issue.issueFlag === "PROBLEM" ? "是问题" : "非问题") : null} />
                  <MetaCell label="计划完成" value={formatShortDateTime(issue.planFinishAt)} />
                  <MetaCell label="开始定位" value={formatShortDateTime(issue.locatedAt)} />
                  <MetaCell label="解决" value={formatShortDateTime(issue.resolvedAt)} />
                  <MetaCell label="关闭" value={formatShortDateTime(issue.closedAt)} />
                  <MetaCell label="最后更新" value={formatShortDateTime(issue.updatedAt)} />
                </div>
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

            <CommentList issueId={issue.id} items={comments} onChanged={load} />
          </div>
        </div>
        {/* 操作时间线：屏幕右缘收纳式抽屉，不占版面流 */}
        <TimelineDrawer items={ops} topOffset={headerBottom} />
      </PageBody>
    </>
  )
}

/** 侧栏属性的小单元格：标签在上、值在下；空值不渲染（不出现「-」行）。 */
function MetaCell({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value || value === "-") return null
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[10px] leading-none text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs font-medium" title={value}>{value}</div>
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
