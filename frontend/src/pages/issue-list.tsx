import { useEffect, useState, useCallback } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, Download, Users, Archive, X,
} from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
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
  const navigate = useNavigate()
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
  const productName = searchParams.get("productName") || ""
  const assigneeId = searchParams.get("assigneeId") || ""
  const foundVersionName = searchParams.get("foundVersionName") || ""
  const domainId = searchParams.get("domainId") || ""
  const submitterId = searchParams.get("submitterId") || ""
  const createdFrom = searchParams.get("createdFrom") || ""
  const createdTo = searchParams.get("createdTo") || ""
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
      if (productName) params.set("productName", productName)
      if (assigneeId) params.set("assigneeId", assigneeId)
      if (foundVersionName) params.set("foundVersionName", foundVersionName)
      if (domainId) params.set("domainId", domainId)
      if (submitterId) params.set("submitterId", submitterId)
      if (createdFrom) params.set("createdFrom", `${createdFrom}T00:00:00`)
      if (createdTo) params.set("createdTo", `${createdTo}T23:59:59`)
      if (overdueOnly) params.set("overdue", "1")
      const result = await api.get<PageResult<Issue>>(`/issues?${params.toString()}`)
      setData(result)
      setSelected([])
    } finally {
      setLoading(false)
    }
  }, [keyword, status, moduleId, productName, assigneeId, foundVersionName,
    domainId, submitterId, createdFrom, createdTo, page, overdueOnly])

  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])
  useEffect(() => { load() }, [load])

  const reset = () => setSearchParams({}, { replace: true })

  const filterParams = () => {
    const params = new URLSearchParams()
    if (keyword) params.set("keyword", keyword)
    if (status) params.set("status", status)
    if (moduleId) params.set("moduleId", moduleId)
    if (productName) params.set("productName", productName)
    if (assigneeId) params.set("assigneeId", assigneeId)
    if (foundVersionName) params.set("foundVersionName", foundVersionName)
    if (domainId) params.set("domainId", domainId)
    if (submitterId) params.set("submitterId", submitterId)
    if (createdFrom) params.set("createdFrom", `${createdFrom}T00:00:00`)
    if (createdTo) params.set("createdTo", `${createdTo}T23:59:59`)
    if (overdueOnly) params.set("overdue", "1")
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
            <div className="min-w-[200px] flex-1">
              <Combobox
                value={productName}
                onChange={(value) => update({ productName: value, page: null })}
                options={(dict?.products || []).map((p) => ({ value: p.name, label: p.name }))}
                placeholder="产品名称"
              />
            </div>
            <Select value={moduleId} onValueChange={(v) => update({ moduleId: v === "ALL" ? "" : v, page: null })}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="模块" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部模块</SelectItem>
                {dict?.modules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={foundVersionName || "ALL"} onValueChange={(v) => update({ foundVersionName: v === "ALL" ? "" : v, page: null })}>
              <SelectTrigger className="w-[155px]"><SelectValue placeholder="发现版本" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部版本</SelectItem>
                {dict?.versions.map((v) => <SelectItem key={v.id} value={v.version}>{v.version}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="w-[150px]">
              <SearchableSelect
                value={assigneeId}
                onChange={(v) => update({ assigneeId: v, page: null })}
                options={[
                  { value: "", label: "全部责任人" },
                  ...(dict?.developers || []).map((u) => ({ value: String(u.id), label: u.displayName })),
                ]}
                placeholder="责任人"
                searchPlaceholder="搜索责任人…"
              />
            </div>
            <div className="w-[150px]">
              <SearchableSelect
                value={domainId}
                onChange={(v) => update({ domainId: v, page: null })}
                options={[
                  { value: "", label: "全部领域" },
                  ...(dict?.domains || []).map((d) => ({ value: String(d.id), label: d.name })),
                ]}
                placeholder="问题领域"
                searchPlaceholder="搜索领域…"
              />
            </div>
            <div className="w-[150px]">
              <SearchableSelect
                value={submitterId}
                onChange={(v) => update({ submitterId: v, page: null })}
                options={[
                  { value: "", label: "全部提出人" },
                  ...(dict?.users || []).map((u) => ({ value: String(u.id), label: u.displayName })),
                ]}
                placeholder="提出人"
                searchPlaceholder="搜索提出人…"
              />
            </div>
            <Input
              type="date"
              className="w-[140px]"
              value={createdFrom}
              onChange={(event) => update({ createdFrom: event.target.value, page: null })}
              title="创建时间（起）"
            />
            <Input
              type="date"
              className="w-[140px]"
              value={createdTo}
              onChange={(event) => update({ createdTo: event.target.value, page: null })}
              title="创建时间（止）"
            />
            <Button
              variant={overdueOnly ? "default" : "outline"}
              size="sm"
              onClick={() => update({ overdue: overdueOnly ? "" : "1", page: null })}
            >
              <AlertTriangle className="size-4" /> 超期
            </Button>
            <Button variant="outline" size="icon" onClick={reset} title="重置">
              <RotateCcw className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {batchEnabled && selected.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="mr-auto text-sm font-medium">已选择 {selected.length} 项</span>
            {user?.role === "LEADER" && (
              <>
                <Button size="sm" onClick={() => setAssignOpen(true)}><Users className="size-4" /> 批量指派</Button>
                <Button size="sm" variant="outline" onClick={batchClose}><Archive className="size-4" /> 批量关闭</Button>
              </>
            )}
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    {batchEnabled && (
                      <TableHead className="w-10">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="选择当前页全部问题"
                          className="size-4 rounded border-border accent-primary" />
                      </TableHead>
                    )}
                    <TableHead className="w-[150px]">编号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-[130px]">所属模块</TableHead>
                    <TableHead className="w-[140px]">来源产品</TableHead>
                    <TableHead className="w-[140px]">发现版本</TableHead>
                    <TableHead className="w-[90px]">优先级</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[110px]">责任人</TableHead>
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
                      {batchEnabled && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(issue.id)} onChange={() => toggleOne(issue.id)}
                            aria-label={`选择 ${issue.code}`} className="size-4 rounded border-border accent-primary" />
                        </TableCell>
                      )}
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
                      <TableCell><StatusBadge status={issue.status as IssueStatus} /></TableCell>
                      <TableCell>
                        {issue.assigneeName ? (
                          <div className="flex items-center gap-1.5">
                            <UserAvatar name={issue.assigneeName} color={issue.assigneeColor} className="size-6" />
                            <span className="truncate text-xs">{issue.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未分配</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(issue.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
  const [collaboratorIds, setCollaboratorIds] = useState<number[]>([])
  const [priority, setPriority] = useState("")
  const [planFinishAt, setPlanFinishAt] = useState("")
  const [saving, setSaving] = useState(false)

  const toggleCollaborator = (id: number) => {
    setCollaboratorIds((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id])
  }

  const submit = async () => {
    if (!assigneeId) return toast.error("请选择责任人")
    setSaving(true)
    try {
      const result = await api.post<BatchResult>("/issues/batch/assign", {
        issueIds,
        assigneeId: Number(assigneeId),
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
        priority: priority || undefined,
        planFinishAt: planFinishAt ? new Date(planFinishAt).toISOString() : undefined,
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

  const collaboratorOptions = dict?.developers.filter((u) => String(u.id) !== assigneeId) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量指派 {issueIds.length} 个问题</DialogTitle>
          <DialogDescription>统一设置责任人、协同人与优先级；待分配问题会自动进入待定位。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="flex flex-col gap-2">
            <Label>责任人</Label>
            <SearchableSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={(dict?.developers || []).map((d) => ({ value: String(d.id), label: d.displayName }))}
              placeholder="选择开发人员"
              searchPlaceholder="搜索责任人…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>协同处理人（可多选，可选）</Label>
            {collaboratorIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {collaboratorIds.map((id) => {
                  const u = collaboratorOptions.find((c) => c.id === id)
                  if (!u) return null
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {u.displayName}
                      <button className="rounded-full hover:text-destructive" onClick={() => toggleCollaborator(id)} aria-label={`移除 ${u.displayName}`}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
            <SearchableSelect
              value=""
              onChange={(v) => { if (v) toggleCollaborator(Number(v)) }}
              options={collaboratorOptions
                .filter((u) => !collaboratorIds.includes(u.id))
                .map((u) => ({ value: String(u.id), label: u.displayName }))}
              placeholder="添加协同人…"
              searchPlaceholder="搜索协同人…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>优先级（可选）</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="保持原有" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>计划完成时间（可选）</Label>
            <Input type="datetime-local" value={planFinishAt} onChange={(e) => setPlanFinishAt(e.target.value)} />
          </div>
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
