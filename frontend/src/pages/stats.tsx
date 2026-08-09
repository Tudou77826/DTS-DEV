import { useEffect, useState } from "react"
import { Inbox, Clock, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { STATUS_META } from "@/lib/labels"
import type { Dictionaries, IssueStatus } from "@/lib/types"

interface Overview {
  total: number; todayNew: number; resolved: number; unclosed: number
  unassigned: number; overdue: number
  statusDist: Record<string, number>
  moduleDist: Record<string, number>
  subModuleDist: Record<string, number>
  assigneePending: Record<string, number>
}

/** 状态机顺序（待分配 → 待处理 → 处理中 → 已解决 → 已关闭），统计展示按此固定排序 */
const STATUS_ORDER: IssueStatus[] = ["PENDING_ASSIGN", "PENDING_HANDLE", "PROCESSING", "RESOLVED", "CLOSED"]

export function StatsPage() {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [moduleId, setModuleId] = useState("")
  const [subModuleId, setSubModuleId] = useState("")
  const [ov, setOv] = useState<Overview | null>(null)

  useEffect(() => {
    api.get<Dictionaries>("/config/dictionaries").then(setDict).catch(() => undefined)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (moduleId) params.set("moduleId", moduleId)
    if (subModuleId) params.set("subModuleId", subModuleId)
    const qs = params.toString()
    api.get<Overview>(`/stats/overview${qs ? `?${qs}` : ""}`).then(setOv)
  }, [moduleId, subModuleId])

  if (!ov) return <PageBody><div className="text-sm text-muted-foreground">加载中…</div></PageBody>

  const cards = [
    { label: "问题总数", value: ov.total, icon: Inbox, color: "#3b82f6" },
    { label: "今日新增", value: ov.todayNew, icon: TrendingUp, color: "#10b981" },
    { label: "已解决/关闭", value: ov.resolved, icon: CheckCircle2, color: "#15803d" },
    { label: "未关闭", value: ov.unclosed, icon: Clock, color: "#f59e0b" },
    { label: "未分配", value: ov.unassigned, icon: Inbox, color: "#8b5cf6" },
    { label: "超期问题", value: ov.overdue, icon: AlertTriangle, color: "#ef4444" },
  ]

  const maxModule = Math.max(1, ...Object.values(ov.moduleDist))
  const maxDev = Math.max(1, ...Object.values(ov.assigneePending))

  return (
    <>
      <PageHeader title="统计看板" subtitle="问题基础统计与团队负载" />
      <PageBody className="space-y-4">
        {/* 筛选：模块 + 子模块 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">范围</span>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部模块" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部模块</SelectItem>
              {dict?.modules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subModuleId} onValueChange={setSubModuleId}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部子模块" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部子模块</SelectItem>
              {dict?.subModules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex flex-col items-center gap-2 p-4">
                <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}1a` }}>
                  <c.icon className="size-5" style={{ color: c.color }} />
                </div>
                <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 各状态 */}
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold">各状态问题数量</h3>
              <div className="space-y-2.5">
                {STATUS_ORDER
                  .filter((status) => (ov.statusDist[status] ?? 0) > 0)
                  .map((status) => {
                    const count = ov.statusDist[status] ?? 0
                    const meta = STATUS_META[status] || { label: status, dot: "#a1a1a1" }
                    const pct = (count / Math.max(1, ov.total)) * 100
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className="flex w-28 items-center gap-1.5 text-sm">
                          <span className="size-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                          {meta.label}
                        </div>
                        <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                          <div className="flex h-full items-center rounded px-2 text-[10px] font-medium text-white"
                            style={{ width: `${Math.max(8, pct)}%`, backgroundColor: meta.dot }}>
                            {count}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {STATUS_ORDER.every((status) => !(ov.statusDist[status] ?? 0)) && <p className="text-sm text-muted-foreground">暂无数据</p>}
              </div>
            </CardContent>
          </Card>

          {/* 各模块 */}
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold">各模块问题数量</h3>
              <div className="space-y-2.5">
                {Object.entries(ov.moduleDist).map(([mod, count]) => {
                  const pct = (count / maxModule) * 100
                  return (
                    <div key={mod} className="flex items-center gap-3">
                      <div className="w-24 truncate text-sm">{mod}</div>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="flex h-full items-center rounded bg-primary px-2 text-[10px] font-medium text-primary-foreground"
                          style={{ width: `${Math.max(8, pct)}%` }}>
                          {count}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(ov.moduleDist).length === 0 && <p className="text-sm text-muted-foreground">暂无数据</p>}
              </div>
            </CardContent>
          </Card>

          {/* 各子模块 */}
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold">各子模块问题数量</h3>
              <div className="space-y-2.5">
                {Object.entries(ov.subModuleDist).map(([mod, count]) => {
                  const pct = (count / maxModule) * 100
                  return (
                    <div key={mod} className="flex items-center gap-3">
                      <div className="w-24 truncate text-sm">{mod}</div>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="flex h-full items-center rounded bg-teal-500 px-2 text-[10px] font-medium text-white"
                          style={{ width: `${Math.max(8, pct)}%` }}>
                          {count}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(ov.subModuleDist).length === 0 && <p className="text-sm text-muted-foreground">暂无数据</p>}
              </div>
            </CardContent>
          </Card>

          {/* 开发人员待处理 */}
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold">各开发人员待处理问题数量</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {Object.entries(ov.assigneePending).map(([name, count]) => {
                  const pct = (count / maxDev) * 100
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-20 truncate text-sm">{name}</div>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="flex h-full items-center rounded bg-violet-500 px-2 text-[10px] font-medium text-white"
                          style={{ width: `${Math.max(8, pct)}%` }}>
                          {count}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(ov.assigneePending).length === 0 && <p className="text-sm text-muted-foreground">暂无数据</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  )
}
