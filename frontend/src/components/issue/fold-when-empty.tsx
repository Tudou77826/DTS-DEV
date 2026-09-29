import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/**
 * 空态自动折叠的面板包装：count 为 0 时收起成一行细条（标题 + 计数 + 说明），
 * 点击展开完整面板；一旦有内容自动展开、清空后自动收回。大概率 为空的板块
 * （附件、关联）不该常驻占版面。
 */
export function FoldWhenEmpty({
  title, count, hint, children,
}: {
  title: string
  count: number
  hint: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(count > 0)
  useEffect(() => { setOpen(count > 0) }, [count])

  if (open) return <>{children}</>
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-medium">{title}</span>
        <Badge variant="secondary" className="shrink-0">{count}</Badge>
        <span className="truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
