import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { GitBranch, Wand2, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { INVESTIGATION_STATUS_META } from "@/lib/labels"
import type { Dictionaries, VersionInvestigation } from "@/lib/types"

export function InvestigationPage() {
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [versionName, setVersionName] = useState("")
  const [items, setItems] = useState<VersionInvestigation[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])

  useEffect(() => {
    if (!versionName.trim()) { setItems([]); return }
    setLoading(true)
    api.get<VersionInvestigation[]>(`/investigations?versionName=${encodeURIComponent(versionName.trim())}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [versionName, refreshKey])

  return (
    <>
      <PageHeader
        title="版本排查"
        subtitle="按版本查看待排查问题清单与排查进度"
        actions={<GenerateDialog dict={dict} defaultVersionName={versionName} onDone={() => setRefreshKey((value) => value + 1)} />}
      />
      <PageBody className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <GitBranch className="size-4 text-muted-foreground" />
            <Input
              className="w-[280px]"
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              placeholder="输入要排查的版本"
              maxLength={255}
            />
            {versionName.trim() && (
              <span className="text-sm text-muted-foreground">
                共 {items.length} 条排查记录，遗留 {items.filter((i) => i.status !== "NO_ISSUE" && i.status !== "FIXED").length} 条
              </span>
            )}
          </CardContent>
        </Card>

        {!versionName.trim() ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            请选择一个产品版本
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 size-5 animate-spin" />加载中…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            该版本暂无排查记录，可点击右上角「生成清单」批量创建
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {items.map((inv) => {
                  const meta = INVESTIGATION_STATUS_META[inv.status] || { label: inv.status, className: "" }
                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                      <Link to={`/issues/${inv.issueId}`} className="font-mono text-xs text-blue-600 hover:underline">
                        #{inv.issueId}
                      </Link>
                      <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                      {inv.result && <span className="flex-1 truncate text-sm text-muted-foreground">{inv.result}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">排查人 #{inv.investigatorId}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  )
}

function GenerateDialog({
  dict, defaultVersionName, onDone,
}: {
  dict: Dictionaries | null; defaultVersionName: string; onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [versionName, setVersionName] = useState(defaultVersionName)
  const [investigatorId, setInvestigatorId] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!versionName.trim()) return toast.error("请输入版本")
    setSaving(true)
    try {
      const r = await api.post<{ created: number; skipped: number }>("/investigations/generate", {
        versionName: versionName.trim(),
        defaultInvestigatorId: investigatorId ? Number(investigatorId) : undefined,
      })
      toast.success(`已生成 ${r.created} 条排查记录（跳过 ${r.skipped} 条已存在）`)
      setOpen(false); onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVersionName(defaultVersionName) }}>
      <DialogTrigger asChild>
        <Button size="sm"><Wand2 className="size-4" /> 生成清单</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>按版本生成待排查清单</DialogTitle>
          <DialogDescription>对该版本下所有未关闭问题批量创建「待排查」记录</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>产品版本</Label>
            <Input value={versionName} onChange={(event) => setVersionName(event.target.value)}
              placeholder="输入版本，例如 V500R020C10" maxLength={255} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>默认排查人（可选）</Label>
            <SearchableSelect
              value={investigatorId}
              onChange={setInvestigatorId}
              options={[
                { value: "", label: "留空则使用问题责任人" },
                ...(dict?.developers || []).map((u) => ({ value: String(u.id), label: u.displayName })),
              ]}
              placeholder="选择排查人"
              searchPlaceholder="搜索排查人…"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>{saving && "处理中…"}生成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
