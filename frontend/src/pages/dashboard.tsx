import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Inbox, Clock, AlertTriangle, CheckCircle2, Users, FileWarning } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/store/auth"
import type { Issue, IssueStatus } from "@/lib/types"
import { StatusBadge } from "@/components/status-badge"
import { formatDateTime } from "@/lib/labels"

interface MySummary { pending: number; todayNew: number; overdue: number }
interface Overview {
  total: number; todayNew: number; resolved: number; unclosed: number
  unassigned: number; overdue: number
  statusDist: Record<string, number>
}

export function DashboardPage() {
  const { user } = useAuth()
  const isLeader = user?.role === "LEADER" || user?.role === "ADMIN"
  const [my, setMy] = useState<MySummary>({ pending: 0, todayNew: 0, overdue: 0 })
  const [overview, setOverview] = useState<Overview | null>(null)
  const [recent, setRecent] = useState<Issue[]>([])

  useEffect(() => {
    api.get<MySummary>("/issues/my-summary").then(setMy)
    if (isLeader) {
      api.get<Overview>("/stats/overview").then(setOverview)
      api.get<{ list: Issue[] }>("/issues?size=8").then((r) => setRecent(r.list))
    } else {
      api.get<{ list: Issue[] }>("/issues/my-tasks?tab=all&size=8").then((r) => setRecent(r.list))
    }
  }, [isLeader])

  const stats = isLeader && overview
    ? [
        { label: "问题总数", value: overview.total, icon: Inbox, color: "#3b82f6" },
        { label: "未关闭", value: overview.unclosed, icon: Clock, color: "#f59e0b" },
        { label: "未分配", value: overview.unassigned, icon: Users, color: "#8b5cf6" },
        { label: "超期问题", value: overview.overdue, icon: AlertTriangle, color: "#ef4444" },
      ]
    : [
        { label: "我的待办", value: my.pending, icon: Inbox, color: "#3b82f6" },
        { label: "今日新增", value: my.todayNew, icon: Clock, color: "#10b981" },
        { label: "已超期", value: my.overdue, icon: AlertTriangle, color: "#ef4444" },
        { label: "已解决", value: overview?.resolved ?? 0, icon: CheckCircle2, color: "#15803d" },
      ]

  return (
    <>
      <PageHeader
        title={isLeader ? "项目负责人工作台" : "我的工作台"}
        subtitle={isLeader ? "团队任务负载与版本遗留总览" : "查看你的待处理任务"}
      />
      <PageBody className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${s.color}1a` }}
                >
                  <s.icon className="size-5" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 负责人：状态分布 + 长期未更新；开发：快捷入口 */}
        {isLeader && overview ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <h3 className="mb-4 text-sm font-semibold">问题状态分布</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(overview.statusDist).map(([status, count]) => (
                    <Link
                      key={status}
                      to={`/issues?status=${status}`}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent"
                    >
                      <StatusBadge status={status as IssueStatus} />
                      <span className="text-lg font-semibold tabular-nums">{count}</span>
                    </Link>
                  ))}
                  {Object.keys(overview.statusDist).length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无数据</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex h-full flex-col p-5">
                <h3 className="mb-4 text-sm font-semibold">快捷操作</h3>
                <div className="flex flex-col gap-2">
                  <Link to="/issues?status=PENDING_ASSIGN" className="text-sm text-blue-600 hover:underline">
                    → 处理未分配问题（{overview.unassigned}）
                  </Link>
                  <Link to="/issues?overdue=1" className="text-sm text-red-600 hover:underline">
                    → 查看超期问题（{overview.overdue}）
                  </Link>
                  <Link to="/investigations" className="text-sm text-violet-600 hover:underline">
                    → 版本排查进度
                  </Link>
                  <Link to="/stats" className="text-sm text-muted-foreground hover:underline">
                    → 统计看板
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <FileWarning className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                在「我的任务」中查看待定位、处理中、待补充信息和超期任务。
              </p>
              <Link to="/my-tasks" className="ml-auto text-sm text-blue-600 hover:underline">
                前往 →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* 最近问题 */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">{isLeader ? "最近创建的问题" : "我最近的任务"}</h3>
            </div>
            <div className="divide-y divide-border">
              {recent.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无数据</div>
              )}
              {recent.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
                  <span className="flex-1 truncate text-sm">{issue.description}</span>
                  <StatusBadge status={issue.status} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatDateTime(issue.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
