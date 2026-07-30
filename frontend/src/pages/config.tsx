import { useEffect, useState } from "react"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, PageBody } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ProductModule, IssueDomain } from "@/lib/types"

export function ConfigPage() {
  return (
    <>
      <PageHeader title="基础配置" subtitle="维护模块和问题领域等需要统一口径的基础字典" />
      <PageBody>
        <Tabs defaultValue="modules">
          <TabsList>
            <TabsTrigger value="modules">模块</TabsTrigger>
            <TabsTrigger value="domains">问题领域</TabsTrigger>
          </TabsList>
          <TabsContent value="modules" className="mt-4"><ModulesPanel /></TabsContent>
          <TabsContent value="domains" className="mt-4"><DomainsPanel /></TabsContent>
        </Tabs>
      </PageBody>
    </>
  )
}

function useSimpleList<T extends { id: number; name?: string; version?: string }>(path: string, label: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.get<T[]>(path).then(setItems).finally(() => setLoading(false))
  }
  useEffect(load, [])
  return { items, loading, load }
}

function NameInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
}

function ModulesPanel() {
  const { items, loading, load } = useSimpleList<ProductModule>("/config/modules", "模块")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const add = async () => {
    if (!name.trim()) return toast.error("请输入名称")
    setSaving(true)
    try { await api.post("/config/modules", { name, active: true }); setName(""); toast.success("已添加"); load() }
    finally { setSaving(false) }
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <NameInput value={name} onChange={setName} placeholder="模块名称" />
          <Button size="sm" onClick={add} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 添加
          </Button>
        </div>
        {loading ? <ListSkeleton /> : (
          <div className="divide-y divide-border">
            {items.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{m.name}</span>
                <DeleteBtn onConfirm={async () => { await api.del(`/config/modules/${m.id}`); toast.success("已删除"); load() }} />
              </div>
            ))}
            {items.length === 0 && <Empty />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DomainsPanel() {
  const { items, loading, load } = useSimpleList<IssueDomain>("/config/domains", "问题领域")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const add = async () => {
    if (!name.trim()) return toast.error("请输入名称")
    setSaving(true)
    try { await api.post("/config/domains", { name }); setName(""); toast.success("已添加"); load() }
    finally { setSaving(false) }
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <NameInput value={name} onChange={setName} placeholder="问题领域名称，如 功能缺陷" />
          <Button size="sm" onClick={add} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 添加
          </Button>
        </div>
        {loading ? <ListSkeleton /> : (
          <div className="flex flex-wrap gap-2 p-4">
            {items.map((d) => (
              <Badge key={d.id} variant="secondary" className="gap-1.5 py-1">
                {d.name}
                <button onClick={async () => { await api.del(`/config/domains/${d.id}`); toast.success("已删除"); load() }}
                  className="rounded-sm opacity-60 hover:opacity-100">
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
            {items.length === 0 && <Empty />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeleteBtn({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="ml-auto flex items-center gap-1">
        <Button variant="destructive" size="xs" className="h-7"
          onClick={async () => { await onConfirm(); setConfirming(false) }}>确认删除</Button>
        <Button variant="ghost" size="xs" className="h-7" onClick={() => setConfirming(false)}>取消</Button>
      </div>
    )
  }
  return (
    <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setConfirming(true)}>
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  )
}

function ListSkeleton() {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 size-4 animate-spin" />加载中…</div>
}
function Empty() {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无数据</div>
}
