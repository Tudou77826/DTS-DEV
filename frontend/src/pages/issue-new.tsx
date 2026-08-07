import { useEffect, useState, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Loader2, Paperclip, X } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Combobox } from "@/components/ui/combobox"
import { SearchableSelect } from "@/components/ui/searchable-select"
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
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    moduleId: "",
    title: "",
    description: "",
    envInfo: "",
    vpnInfo: "",
    domainId: "",
    productName: "",
    foundVersionName: "",
    priority: "" as Priority,
    assigneeId: "",
    subModule: "",
    expectedFinishAt: "",
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
        envInfo: issue.envInfo || "",
        vpnInfo: issue.vpnInfo || "",
        domainId: issue.domainId ? String(issue.domainId) : "",
        productName: issue.productName || "",
        foundVersionName: issue.foundVersionName || "",
        priority: (issue.priority || "") as Priority,
        assigneeId: issue.assigneeId ? String(issue.assigneeId) : "",
        subModule: issue.subModule || "",
        expectedFinishAt: issue.expectedFinishAt ? toDateTimeLocal(issue.expectedFinishAt) : "",
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
    const vpnConfig = field("vpnInfo")
    if (vpnConfig?.required && !form.vpnInfo.trim()) return toast.error(`${vpnConfig.label}为必填项`)
    setSaving(true)
    try {
      const payload = {
        moduleId: Number(form.moduleId),
        title: form.title.trim(),
        description: form.description,
        envInfo: form.envInfo || undefined,
        vpnInfo: form.vpnInfo || undefined,
        domainId: form.domainId ? Number(form.domainId) : undefined,
        productName: form.productName.trim() || undefined,
        foundVersionName: form.foundVersionName.trim() || undefined,
        priority: form.priority,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
        subModule: form.subModule.trim() || undefined,
        expectedFinishAt: form.expectedFinishAt || undefined,
      }
      if (isEdit && editId) {
        await api.put<Issue>(`/issues/${editId}`, { id: Number(editId), ...payload })
        toast.success("问题已更新")
        navigate(`/issues/${editId}`)
      } else {
        const created = await api.post<Issue>("/issues", payload)
        if (files.length > 0) {
          // 问题创建成功后逐个上传所选附件（附件接口依赖 issueId 且为单文件）
          let failed = 0
          for (const file of files) {
            const formData = new FormData()
            formData.append("sourceType", "ISSUE")
            formData.append("file", file)
            try {
              await api.upload(`/issues/${created.id}/attachments`, formData)
            } catch {
              failed++
            }
          }
          if (failed > 0) toast.warning(`问题已创建，但有 ${failed} 个附件上传失败，可在问题详情中补充`)
        }
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
                    enableImages
                  />
                : <Textarea
                    value={form.description}
                    onChange={(event) => set("description", event.target.value)}
                    placeholder={field("description")?.placeholder}
                    rows={8}
                  />}
            </ConfiguredField>
            {!isEdit && (
              <div className="col-span-2 flex flex-col gap-2">
                <Label>附件（可选）</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? [])
                    setFiles((current) => [...current, ...picked])
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                />
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {files.map((file, index) => (
                      <span key={index} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                        <Paperclip className="size-3 text-muted-foreground" />
                        <span className="max-w-[180px] truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                          aria-label={`移除 ${file.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="w-fit"
                  onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="size-4" /> 选择附件
                </Button>
              </div>
            )}
            <ConfiguredField config={field("module")}>
              <Select value={form.moduleId} onValueChange={(v) => set("moduleId", v)}>
                <SelectTrigger><SelectValue placeholder={field("module")?.placeholder} /></SelectTrigger>
                <SelectContent>
                  {dict?.modules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConfiguredField>
            <ConfiguredField config={field("subModule")}>
              <Input
                value={form.subModule}
                onChange={(event) => set("subModule", event.target.value)}
                placeholder={field("subModule")?.placeholder || "如 PL团队"}
                maxLength={255}
              />
            </ConfiguredField>
            <ConfiguredField config={field("product")}>
              <Combobox
                value={form.productName}
                onChange={(value) => set("productName", value)}
                options={(dict?.products || []).map((p) => ({ value: p.name, label: p.name }))}
                placeholder={field("product")?.placeholder || "选择或输入产品名称"}
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
              <Select value={form.foundVersionName || "none"} onValueChange={(v) => set("foundVersionName", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={field("foundVersion")?.placeholder} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择版本</SelectItem>
                  {form.foundVersionName && !(dict?.versions.some((v) => v.version === form.foundVersionName)) && (
                    <SelectItem value={form.foundVersionName}>{form.foundVersionName}</SelectItem>
                  )}
                  {dict?.versions.map((v) => <SelectItem key={v.id} value={v.version}>{v.version}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <ConfiguredField config={field("expectedFinishAt")}>
              <Input
                type="datetime-local"
                value={form.expectedFinishAt}
                onChange={(e) => set("expectedFinishAt", e.target.value)}
              />
            </ConfiguredField>
            <ConfiguredField config={{ label: "指定处理人", required: false, visible: true }}>
              <SearchableSelect
                value={form.assigneeId}
                onChange={(v) => set("assigneeId", v)}
                options={[
                  { value: "", label: "暂不指定" },
                  ...(dict?.developers || []).map((d) => ({ value: String(d.id), label: d.displayName })),
                ]}
                placeholder="选择处理人（可选）"
                searchPlaceholder="搜索处理人…"
              />
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

/** 把 ISO 时间字符串转成 datetime-local 输入框的值（本地时区）。 */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
