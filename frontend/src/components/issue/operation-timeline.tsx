import { Card, CardContent } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { formatDateTime } from "@/lib/labels"
import { useUsers } from "@/hooks/use-users"
import type { OperationLog } from "@/lib/types"

const ACTION_LABEL: Record<string, string> = {
  CREATE: "创建问题",
  STATUS: "状态变更",
  ASSIGNEE: "分配责任人",
  PRIORITY: "调整优先级",
  TRANSFER: "转派",
  REOPEN: "重新打开",
  ADD_VERSION: "添加版本排查",
  PROGRESS: "更新进展",
  COMMENT: "评论",
}

/**
 * 操作时间线列表。`bare` 模式去掉卡片外壳（标题行与边框），供抽屉等
 * 自带容器的宿主复用；默认自带 Card 外壳。
 */
export function OperationTimeline({ items, bare }: { items: OperationLog[]; bare?: boolean }) {
  const users = useUsers()

  const userName = (id: number) => users.find((u) => u.id === id)?.displayName || `用户${id}`
  const userColor = (id: number) => users.find((u) => u.id === id)?.avatarColor

  const reversed = [...items].reverse()

  const list = (
    <>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无操作记录</div>
      ) : (
        <div className="relative px-5 py-4">
          {reversed.map((op, idx) => (
            <div key={op.id} className="relative flex gap-3 pb-4 last:pb-0">
              {idx < reversed.length - 1 && (
                <span className="absolute left-[11px] top-7 h-full w-px bg-border" />
              )}
              <UserAvatar name={userName(op.operatorId)} color={userColor(op.operatorId)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{userName(op.operatorId)}</span>
                  <span className="text-muted-foreground">{ACTION_LABEL[op.action] || op.action}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {op.field && `${op.field}: `}
                  {op.oldValue && op.newValue
                    ? `${op.oldValue} → ${op.newValue}`
                    : op.newValue || op.oldValue || ""}
                  {op.remark ? ` · ${op.remark}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(op.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (bare) return <div className="pb-4">{list}</div>

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-5 py-3 text-sm font-medium">操作时间线</div>
        {list}
      </CardContent>
    </Card>
  )
}
