import { useEffect, useState } from "react"
import { UserCog, GitPullRequestArrow } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import type { Dictionaries, Issue, IssueStatus } from "@/lib/types"
import { STATUS_META, PRIORITY_META } from "@/lib/labels"

const NEXT_STATUS_FLOW: Record<string, IssueStatus[]> = {
  PENDING_ASSIGN: ["PENDING_LOCATE", "NEED_INFO"],
  PENDING_LOCATE: ["LOCATING", "NEED_INFO"],
  LOCATING: ["PENDING_VERIFY", "NEED_INFO", "CANNOT_REPRODUCE", "WONT_FIX", "DEFERRED"],
  PENDING_VERIFY: ["RESOLVED", "LOCATING"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  NEED_INFO: ["PENDING_LOCATE", "LOCATING"],
  DEFERRED: ["LOCATING"],
  CANNOT_REPRODUCE: ["LOCATING", "CLOSED"],
  WONT_FIX: ["CLOSED"],
  REOPENED: ["LOCATING"],
}

export function IssueActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])

  const nextStatuses = NEXT_STATUS_FLOW[issue.status] || []

  return (
    <div className="flex items-center gap-2">
      <AssignDialog issue={issue} dict={dict} onChanged={onChanged} />

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
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await api.post(`/issues/${issue.id}/assign`, {
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        priority,
        planFinishAt: planFinishAt ? new Date(planFinishAt).toISOString() : undefined,
      })
      toast.success("已分配")
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
        <Button variant="outline" size="sm"><UserCog className="size-4" /> 分配/调整</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分配责任人与优先级</DialogTitle>
          <DialogDescription>设置问题定位人、优先级和计划完成时间</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>责任人</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="选择开发人员" /></SelectTrigger>
              <SelectContent>
                {dict?.developers.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!status) return toast.error("请选择状态")
    setSaving(true)
    try {
      await api.post(`/issues/${issue.id}/status`, { status, remark: remark || undefined })
      toast.success(`已流转到「${STATUS_META[status as IssueStatus].label}」`)
      setStatus(""); setRemark("")
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="选择目标状态" /></SelectTrigger>
              <SelectContent>
                {nextStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>进展说明（可选）</Label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="补充说明本次状态变更" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>{saving && "处理中…"}确认流转</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
