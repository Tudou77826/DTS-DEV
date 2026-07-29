import { useEffect, useState, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, Download, Users, Archive,
} from "lucide-react"
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
import type { BatchResult, Dictionaries, Issue, IssueStatus, PageResult, Priority } from "@/lib/types"
import { useAuth } from "@/store/auth"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))

export function IssueListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [data, setData] = useState<PageResult<Issue>>({ list: [], total: 0, page: 1, size: 20, totalPages: 0 })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const user = useAuth((state) => state.user)
  const features = dict?.customization.features
  const batchEnabled = features?.["batch-operations"] ?? features?.batchOperations ?? true
  const exportEnabled = features?.["excel-export"] ?? features?.excelExport ?? true

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
      setSelected([])
    } finally {
      setLoading(false)
    }
  }, [keyword, status, moduleId, productId, assigneeId, foundVersionId, page, overdueOnly])

  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])
  useEffect(() => { load() }, [load])

  const reset = () => setSearchParams({}, { replace: true })

  const filterParams = () => {
    const params = new URLSearchParams()
    if (keyword) params.set("keyword", keyword)
    if (status) params.set("status", status)
    if (moduleId) params.set("moduleId", moduleId)
    if (productId) params.set("productId", productId)
    if (assigneeId) params.set("assigneeId", assigneeId)
    if (foundVersionId) params.set("foundVersionId", foundVersionId)
    return params
  }

  const exportExcel = async () => {
    try {
      await api.download(`/issues/export?${filterParams().toString()}`, "问题列表.xlsx")
      toast.success("Excel 已导出")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败")
    }
  }

  const batchClose = async () => {
    if (!window.confirm(`确认关闭选中的 ${selected.length} 个问题？仅已解决且你有权限的问题会成功。`)) return
    try {
      const result = await api.post<BatchResult>("/issues/batch/close", {
        issueIds: selected,
        remark: "批量关闭",
      })
      showBatchResult(result, "批量关闭")
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量关闭失败")
    }
  }

  const allSelected = data.list.length > 0 && data.list.every((item) => selected.includes(item.id))
  const toggleAll = () => setSelected(allSelected ? [] : data.list.map((item) => item.id))
  const toggleOne = (id: number) => setSelected((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id])

  return (
    <>
      <PageHeader
        title="问题列表"
        subtitle={`共 ${data.total} 个问题`}
        actions={exportEnabled
          ? <Button variant="outline" size="sm" onClick={exportExcel}><Download className="size-4" /> 导出 Excel</Button>
          : undefined}
      />
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
                {dict?.developers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={reset} title="重置">
              <RotateCcw className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {batchEnabled && selected.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="mr-auto text-sm font-medium">已选择 {selected.length} 项</span>
            {(user?.role === "LEADER" || user?.role === "ADMIN") && (
              <Button size="sm" onClick={() => setAssignOpen(true)}><Users className="size-4" /> 批量指派</Button>
            )}
            <Button size="sm" variant="outline" onClick={batchClose}><Archive className="size-4" /> 批量关闭</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>取消选择</Button>
          </div>
        )}

        {/* 列表 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">加载中…</div>
            ) : data.list.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">没有匹配的问题</div>
            ) : (
              <div className="divide-y divide-border">
                {batchEnabled && <div className="flex items-center gap-3 bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="选择当前页全部问题"
                    className="size-4 rounded border-border accent-primary" />
                  <span>选择当前页全部问题</span>
                </div>}
                {data.list.map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50">
                    {batchEnabled && <input type="checkbox" checked={selected.includes(issue.id)} onChange={() => toggleOne(issue.id)}
                      aria-label={`选择 ${issue.code}`} className="size-4 shrink-0 rounded border-border accent-primary" />
                    }
                    <Link to={`/issues/${issue.id}`} className="min-w-0 flex-1">
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
                        <p className="mt-0.5 truncate text-sm font-medium">{issue.title}</p>
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
                  </div>
                ))}
              </div>
            )}

            {/* 分页 */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  第 {data.page} / {data.totalPages} 页，共 {data.total} 条
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
        <BatchAssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          issueIds={selected}
          dict={dict}
          onDone={() => { setAssignOpen(false); load() }}
        />
      </PageBody>
    </>
  )
}

function BatchAssignDialog({
  open,
  onOpenChange,
  issueIds,
  dict,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issueIds: number[]
  dict: Dictionaries | null
  onDone: () => void
}) {
  const [assigneeId, setAssigneeId] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!assigneeId) return toast.error("请选择责任人")
    setSaving(true)
    try {
      const result = await api.post<BatchResult>("/issues/batch/assign", {
        issueIds,
        assigneeId: Number(assigneeId),
        remark: "批量指派",
      })
      showBatchResult(result, "批量指派")
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量指派失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量指派 {issueIds.length} 个问题</DialogTitle>
          <DialogDescription>统一设置责任人；待分配问题会自动进入待定位。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>责任人</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger><SelectValue placeholder="选择开发人员" /></SelectTrigger>
            <SelectContent>
              {dict?.developers.map((developer) => (
                <SelectItem key={developer.id} value={String(developer.id)}>{developer.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "处理中…" : "确认指派"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function showBatchResult(result: BatchResult, action: string) {
  if (result.failed === 0) toast.success(`${action}成功，共 ${result.succeeded} 项`)
  else toast.warning(`${action}完成：成功 ${result.succeeded} 项，失败 ${result.failed} 项`, {
    description: result.errors.slice(0, 3).join("；"),
  })
}
