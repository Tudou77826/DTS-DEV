import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Inbox, Loader2, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_META, formatDateTime } from "@/lib/labels"
import type { Issue, PageResult, Priority } from "@/lib/types"

const TABS = [
  { value: "all", label: "全部" },
  { value: "pending_locate", label: "待定位" },
  { value: "locating", label: "处理中" },
  { value: "need_info", label: "待补充信息" },
  { value: "pending_verify", label: "待验证" },
  { value: "overdue", label: "已超期" },
  { value: "done", label: "已完成" },
]

export function MyTasksPage() {
  const [tab, setTab] = useState("all")
  const [data, setData] = useState<PageResult<Issue>>({ list: [], total: 0, page: 0, size: 20, totalPages: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<PageResult<Issue>>(`/issues/my-tasks?tab=${tab}&size=50`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <>
      <PageHeader title="我的任务" subtitle="分配给你的待处理问题" />
      <PageBody className="space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.value === "overdue" && <AlertTriangle className="size-3.5" />}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" />加载中…
              </div>
            ) : data.list.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center text-sm text-muted-foreground">
                <Inbox className="mb-2 size-8 opacity-40" />
                该分类下暂无任务
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.list.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
                        {issue.overdue && (
                          <Badge variant="destructive" className="gap-1 py-0 text-[10px]">
                            <AlertTriangle className="size-2.5" /> 超期
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">{issue.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {issue.moduleName} · {formatDateTime(issue.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className={PRIORITY_META[issue.priority as Priority]?.className}>
                      {PRIORITY_META[issue.priority as Priority]?.label}
                    </Badge>
                    <StatusBadge status={issue.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
