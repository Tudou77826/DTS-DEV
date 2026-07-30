import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import {
  AlertTriangle, Boxes, Check, FileCode2, Layers3, Loader2, Palette,
  FileUp, Plus, RefreshCw, Save, Settings2, ShieldCheck, Trash2, UsersRound, Workflow,
} from "lucide-react"
import { api } from "@/lib/api"
import { PageBody, PageHeader } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from "@/store/auth"
import { applyThemeColor } from "@/store/customization"
import { toast } from "sonner"
import type { DtsCustomization, IssueStatus } from "@/lib/types"

interface ConfigFileView {
  content: string
  source: "EXTERNAL" | "CLASSPATH_DEFAULT"
  externalPath: string
  lastModified?: string
  restartRequired: boolean
}

interface StructuredView {
  customization: DtsCustomization
  source: ConfigFileView["source"]
  externalPath: string
  lastModified?: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export function CustomizationPage() {
  const user = useAuth((state) => state.user)
  const [draft, setDraft] = useState<DtsCustomization | null>(null)
  const [original, setOriginal] = useState<DtsCustomization | null>(null)
  const [file, setFile] = useState<ConfigFileView | null>(null)
  const [yaml, setYaml] = useState("")
  const [originalYaml, setOriginalYaml] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)

  const formChanged = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original))
  const yamlChanged = yaml !== originalYaml

  const load = async () => {
    setLoading(true)
    try {
      const [structured, raw] = await Promise.all([
        api.get<StructuredView>("/config/customization/admin/structured"),
        api.get<ConfigFileView>("/config/customization/admin"),
      ])
      setDraft(clone(structured.customization))
      setOriginal(clone(structured.customization))
      setFile(raw)
      setYaml(raw.content)
      setOriginalYaml(raw.content)
      setValidation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取配置失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user?.role === "ADMIN") void load() }, [user?.role])
  if (user && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />

  const saveStructured = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const saved = await api.put<ConfigFileView>("/config/customization/admin/structured", draft)
      const raw = await api.get<ConfigFileView>("/config/customization/admin")
      setFile(saved)
      setOriginal(clone(draft))
      setYaml(raw.content)
      setOriginalYaml(raw.content)
      toast.success("配置已保存，请重启后端使其生效")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const validateYaml = async () => {
    setValidating(true)
    try {
      const result = await api.post<ValidationResult>("/config/customization/admin/validate", { content: yaml })
      setValidation(result)
      result.valid ? toast.success("YAML 校验通过") : toast.error("YAML 存在错误")
      return result.valid
    } finally {
      setValidating(false)
    }
  }

  const saveYaml = async () => {
    if (!await validateYaml()) return
    if (!window.confirm("确认用高级模式内容覆盖配置？旧版本会自动备份。")) return
    setSaving(true)
    try {
      const saved = await api.put<ConfigFileView>("/config/customization/admin", { content: yaml })
      setFile(saved)
      setOriginalYaml(saved.content)
      await load()
      toast.success("配置已保存，请重启后端使其生效")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draft) {
    return (
      <>
        <PageHeader title="接入定制" subtitle="为团队配置一套可理解、可维护的系统行为" />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> 正在加载配置…
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="接入定制"
        subtitle={`${draft.profile.name} · ${draft.profile.targetTeam || "未指定团队"}`}
        actions={
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void saveStructured()
            }}
          >
            <Button type="button" variant="outline" onClick={() => void load()} disabled={formChanged || yamlChanged}>
              <RefreshCw className="size-4" /> 重新读取
            </Button>
            <Button type="submit" disabled={!formChanged || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存更改
            </Button>
          </form>
        }
      />
      <PageBody className="bg-muted/20">
        <div className="mx-auto max-w-7xl space-y-4">
          <RestartNotice file={file} />
          <Tabs defaultValue="identity">
            <TabsList className="h-auto flex-wrap justify-start bg-card p-1 shadow-xs">
              <TabsTrigger value="identity"><Palette /> 品牌与术语</TabsTrigger>
              <TabsTrigger value="issue"><Settings2 /> 问题模型</TabsTrigger>
              <TabsTrigger value="workflow"><Workflow /> 流程配置</TabsTrigger>
              <TabsTrigger value="organization"><UsersRound /> 组织与人员</TabsTrigger>
              <TabsTrigger value="master"><Boxes /> 主数据</TabsTrigger>
              <TabsTrigger value="features"><Layers3 /> 功能开关</TabsTrigger>
              <TabsTrigger value="advanced"><FileCode2 /> 高级模式</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="mt-4 space-y-4">
              <IdentityPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="issue" className="mt-4 space-y-4">
              <IssueModelPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="workflow" className="mt-4">
              <WorkflowPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="organization" className="mt-4 space-y-4">
              <OrganizationPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="master" className="mt-4 space-y-4">
              <MasterDataPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="features" className="mt-4">
              <FeaturesPanel value={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="advanced" className="mt-4 space-y-3">
              <AdvancedPanel
                file={file} yaml={yaml} setYaml={(value) => { setYaml(value); setValidation(null) }}
                changed={yamlChanged} validating={validating} saving={saving}
                validation={validation} onValidate={validateYaml} onSave={saveYaml}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageBody>
    </>
  )
}

function IdentityPanel({ value, onChange }: EditorProps) {
  const setProfile = (key: keyof DtsCustomization["profile"], text: string) =>
    onChange({ ...value, profile: { ...value.profile, [key]: text } })
  const setBrand = (key: keyof DtsCustomization["branding"], next: string | boolean) =>
    {
      if (key === "primaryColor" && typeof next === "string" && /^#[0-9a-fA-F]{6}$/.test(next)) {
        applyThemeColor(next)
      }
      onChange({ ...value, branding: { ...value.branding, [key]: next } })
    }
  const setTerm = (key: keyof DtsCustomization["terminology"], text: string) =>
    onChange({ ...value, terminology: { ...value.terminology, [key]: text } })

  return (
    <>
      <Section title="接入身份" description="标明这套配置服务于哪个团队和外部系统。">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Profile ID" value={value.profile.id} onChange={(v) => setProfile("id", v)} mono />
          <TextField label="配置名称" value={value.profile.name} onChange={(v) => setProfile("name", v)} />
          <TextField label="目标团队" value={value.profile.targetTeam || ""} onChange={(v) => setProfile("targetTeam", v)} />
          <TextField label="目标系统" value={value.profile.targetSystem || ""} onChange={(v) => setProfile("targetSystem", v)} />
        </div>
      </Section>
      <Section title="品牌体验" description="登录页、侧边栏和浏览器标题会使用这些信息。">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="系统名称" value={value.branding.productName} onChange={(v) => setBrand("productName", v)} />
          <TextField label="系统简称" value={value.branding.shortName} onChange={(v) => setBrand("shortName", v)} />
          <TextField label="登录标题" value={value.branding.loginTitle} onChange={(v) => setBrand("loginTitle", v)} />
          <TextField label="登录说明" value={value.branding.loginSubtitle} onChange={(v) => setBrand("loginSubtitle", v)} />
          <div className="flex flex-col gap-2">
            <Label>主题色 <span className="ml-1 text-[10px] font-normal text-muted-foreground">实时预览</span></Label>
            <div className="flex gap-2">
              <input type="color" className="h-9 w-12 rounded border border-input bg-transparent p-1"
                value={value.branding.primaryColor} onChange={(e) => setBrand("primaryColor", e.target.value)} />
              <Input value={value.branding.primaryColor} onChange={(e) => setBrand("primaryColor", e.target.value)}
                className="font-mono" />
            </div>
          </div>
          <ToggleRow label="登录页显示演示账号" checked={value.branding.showDemoAccounts}
            onChange={(v) => setBrand("showDemoAccounts", v)} compact />
          <TextField label="演示账号提示" value={value.branding.demoAccountHint || ""}
            onChange={(v) => setBrand("demoAccountHint", v)} />
        </div>
      </Section>
      <Section title="团队术语" description="用团队熟悉的叫法替换系统默认术语。技术字段不会改变。">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(value.terminology).map(([key, label]) => (
            <TextField key={key} label={TERM_LABEL[key] || key} value={label}
              onChange={(v) => setTerm(key as keyof DtsCustomization["terminology"], v)} />
          ))}
        </div>
      </Section>
    </>
  )
}

function IssueModelPanel({ value, onChange }: EditorProps) {
  const issue = value.issue
  const setIssue = (next: DtsCustomization["issue"]) => onChange({ ...value, issue: next })
  return (
    <>
      <Section title="编号规则" description="预览会按照当前日期展示，保存后新建问题使用新规则。">
        <div className="grid gap-4 md:grid-cols-4">
          <TextField label="编号前缀" value={issue.code.prefix}
            onChange={(v) => setIssue({ ...issue, code: { ...issue.code, prefix: v } })} mono />
          <TextField label="日期格式" value={issue.code.datePattern}
            onChange={(v) => setIssue({ ...issue, code: { ...issue.code, datePattern: v } })} mono />
          <NumberField label="流水位数" value={issue.code.sequenceDigits} min={1} max={9}
            onChange={(v) => setIssue({ ...issue, code: { ...issue.code, sequenceDigits: v } })} />
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <div className="text-xs text-muted-foreground">编号预览</div>
            <div className="mt-2 font-mono text-sm font-semibold">
              {issue.code.prefix}-260729-{"1".padStart(issue.code.sequenceDigits, "0")}
            </div>
          </div>
        </div>
      </Section>
      <Section title="优先级" description="技术值保持稳定；可以定制团队看到的名称和默认项。">
        <div className="space-y-2">
          {issue.priorities.map((priority, index) => (
            <div key={priority.value} className="grid items-center gap-3 rounded-lg border border-border px-3 py-3 md:grid-cols-[140px_1fr_150px_110px]">
              <code className="text-xs text-muted-foreground">{priority.value}</code>
              <Input value={priority.label} onChange={(e) => {
                const priorities = [...issue.priorities]
                priorities[index] = { ...priority, label: e.target.value }
                setIssue({ ...issue, priorities })
              }} />
              <Input value={priority.color || ""} placeholder="颜色语义" onChange={(e) => {
                const priorities = [...issue.priorities]
                priorities[index] = { ...priority, color: e.target.value }
                setIssue({ ...issue, priorities })
              }} />
              <Button type="button" size="sm"
                variant={issue.defaultPriority === priority.value ? "default" : "outline"}
                onClick={() => setIssue({ ...issue, defaultPriority: priority.value })}>
                {issue.defaultPriority === priority.value && <Check className="size-3.5" />} 默认
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="新建页面字段" description="控制字段名称、提示文案和显示状态。核心必填约束仍由后端保护。">
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.entries(issue.fields).map(([key, field]) => (
            <div key={key} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between">
                <code className="text-xs text-muted-foreground">{key}</code>
                <div className="flex gap-2">
                  <MiniToggle label="显示" checked={field.visible} onChange={(visible) =>
                    setIssue({ ...issue, fields: { ...issue.fields, [key]: { ...field, visible } } })} />
                  <MiniToggle label="必填" checked={field.required} onChange={(required) =>
                    setIssue({ ...issue, fields: { ...issue.fields, [key]: { ...field, required } } })} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={field.label} placeholder="字段名称" onChange={(e) =>
                  setIssue({ ...issue, fields: { ...issue.fields, [key]: { ...field, label: e.target.value } } })} />
                <Input value={field.placeholder || ""} placeholder="输入提示" onChange={(e) =>
                  setIssue({ ...issue, fields: { ...issue.fields, [key]: { ...field, placeholder: e.target.value } } })} />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

function WorkflowPanel({ value, onChange }: EditorProps) {
  const issue = value.issue
  const setIssue = (next: DtsCustomization["issue"]) => onChange({ ...value, issue: next })
  const labels = Object.fromEntries(issue.statuses.map((status) => [status.value, status.label]))
  const toggleTransition = (from: IssueStatus, to: IssueStatus) => {
    const current = issue.transitions[from] || []
    const next = current.includes(to) ? current.filter((item) => item !== to) : [...current, to]
    setIssue({ ...issue, transitions: { ...issue.transitions, [from]: next } })
  }
  return (
    <Section title="状态与流转" description="点击目标状态即可允许或禁止流转。业务必填和权限规则仍由后端执行。">
      <div className="space-y-3">
        {issue.statuses.map((status, index) => (
          <div key={status.value} className="grid gap-3 rounded-lg border border-border p-4 lg:grid-cols-[210px_1fr]">
            <div>
              <code className="text-[11px] text-muted-foreground">{status.value}</code>
              <Input className="mt-2" value={status.label} onChange={(e) => {
                const statuses = [...issue.statuses]
                statuses[index] = { ...status, label: e.target.value }
                setIssue({ ...issue, statuses })
              }} />
            </div>
            <div>
              <div className="mb-2 text-xs text-muted-foreground">允许流转到</div>
              <div className="flex flex-wrap gap-1.5">
                {issue.statuses.filter((target) => target.value !== status.value).map((target) => {
                  const active = (issue.transitions[status.value] || []).includes(target.value)
                  return (
                    <button key={target.value} type="button" onClick={() => toggleTransition(status.value, target.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}>
                      {active && <span className="mr-1">→</span>}{labels[target.value]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function OrganizationPanel({ value, onChange }: EditorProps) {
  const master = value.masterData
  const setMaster = (next: DtsCustomization["masterData"]) => onChange({ ...value, masterData: next })
  const updateTeam = (index: number, patch: Partial<DtsCustomization["masterData"]["teams"][number]>) => {
    const teams = [...master.teams]
    teams[index] = { ...teams[index], ...patch }
    setMaster({ ...master, teams })
  }
  const updateUser = (index: number, patch: Partial<DtsCustomization["masterData"]["users"][number]>) => {
    const users = [...master.users]
    users[index] = { ...users[index], ...patch }
    setMaster({ ...master, users })
  }

  return (
    <>
      <Section title="团队" description="团队 key 是人员归属的稳定引用；名称和说明可以按接入组织调整。">
        <div className="space-y-3">
          {master.teams.map((team, index) => (
            <div key={`${team.key}-${index}`} className="grid items-end gap-3 rounded-lg border border-border p-4 md:grid-cols-[180px_1fr_1.4fr_auto]">
              <TextField label="团队 key" value={team.key} onChange={(key) => updateTeam(index, { key })} mono />
              <TextField label="团队名称" value={team.name} onChange={(name) => updateTeam(index, { name })} />
              <TextField label="团队说明" value={team.description || ""} onChange={(description) => updateTeam(index, { description })} />
              <Button variant="ghost" size="icon" title="删除团队" onClick={() =>
                setMaster({ ...master, teams: master.teams.filter((_, itemIndex) => itemIndex !== index) })}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => setMaster({
            ...master,
            teams: [...master.teams, { key: `team-${master.teams.length + 1}`, name: "新团队" }],
          })}><Plus className="size-4" /> 添加团队</Button>
        </div>
      </Section>

      <Section title="账号与责任人" description="角色为开发人员且状态启用的账号会进入责任人下拉框；新账号首次同步时使用部署环境设置的初始密码。">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          修改姓名、角色、团队或启用状态后，保存并重启即可同步。已有账号密码不会被覆盖。
        </div>
        <CsvUserImport value={value} onImport={(users) => setMaster({ ...master, users })} />
        <div className="space-y-3">
          {master.users.map((account, index) => (
            <div key={`${account.username}-${index}`} className="rounded-xl border border-border bg-background p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[130px_150px_1fr_170px_170px_110px_auto]">
                <TextField label="工号" value={account.employeeNo} onChange={(employeeNo) => updateUser(index, { employeeNo })} mono />
                <TextField label="用户名" value={account.username} onChange={(username) => updateUser(index, { username })} mono />
                <TextField label="显示姓名" value={account.displayName} onChange={(displayName) => updateUser(index, { displayName })} />
                <div className="flex flex-col gap-2">
                  <Label>角色</Label>
                  <Select value={account.role} onValueChange={(role) => updateUser(index, { role })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {value.roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>所属团队</Label>
                  <Select value={account.team || "NONE"} onValueChange={(team) => updateUser(index, { team: team === "NONE" ? undefined : team })}>
                    <SelectTrigger><SelectValue placeholder="不指定团队" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">不指定团队</SelectItem>
                      {master.teams.map((team) => <SelectItem key={team.key} value={team.key}>{team.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>头像色</Label>
                  <div className="flex gap-2">
                    <input type="color" className="h-9 w-11 rounded border border-input bg-transparent p-1"
                      value={account.avatarColor || "#64748b"} onChange={(event) => updateUser(index, { avatarColor: event.target.value })} />
                    <MiniToggle label={account.active ? "启用" : "停用"} checked={account.active}
                      onChange={(active) => updateUser(index, { active })} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="mt-6" title="移除账号配置" onClick={() =>
                  setMaster({ ...master, users: master.users.filter((_, itemIndex) => itemIndex !== index) })}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setMaster({
            ...master,
            users: [...master.users, {
              employeeNo: `U${String(master.users.length + 1).padStart(4, "0")}`,
              username: `user${master.users.length + 1}`,
              displayName: "新用户",
              role: "DEVELOPER",
              team: master.teams[0]?.key,
              avatarColor: "#64748b",
              active: true,
            }],
          })}><Plus className="size-4" /> 添加账号</Button>
        </div>
      </Section>
    </>
  )
}

function CsvUserImport({ value, onImport }: {
  value: DtsCustomization
  onImport: (users: DtsCustomization["masterData"]["users"]) => void
}) {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState("")
  const sample = [
    "工号,用户名,显示姓名,角色,所属团队,头像色,启用",
    "D2001,zhangsan,张三,开发人员,网络安全组,#0891b2,true",
    "S2002,lisi,李四,问题提出人,network-security,#7c3aed,true",
  ].join("\n")

  const importCsv = () => {
    try {
      const result = mergeCsvUsers(csv, value)
      onImport(result.users)
      setCsv("")
      setOpen(false)
      toast.success(`CSV 已导入：新增 ${result.created} 人，更新 ${result.updated} 人`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV 解析失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="mb-4 flex justify-end">
        <DialogTrigger asChild>
          <Button type="button" variant="outline"><FileUp className="size-4" /> 批量导入</Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>批量导入人员</DialogTitle>
          <DialogDescription>
            粘贴 CSV 文本并导入到当前草稿。系统按用户名合并，已有人员会更新，未出现的人员保持不变。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 lg:grid-cols-[1fr_240px]">
          <Textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={sample}
            rows={12}
            spellCheck={false}
            className="resize-y bg-muted/20 font-mono text-xs leading-5"
          />
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-3 text-xs font-medium text-foreground">支持的表头</div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p><code>工号 / employeeNo</code></p>
              <p><code>用户名 / username</code></p>
              <p><code>显示姓名 / displayName</code></p>
              <p><code>角色 / role</code></p>
              <p><code>所属团队 / team</code>（key 或名称）</p>
              <p><code>头像色 / avatarColor</code></p>
              <p><code>启用 / active</code></p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-4 w-full"
              onClick={() => setCsv(sample)}>填入示例</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button type="button" onClick={importCsv} disabled={!csv.trim()}>
            <FileUp className="size-4" /> 导入到当前草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MasterDataPanel({ value, onChange }: EditorProps) {
  const master = value.masterData
  const setMaster = (next: DtsCustomization["masterData"]) => onChange({ ...value, masterData: next })
  return (
    <>
      <Section title="模块" description="产品和版本由问题填写者直接输入；这里只维护需要统一口径的模块。">
        <div className="flex flex-wrap gap-2">
          {master.modules.map((module, index) => (
            <div key={`${module}-${index}`} className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <Input className="h-8 w-44 border-0 shadow-none" value={module} onChange={(event) => {
                const modules = [...master.modules]
                modules[index] = event.target.value
                setMaster({ ...master, modules })
              }} />
              <Button variant="ghost" size="icon-sm" onClick={() =>
                setMaster({ ...master, modules: master.modules.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-10" onClick={() =>
            setMaster({ ...master, modules: [...master.modules, "新模块"] })}>
            <Plus className="size-4" /> 添加模块
          </Button>
        </div>
      </Section>
      <Section title="问题领域" description="维护团队使用的问题分类。">
        <div className="flex flex-wrap gap-2">
          {master.domains.map((domain, index) => (
            <div key={`${domain.name}-${index}`} className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <Input className="h-8 w-40 border-0 shadow-none" value={domain.name} onChange={(e) => {
                const domains = [...master.domains]
                domains[index] = { ...domain, name: e.target.value }
                setMaster({ ...master, domains })
              }} />
              <Button variant="ghost" size="icon-sm" onClick={() =>
                setMaster({ ...master, domains: master.domains.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-10" onClick={() =>
            setMaster({ ...master, domains: [...master.domains, { name: "新领域" }] })}>
            <Plus className="size-4" /> 添加领域
          </Button>
        </div>
      </Section>
    </>
  )
}

function FeaturesPanel({ value, onChange }: EditorProps) {
  return (
    <Section title="功能能力" description="关闭后对应入口会从界面隐藏；核心数据不会被删除。">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(value.features).map(([key, enabled]) => (
          <ToggleRow key={key} label={FEATURE_LABEL[key] || key} description={key} checked={enabled}
            onChange={(checked) => onChange({ ...value, features: { ...value.features, [key]: checked } })} />
        ))}
      </div>
    </Section>
  )
}

function AdvancedPanel({ file, yaml, setYaml, changed, validating, saving, validation, onValidate, onSave }: {
  file: ConfigFileView | null
  yaml: string
  setYaml: (value: string) => void
  changed: boolean
  validating: boolean
  saving: boolean
  validation: ValidationResult | null
  onValidate: () => Promise<boolean>
  onSave: () => Promise<void>
}) {
  const lines = useMemo(() => yaml ? yaml.split("\n").length : 0, [yaml])
  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>高级模式用于适配器扩展或排查。常规配置请使用上方结构化页面。</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void onValidate()} disabled={validating}>
            {validating ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} 校验
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={!changed || saving}>
            <Save className="size-4" /> 保存 YAML
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-slate-950 px-4 py-3 text-slate-100">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><FileCode2 className="size-4 text-emerald-400" /> dts-customization.yml</span>
            <Badge variant="secondary">{file?.source === "EXTERNAL" ? "外部配置" : "内置默认"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Textarea value={yaml} onChange={(e) => setYaml(e.target.value)} spellCheck={false}
            className="min-h-[560px] resize-y rounded-none border-0 bg-[#0b1020] px-5 py-4 font-mono text-[13px] leading-6 text-slate-200 shadow-none focus-visible:ring-0" />
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">{lines} 行 · UTF-8 · YAML</div>
        </CardContent>
      </Card>
      {validation && <div className={`rounded-lg border px-4 py-3 text-sm ${validation.valid
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : "border-red-300 bg-red-50 text-red-900"}`}>
        {validation.valid ? "配置校验通过" : validation.errors.join("；")}
      </div>}
    </>
  )
}

function RestartNotice({ file }: { file: ConfigFileView | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <div className="text-sm font-medium">配置来源：{file?.source === "EXTERNAL" ? "外部配置" : "内置默认"}</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{file?.externalPath}</div>
      </div>
      <Badge variant={file?.restartRequired ? "destructive" : "secondary"}>
        {file?.restartRequired ? "等待重启生效" : "运行中"}
      </Badge>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  )
}

function TextField({ label, value, onChange, mono }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className={mono ? "font-mono" : ""} />
  </div>
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>
    <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>
}

function ToggleRow({ label, description, checked, onChange, compact }: {
  label: string; description?: string; checked: boolean; onChange: (value: boolean) => void; compact?: boolean
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-background text-left transition-colors hover:border-primary/40 ${compact ? "mt-6 h-9 px-3" : "p-4"}`}>
      <div><div className="text-sm font-medium">{label}</div>{description && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{description}</div>}</div>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  )
}

function MiniToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)}
    className={`rounded-md border px-2 py-1 text-[11px] ${checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
    {checked && <Check className="mr-1 inline size-3" />}{label}
  </button>
}

interface EditorProps {
  value: DtsCustomization
  onChange: (value: DtsCustomization) => void
}

type ConfigUser = DtsCustomization["masterData"]["users"][number]

const CSV_HEADER_ALIASES: Record<string, keyof ConfigUser> = {
  employeeno: "employeeNo", 工号: "employeeNo",
  username: "username", 用户名: "username", 账号: "username",
  displayname: "displayName", 显示姓名: "displayName", 姓名: "displayName",
  role: "role", 角色: "role",
  team: "team", teamkey: "team", 团队: "team", 所属团队: "team",
  avatarcolor: "avatarColor", 头像色: "avatarColor",
  active: "active", 启用: "active", 状态: "active",
}

function mergeCsvUsers(text: string, config: DtsCustomization) {
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一行人员数据")
  const headers = rows[0].map((header) =>
    CSV_HEADER_ALIASES[header.trim().toLowerCase().replace(/[\s_-]/g, "")])
  const required: Array<keyof ConfigUser> = ["employeeNo", "username", "displayName", "role"]
  for (const key of required) {
    if (!headers.includes(key)) throw new Error(`CSV 缺少必填表头：${key}`)
  }

  const currentByUsername = new Map(config.masterData.users.map((user) => [user.username, user]))
  const importedNames = new Set<string>()
  let created = 0
  let updated = 0
  rows.slice(1).forEach((row, rowIndex) => {
    const raw: Partial<Record<keyof ConfigUser, string>> = {}
    headers.forEach((key, index) => {
      if (key) raw[key] = (row[index] || "").trim()
    })
    const line = rowIndex + 2
    const employeeNo = raw.employeeNo
    const username = raw.username
    const displayName = raw.displayName
    if (!employeeNo || !username || !displayName || !raw.role) {
      throw new Error(`第 ${line} 行缺少工号、用户名、显示姓名或角色`)
    }
    if (importedNames.has(username)) throw new Error(`第 ${line} 行用户名重复：${username}`)
    importedNames.add(username)

    const existing = currentByUsername.get(username)
    const role = resolveCsvRole(raw.role, config)
    const team = resolveCsvTeam(raw.team, config, line, existing?.team)
    const active = resolveCsvActive(raw.active, line, existing?.active)
    const next: ConfigUser = {
      employeeNo,
      username,
      displayName,
      role,
      team,
      avatarColor: raw.avatarColor || existing?.avatarColor || "#64748b",
      active,
    }
    currentByUsername.set(username, next)
    existing ? updated++ : created++
  })

  const users = [...currentByUsername.values()]
  const employeeNos = new Set<string>()
  for (const user of users) {
    if (employeeNos.has(user.employeeNo)) throw new Error(`导入后存在重复工号：${user.employeeNo}`)
    employeeNos.add(user.employeeNo)
  }
  return { users, created, updated }
}

function resolveCsvRole(input: string, config: DtsCustomization) {
  const normalized = input.trim()
  const role = config.roles.find((item) =>
    item.value.toLowerCase() === normalized.toLowerCase() || item.label === normalized)
  if (!role) throw new Error(`未知角色：${input}`)
  return role.value
}

function resolveCsvTeam(
  input: string | undefined,
  config: DtsCustomization,
  line: number,
  fallback?: string,
) {
  if (!input) return fallback || config.masterData.teams[0]?.key
  const team = config.masterData.teams.find((item) => item.key === input || item.name === input)
  if (!team) throw new Error(`第 ${line} 行引用了未知团队：${input}`)
  return team.key
}

function resolveCsvActive(input: string | undefined, line: number, fallback?: boolean) {
  if (!input) return fallback ?? true
  const normalized = input.trim().toLowerCase()
  if (["true", "1", "yes", "y", "是", "启用"].includes(normalized)) return true
  if (["false", "0", "no", "n", "否", "停用", "禁用"].includes(normalized)) return false
  throw new Error(`第 ${line} 行启用状态无效：${input}`)
}

function parseCsvRows(text: string) {
  const source = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  if (quoted) throw new Error("CSV 中存在未闭合的双引号")
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

const TERM_LABEL: Record<string, string> = {
  issue: "事项名称", product: "产品", module: "模块", version: "版本",
  domain: "领域", submitter: "提出人", assignee: "责任人",
}

const FEATURE_LABEL: Record<string, string> = {
  attachments: "附件", relations: "问题关联", notifications: "站内通知",
  investigations: "版本排查", batchOperations: "批量操作", "batch-operations": "批量操作",
  excelExport: "Excel 导出", "excel-export": "Excel 导出",
  richText: "富文本描述", "rich-text": "富文本描述",
}
