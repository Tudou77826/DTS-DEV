import { useState } from "react"
import { Link as LinkIcon, Search, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Issue, IssueRelation, PageResult } from "@/lib/types"

export function RelationPanel({
  issueId,
  items,
  onChanged,
}: {
  issueId: number
  items: IssueRelation[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [results, setResults] = useState<Issue[]>([])
  const [targetId, setTargetId] = useState("")
  const [type, setType] = useState<"RELATED" | "DUPLICATE">("RELATED")

  const search = async () => {
    if (!keyword.trim()) return
    try {
      const page = await api.get<PageResult<Issue>>(`/issues?keyword=${encodeURIComponent(keyword)}&page=1&size=10`)
      setResults(page.list.filter((item) => item.id !== issueId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败")
    }
  }

  const create = async () => {
    if (!targetId) return toast.error("请选择关联问题")
    try {
      await api.post(`/issues/${issueId}/relations`, { targetIssueId: Number(targetId), relationType: type })
      toast.success("问题关联已创建")
      setOpen(false)
      setKeyword("")
      setResults([])
      setTargetId("")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "关联失败")
    }
  }

  const remove = async (relation: IssueRelation) => {
    if (!window.confirm(`确认移除与 ${relation.issueCode} 的关联？`)) return
    try {
      await api.del(`/issues/${issueId}/relations/${relation.id}`)
      toast.success("关联已移除")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败")
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">问题关联</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">标记相关问题或重复问题，减少重复排查</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><LinkIcon className="size-4" /> 添加关联</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加问题关联</DialogTitle>
                <DialogDescription>按问题编号或关键字搜索，再选择关联类型。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-2">
                  <Input value={keyword} onChange={(event) => setKeyword(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && search()} placeholder="例如 ISS-260729 或错误码" />
                  <Button type="button" variant="outline" onClick={search}><Search className="size-4" /> 搜索</Button>
                </div>
                {results.length > 0 && (
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="选择问题" /></SelectTrigger>
                    <SelectContent>
                      {results.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.code} · {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RELATED">相关问题</SelectItem>
                    <SelectItem value="DUPLICATE">重复问题</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                <Button onClick={create}>创建关联</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            暂无关联问题
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((relation) => (
              <div key={relation.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Badge variant={relation.relationType === "DUPLICATE" ? "destructive" : "secondary"}>
                  {relation.relationType === "DUPLICATE" ? "重复" : "相关"}
                </Badge>
                <Link to={`/issues/${relation.issueId}`} className="min-w-0 flex-1 hover:underline">
                  <div className="font-mono text-xs text-muted-foreground">{relation.issueCode}</div>
                  <div className="truncate text-sm">{relation.title}</div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => remove(relation)} title="移除关联">
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
