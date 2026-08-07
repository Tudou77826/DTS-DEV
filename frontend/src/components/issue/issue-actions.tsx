import { useEffect, useState } from "react"
import { UserCog, GitPullRequestArrow, UsersRound, X } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Dictionaries, Issue, IssueStatus } from "@/lib/types"
import { useCustomization } from "@/store/customization"
import { STATUS_META, PRIORITY_META } from "@/lib/labels"
import { useAuth } from "@/store/auth"

export function IssueActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const user = useAuth((state) => state.user)
  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])

  const customization = useCustomization((state) => state.value)
  const canAssign = user?.role === "LEADER"
  const isAdmin = useAuth((state) => state.isAdminActive())
  const nextStatuses = (customization?.issue.transitions[issue.status] || []).filter((status) => {
    if (status === "CLOSED") {
      return isAdmin || user?.id === issue.submitterId
    }
    // 从已解决/已关闭回退处理中（重新打开）：提出人，管理员可越权
    if (status === "PROCESSING" && ["RESOLVED", "CLOSED"].includes(issue.status)) {
      return isAdmin || user?.id === issue.submitterId
    }
    return isAdmin || user?.id === issue.assigneeId
  })

  return (
    <div className="flex items-center gap-2">
      {canAssign && <AssignDialog issue={issue} dict={dict} onChanged={onChanged} />}

      {nextStatuses.length > 0 && (
        <StatusDialog issue={issue} nextStatuses={nextStatuses} onChanged={onChanged} />
      )}
    </div>
  )
}

function AssignDialog({ issue, dict, onChanged }: { issue: Issue; dict: Dictionaries | null; onChanged: () => void }) {
  const [assigneeId, setAssigneeId] = useState(issue.assigneeId ? String(issue.assigneeId) : "")
  const [priority, setPriority] = useState(issue.priority)
  const [planFinishAt, setPlanFinishAt] = useState("")
  const [collaboratorIds, setCollaboratorIds] = useState<number[]>(issue.collaboratorIds || [])
  const [saving, setSaving] = useState(false)

  const toggleCollaborator = (id: number) => {
    setCollaboratorIds((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id])
  }

  const submit = async () => {
    setSaving(true)
    try {
      await api.post(`/issues/${issue.id}/assign`, {
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        priority,
        planFinishAt: planFinishAt ? new Date(planFinishAt).toISOString() : undefined,
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
      })
      toast.success("已分配")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  const collaboratorOptions = dict?.developers.filter((u) => String(u.id) !== assigneeId) || []

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserCog className="size-4" /> 分配/调整</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分配责任人与优先级</DialogTitle>
          <DialogDescription>设置问题定位人、协同人、优先级和计划完成时间</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>责任人</Label>
            <SearchableSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={(dict?.developers || []).map((u) => ({ value: String(u.id), label: u.displayName }))}
              placeholder="选择开发人员"
              searchPlaceholder="搜索责任人…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>协同处理人（可多选）</Label>
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
            <Label>优先级</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Issue["priority"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>计划完成时间</Label>
            <Input type="datetime-local" value={planFinishAt} onChange={(e) => setPlanFinishAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>{saving && "处理中…"}保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusDialog({ issue, nextStatuses, onChanged }: {
  issue: Issue; nextStatuses: IssueStatus[]; onChanged: () => void
}) {
  const [status, setStatus] = useState("")
  const [remark, setRemark] = useState("")
  const [issueFlag, setIssueFlag] = useState("")
  const [dtsTicketNo, setDtsTicketNo] = useState(issue.dtsTicketNo || "")
  const [resolution, setResolution] = useState("")
  const [saving, setSaving] = useState(false)

  const isResolving = status === "RESOLVED"
  const isClosing = status === "CLOSED"
  const needsFlag = isResolving || isClosing
  const flagIsProblem = issueFlag === "PROBLEM"
  const flagIsNonProblem = issueFlag === "NON_PROBLEM"

  const requirement = isResolving && !remark.trim()
    ? "转为已解决前必须填写处理描述。"
    : needsFlag && !issueFlag
      ? "请先标注该事项是系统问题还是非问题。"
      : isResolving && flagIsProblem && !dtsTicketNo.trim()
        ? "已标注为系统问题，请填写 DTS 系统问题单号。"
        : isResolving && flagIsNonProblem && !resolution.trim()
          ? "已标注为非问题，请填写处理结论。"
          : ""

  const canSubmit = Boolean(status) && !requirement

  const submit = async () => {
    if (!status) return toast.error("请选择状态")
    setSaving(true)
    try {
      await api.post(`/issues/${issue.id}/status`, {
        status,
        remark: isResolving ? remark : remark || undefined,
        issueFlag: needsFlag ? issueFlag : undefined,
        dtsTicketNo: flagIsProblem && dtsTicketNo.trim() ? dtsTicketNo.trim() : undefined,
        resolution: isResolving && flagIsNonProblem && resolution.trim() ? resolution.trim() : undefined,
      })
      toast.success(`已流转到「${STATUS_META[status as IssueStatus].label}」`)
      setStatus(""); setRemark(""); setIssueFlag(""); setDtsTicketNo(""); setResolution("")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><GitPullRequestArrow className="size-4" /> 流转状态</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>变更问题状态</DialogTitle>
          <DialogDescription>当前状态：{STATUS_META[issue.status].label}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>流转到</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); if (!["RESOLVED", "CLOSED"].includes(v)) setIssueFlag("") }}>
              <SelectTrigger><SelectValue placeholder="选择目标状态" /></SelectTrigger>
              <SelectContent>
                {nextStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isResolving && (
            <div className="flex flex-col gap-2">
              <Label>处理描述（必填）</Label>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="填写处理经过与结果"
                rows={3}
              />
            </div>
          )}

          {needsFlag && (
            <div className="flex flex-col gap-2">
              <Label>标注（必选）</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIssueFlag("PROBLEM")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    flagIsProblem ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-border hover:bg-accent"
                  )}
                >
                  是问题
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFlag("NON_PROBLEM")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    flagIsNonProblem ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:bg-accent"
                  )}
                >
                  非问题
                </button>
              </div>
            </div>
          )}

          {needsFlag && flagIsProblem && (
            <div className="flex flex-col gap-2">
              <Label>DTS 系统问题单号（必填）</Label>
              <Input
                value={dtsTicketNo}
                onChange={(e) => setDtsTicketNo(e.target.value)}
                placeholder="请填写 DTS 系统问题单号"
              />
            </div>
          )}

          {isResolving && flagIsNonProblem && (
            <div className="flex flex-col gap-2">
              <Label>处理结论（必填）</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="说明为何判定为非问题，例如：环境误报 / 用户操作问题"
                rows={2}
              />
            </div>
          )}

          {!isResolving && !needsFlag && (
            <div className="flex flex-col gap-2">
              <Label>进展说明（可选）</Label>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="补充说明本次状态变更" />
            </div>
          )}

          {requirement && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {requirement}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} disabled={saving || !canSubmit}>{saving && "处理中…"}确认流转</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
