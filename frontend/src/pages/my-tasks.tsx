import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Inbox, Loader2, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_META, formatDateTime } from "@/lib/labels"
import type { Issue, PageResult, Priority } from "@/lib/types"

const TABS = [
  { value: "all", label: "全部" },
  { value: "pending_assign", label: "待分配" },
  { value: "pending_handle", label: "待处理" },
  { value: "processing", label: "处理中" },
  { value: "overdue", label: "已超期" },
  { value: "done", label: "已完成" },
]

export function MyTasksPage() {
  const [tab, setTab] = useState("all")
  const [data, setData] = useState<PageResult<Issue>>({ list: [], total: 0, page: 0, size: 20, totalPages: 0 })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[150px]">编号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-[130px]">所属模块</TableHead>
                    <TableHead className="w-[140px]">来源产品</TableHead>
                    <TableHead className="w-[140px]">发现版本</TableHead>
                    <TableHead className="w-[90px]">优先级</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[150px]">创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.list.map((issue) => (
                    <TableRow
                      key={issue.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/issues/${issue.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
                          {issue.overdue && (
                            <Badge variant="destructive" className="gap-1 py-0 text-[10px]">
                              <AlertTriangle className="size-2.5" /> 超期
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/issues/${issue.id}`}
                          className="line-clamp-1 max-w-[320px] font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {issue.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{issue.moduleName || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{issue.productName || "-"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{issue.foundVersionName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={PRIORITY_META[issue.priority as Priority]?.className}>
                          {PRIORITY_META[issue.priority as Priority]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell><StatusBadge status={issue.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(issue.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
