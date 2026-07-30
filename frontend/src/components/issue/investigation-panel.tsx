import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import { INVESTIGATION_STATUS_META, formatDateTime } from "@/lib/labels"
import type { VersionInvestigation } from "@/lib/types"

const INVESTIGATION_STATUSES = Object.keys(INVESTIGATION_STATUS_META)

export function InvestigationPanel({
  issueId, items, onChanged,
}: {
  issueId: number; items: VersionInvestigation[]; onChanged: () => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-medium">各版本排查结果</span>
          <AddInvestigation issueId={issueId} onChanged={onChanged} />
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无版本排查记录</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((inv) => {
              const meta = INVESTIGATION_STATUS_META[inv.status] || { label: inv.status, className: "" }
              return (
                <div key={inv.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{inv.versionName}</span>
                    <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                    {inv.completedAt && (
                      <span className="text-xs text-muted-foreground">{formatDateTime(inv.completedAt)} 完成</span>
                    )}
                    <EditInvestigation inv={inv} onChanged={onChanged} />
                  </div>
                  {inv.result && (
                    <p className="mt-1 text-sm"><span className="text-muted-foreground">排查结果：</span>{inv.result}</p>
                  )}
                  {inv.handlingNote && (
                    <p className="mt-1 text-sm"><span className="text-muted-foreground">处理说明：</span>{inv.handlingNote}</p>
                  )}
                  {inv.verifyResult && (
                    <p className="mt-1 text-sm"><span className="text-muted-foreground">验证结果：</span>{inv.verifyResult}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddInvestigation({ issueId, onChanged }: { issueId: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [versionName, setVersionName] = useState("")
  const [status, setStatus] = useState("PENDING")
  const [result, setResult] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!versionName.trim()) return toast.error("请输入版本")
    setSaving(true)
    try {
      await api.post("/investigations", {
        issueId, versionName: versionName.trim(), status, result: result || undefined,
      })
      toast.success("已添加排查记录")
      setVersionName(""); setResult(""); setStatus("PENDING"); setOpen(false)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Plus className="size-4" /> 添加版本</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>添加版本排查记录</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>产品版本</Label>
            <Input value={versionName} onChange={(event) => setVersionName(event.target.value)}
              placeholder="输入需要排查的版本" maxLength={255} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>排查状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTIGATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{INVESTIGATION_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>排查结果</Label>
            <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>{saving && "处理中…"}添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditInvestigation({ inv, onChanged }: { inv: VersionInvestigation; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(inv.status)
  const [result, setResult] = useState(inv.result || "")
  const [handlingNote, setHandlingNote] = useState(inv.handlingNote || "")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await api.put(`/investigations/${inv.id}`, {
        issueId: inv.issueId, versionName: inv.versionName, status,
        result: result || undefined, handlingNote: handlingNote || undefined,
      })
      toast.success("已更新")
      setOpen(false)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs">编辑</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑排查记录</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>排查状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTIGATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{INVESTIGATION_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>排查结果</Label>
            <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>处理说明</Label>
            <Textarea value={handlingNote} onChange={(e) => setHandlingNote(e.target.value)} rows={3} />
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
