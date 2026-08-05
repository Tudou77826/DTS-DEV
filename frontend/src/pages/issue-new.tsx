import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Dictionaries, Issue, IssueFormFieldConfig, Priority } from "@/lib/types"
import { htmlToText } from "@/lib/utils"

export function IssueNewPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)
  const [dict, setDict] = useState<Dictionaries | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [form, setForm] = useState({
    moduleId: "",
    title: "",
    description: "",
    searchKeywords: "",
    envInfo: "",
    vpnInfo: "",
    domainId: "",
    productName: "",
    foundVersionName: "",
    priority: "" as Priority,
  })

  useEffect(() => {
    api.get<Dictionaries>("/config/dictionaries").then((value) => {
      setDict(value)
      setForm((previous) => ({ ...previous, priority: value.customization.issue.defaultPriority }))
    })
  }, [])

  useEffect(() => {
    if (!isEdit || !editId) return
    api.get<Issue>(`/issues/${editId}`).then((issue) => {
      setForm({
        moduleId: issue.moduleId ? String(issue.moduleId) : "",
        title: issue.title,
        description: issue.description,
        searchKeywords: issue.searchKeywords || "",
        envInfo: issue.envInfo || "",
        vpnInfo: issue.vpnInfo || "",
        domainId: issue.domainId ? String(issue.domainId) : "",
        productName: issue.productName || "",
        foundVersionName: issue.foundVersionName || "",
        priority: (issue.priority || "") as Priority,
      })
    }).finally(() => setLoading(false))
  }, [isEdit, editId])

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const field = (key: keyof Dictionaries["customization"]["issue"]["fields"]) =>
    dict?.customization.issue.fields[key]
  const issueTerm = dict?.customization.terminology.issue || "事项"

  const submit = async () => {
    if (!form.moduleId) return toast.error("请选择所属模块")
    if (!form.title.trim()) return toast.error("请填写问题标题")
    if (form.title.trim().length > 255) return toast.error("问题标题不能超过255个字符")
    if (!htmlToText(form.description)) return toast.error("请填写问题描述")
    setSaving(true)
    try {
      const payload = {
        moduleId: Number(form.moduleId),
        title: form.title.trim(),
        description: form.description,
        searchKeywords: form.searchKeywords.trim() || undefined,
        envInfo: form.envInfo || undefined,
        vpnInfo: form.vpnInfo || undefined,
        domainId: form.domainId ? Number(form.domainId) : undefined,
        productName: form.productName.trim() || undefined,
        foundVersionName: form.foundVersionName.trim() || undefined,
        priority: form.priority,
      }
      if (isEdit && editId) {
        await api.put<Issue>(`/issues/${editId}`, { id: Number(editId), ...payload })
        toast.success("问题已更新")
        navigate(`/issues/${editId}`)
      } else {
        const created = await api.post<Issue>("/issues", payload)
        toast.success("问题已创建")
        navigate(`/issues/${created.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isEdit ? "更新失败" : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
    </div>
  )

  return (
    <>
      <PageHeader title={`${isEdit ? "编辑" : "新建"}${issueTerm}`} subtitle={isEdit ? "修改问题信息" : "登记一个新问题"} actions={
        <>
          <Button variant="outline" onClick={() => navigate(-1)}>取消</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} {isEdit ? "保存修改" : `创建${issueTerm}`}
          </Button>
        </>
      } />
      <PageBody>
        <Card className="max-w-3xl">
          <CardContent className="grid grid-cols-2 gap-4 p-5">
            <ConfiguredField config={field("title")} className="col-span-2">
              <Input
                id="issue-title"
                autoFocus
                maxLength={255}
                className="h-11 text-base font-medium"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={field("title")?.placeholder}
              />
              <div className="text-right text-xs text-muted-foreground">{form.title.length}/255</div>
            </ConfiguredField>
            <ConfiguredField config={field("description")} className="col-span-2">
              {(dict?.customization.features["rich-text"] ?? dict?.customization.features.richText ?? true)
                ? <RichTextEditor
                    value={form.description}
                    onChange={(value) => set("description", value)}
                    placeholder={field("description")?.placeholder}
                  />
                : <Textarea
                    value={form.description}
                    onChange={(event) => set("description", event.target.value)}
                    placeholder={field("description")?.placeholder}
                    rows={8}
                  />}
            </ConfiguredField>
            <div className="col-span-2 flex flex-col gap-2">
              <Label>搜索关键字</Label>
              <Input
                value={form.searchKeywords}
                onChange={(e) => set("searchKeywords", e.target.value)}
                placeholder="便于检索的关键词，多个用空格分隔（可选）"
                maxLength={255}
              />
            </div>
            <ConfiguredField config={field("module")}>
              <Select value={form.moduleId} onValueChange={(v) => set("moduleId", v)}>
                <SelectTrigger><SelectValue placeholder={field("module")?.placeholder} /></SelectTrigger>
                <SelectContent>
                  {dict?.modules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConfiguredField>
            <ConfiguredField config={field("product")}>
              <Input
                value={form.productName}
                onChange={(event) => set("productName", event.target.value)}
                placeholder={field("product")?.placeholder || "输入产品名称"}
                maxLength={255}
              />
            </ConfiguredField>
            <ConfiguredField config={field("domain")}>
              <Select value={form.domainId} onValueChange={(v) => set("domainId", v)}>
                <SelectTrigger><SelectValue placeholder={field("domain")?.placeholder} /></SelectTrigger>
                <SelectContent>
                  {dict?.domains.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConfiguredField>
            <ConfiguredField config={field("foundVersion")}>
              <Input
                value={form.foundVersionName}
                onChange={(event) => set("foundVersionName", event.target.value)}
                placeholder={field("foundVersion")?.placeholder || "输入版本号"}
                maxLength={255}
              />
            </ConfiguredField>
            <ConfiguredField config={field("priority")}>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dict?.customization.issue.priorities.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ConfiguredField>
            <ConfiguredField config={field("vpnInfo")}>
              <Input value={form.vpnInfo} onChange={(e) => set("vpnInfo", e.target.value)}
                placeholder={field("vpnInfo")?.placeholder} />
            </ConfiguredField>

            <ConfiguredField config={field("envInfo")} className="col-span-2">
              <Textarea
                value={form.envInfo}
                onChange={(e) => set("envInfo", e.target.value)}
                placeholder={field("envInfo")?.placeholder}
                rows={3}
              />
            </ConfiguredField>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function ConfiguredField({
  config, className = "", children,
}: {
  config?: IssueFormFieldConfig
  className?: string
  children: React.ReactNode
}) {
  if (!config || !config.visible) return null
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Label>{config.label} {config.required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  )
}
