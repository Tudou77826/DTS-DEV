import { Badge } from "@/components/ui/badge"
import { STATUS_META } from "@/lib/labels"
import type { IssueStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-secondary", dot: "#a1a1a1" }
  return (
    <Badge variant="secondary" className={cn(meta.className, "gap-1.5", className)}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.dot }} />
      {meta.label}
    </Badge>
  )
}
