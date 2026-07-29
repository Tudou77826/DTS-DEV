import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Dictionaries, Issue, Priority } from "@/lib/types"

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const PRIORITY_LABEL: Record<Priority, string> = { LOW: "低", MEDIUM: "中", HIGH: "高", URGENT: "紧急" }

export function IssueNewPage() {
  const navigate = useNavigate()
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    moduleId: "",
    description: "",
    searchKeywords: "",
    envInfo: "",
    vpnInfo: "",
    domainId: "",
    productId: "",
    foundVersionId: "",
    priority: "MEDIUM" as Priority,
  })

  useEffect(() => { api.get<Dictionaries>("/config/dictionaries").then(setDict) }, [])

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.moduleId) return toast.error("请选择所属模块")
    if (!form.description.trim()) return toast.error("请填写问题描述")
    setSaving(true)
    try {
      const created = await api.post<Issue>("/issues", {
        moduleId: Number(form.moduleId),
        description: form.description,
        searchKeywords: form.searchKeywords || undefined,
        envInfo: form.envInfo || undefined,
        vpnInfo: form.vpnInfo || undefined,
        domainId: form.domainId ? Number(form.domainId) : undefined,
        productId: form.productId ? Number(form.productId) : undefined,
        foundVersionId: form.foundVersionId ? Number(form.foundVersionId) : undefined,
        priority: form.priority,
      })
      toast.success("问题已创建")
      navigate(`/issues/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="新建问题" subtitle="登记一个新问题" actions={
        <>
          <Button variant="outline" onClick={() => navigate(-1)}>取消</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} 创建问题
          </Button>
        </>
      } />
      <PageBody>
        <Card className="max-w-3xl">
          <CardContent className="grid grid-cols-2 gap-4 p-5">
            <div className="col-span-2 flex flex-col gap-2">
              <Label>问题描述 <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="详细描述问题现象、复现步骤等"
                rows={4}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label>查询关键字</Label>
              <Input
                value={form.searchKeywords}
                onChange={(e) => set("searchKeywords", e.target.value)}
                placeholder="文件 Hash、错误码、基线名称、导入时间等检索信息"
              />
            </div>

            <Field label="所属模块" required>
              <Select value={form.moduleId} onValueChange={(v) => set("moduleId", v)}>
                <SelectTrigger><SelectValue placeholder="选择模块" /></SelectTrigger>
                <SelectContent>
                  {dict?.modules
                    .filter((m) => !form.productId || m.productId === Number(form.productId))
                    .map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="来源产品">
              <Select value={form.productId} onValueChange={(v) => { set("productId", v); set("moduleId", ""); set("foundVersionId", "") }}>
                <SelectTrigger><SelectValue placeholder="选择产品" /></SelectTrigger>
                <SelectContent>
                  {dict?.products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="问题领域">
              <Select value={form.domainId} onValueChange={(v) => set("domainId", v)}>
                <SelectTrigger><SelectValue placeholder="选择领域" /></SelectTrigger>
                <SelectContent>
                  {dict?.domains.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="发现版本">
              <Select value={form.foundVersionId} onValueChange={(v) => set("foundVersionId", v)}>
                <SelectTrigger><SelectValue placeholder="选择版本" /></SelectTrigger>
                <SelectContent>
                  {dict?.versions
                    .filter((v) => !form.productId || v.productId === Number(form.productId))
                    .map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.version}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="优先级">
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="VPN 信息">
              <Input value={form.vpnInfo} onChange={(e) => set("vpnInfo", e.target.value)} placeholder="VPN 连接信息" />
            </Field>

            <div className="col-span-2 flex flex-col gap-2">
              <Label>环境信息</Label>
              <Textarea
                value={form.envInfo}
                onChange={(e) => set("envInfo", e.target.value)}
                placeholder="操作系统、硬件、组网、配置等环境信息"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  )
}
