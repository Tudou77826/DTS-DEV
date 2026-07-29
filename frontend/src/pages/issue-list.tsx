import { useEffect, useState, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { PRIORITY_META, STATUS_META, formatDateTime } from "@/lib/labels"
import type { Dictionaries, Issue, IssueStatus, PageResult, Priority } from "@/lib/types"

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))

export function IssueListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [data, setData] = useState<PageResult<Issue>>({ list: [], total: 0, page: 1, size: 20, totalPages: 0 })
  const [loading, setLoading] = useState(false)

  // 筛选条件
  const keyword = searchParams.get("keyword") || ""
  const status = searchParams.get("status") || ""
  const moduleId = searchParams.get("moduleId") || ""
  const productId = searchParams.get("productId") || ""
  const assigneeId = searchParams.get("assigneeId") || ""
  const foundVersionId = searchParams.get("foundVersionId") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const overdueOnly = searchParams.get("overdue") === "1"

  const update = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    })
    if (!patch.page) next.delete("page")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" })
      if (keyword) params.set("keyword", keyword)
      if (status) params.set("status", status)
      if (moduleId) params.set("moduleId", moduleId)
      if (productId) params.set("productId", productId)
      if (assigneeId) params.set("assigneeId", assigneeId)
      if (foundVersionId) params.set("foundVersionId", foundVersionId)
      const result = await api.get<PageResult<Issue>>(`/issues?${params.toString()}`)
      let list = result.list
      if (overdueOnly) list = list.filter((i) => i.overdue)
      setData({ ...result, list })
    } finally {
      setLoading(false)
    }
  }, [keyword, status, moduleId, productId, assigneeId, foundVersionId, page, overdueOnly])

  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])
  useEffect(() => { load() }, [load])

  const reset = () => setSearchParams({}, { replace: true })

  return (
    <>
      <PageHeader title="问题列表" subtitle={`共 ${data.total} 个问题`} />
      <PageBody className="space-y-4">
        {/* 筛选栏 */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索编号、描述或关键字…"
                className="pl-8"
                value={keyword}
                onChange={(e) => update({ keyword: e.target.value, page: null })}
              />
            </div>
            <Select value={status} onValueChange={(v) => update({ status: v === "ALL" ? "" : v, page: null })}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productId} onValueChange={(v) => update({ productId: v === "ALL" ? "" : v, moduleId: null, page: null })}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="产品" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部产品</SelectItem>
                {dict?.products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={moduleId} onValueChange={(v) => update({ moduleId: v === "ALL" ? "" : v, page: null })}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="模块" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部模块</SelectItem>
                {dict?.modules
                  .filter((m) => !productId || m.productId === Number(productId))
                  .map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeId} onValueChange={(v) => update({ assigneeId: v === "ALL" ? "" : v, page: null })}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="责任人" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部责任人</SelectItem>
                {dict?.users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={reset} title="重置">
              <RotateCcw className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* 列表 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">加载中…</div>
            ) : data.list.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">没有匹配的问题</div>
            ) : (
              <div className="divide-y divide-border">
                {data.list.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="block px-5 py-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
                          {issue.overdue && (
                            <Badge variant="destructive" className="gap-1 py-0 text-[10px]">
                              <AlertTriangle className="size-2.5" /> 超期
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">{issue.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {issue.moduleName && <span>{issue.moduleName}</span>}
                          {issue.productName && <span>· {issue.productName}</span>}
                          {issue.foundVersionName && <span>· {issue.foundVersionName}</span>}
                          <span>· {formatDateTime(issue.createdAt)}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className={PRIORITY_META[issue.priority as Priority]?.className}>
                        {PRIORITY_META[issue.priority as Priority]?.label}
                      </Badge>
                      <StatusBadge status={issue.status as IssueStatus} />
                      <div className="flex w-24 items-center justify-end gap-1.5">
                        {issue.assigneeName ? (
                          <>
                            <UserAvatar name={issue.assigneeName} color={issue.assigneeColor} className="size-6" />
                            <span className="hidden text-xs lg:inline">{issue.assigneeName}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">未分配</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* 分页 */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  第 {data.page + 1} / {data.totalPages} 页，共 {data.total} 条
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" disabled={page <= 1}
                    onClick={() => update({ page: String(page - 1) })}
                  >
                    <ChevronLeft className="size-4" /> 上一页
                  </Button>
                  <Button
                    variant="outline" size="sm" disabled={page >= data.totalPages}
                    onClick={() => update({ page: String(page + 1) })}
                  >
                    下一页 <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
