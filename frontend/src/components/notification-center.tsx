import { useCallback, useEffect, useState } from "react"
import { Bell, CheckCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateTime } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { Notification } from "@/lib/types"

export function NotificationCenter({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [count, setCount] = useState(0)

  const loadCount = useCallback(() => {
    api.get<{ count: number }>("/notifications/unread-count")
      .then((result) => setCount(result.count))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    loadCount()
    const timer = window.setInterval(loadCount, 60_000)
    return () => window.clearInterval(timer)
  }, [loadCount])

  const loadItems = () => {
    api.get<Notification[]>("/notifications").then(setItems).catch(() => undefined)
  }

  const open = async (item: Notification) => {
    if (!item.readAt) {
      await api.patch(`/notifications/${item.id}/read`)
      setCount((value) => Math.max(0, value - 1))
    }
    if (item.link) navigate(item.link)
  }

  const readAll = async () => {
    await api.patch("/notifications/read-all")
    setCount(0)
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
  }

  return (
    <DropdownMenu onOpenChange={(openState) => openState && loadItems()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("relative w-full justify-start gap-2", collapsed && "justify-center px-0")} title={collapsed ? "站内通知" : undefined}>
          <Bell className="size-4 shrink-0" />
          {!collapsed && "站内通知"}
          {count > 0 && (
            <span className={cn("flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground", !collapsed && "ml-auto")}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="px-0">站内通知</DropdownMenuLabel>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={readAll}>
              <CheckCheck className="size-3.5" /> 全部已读
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无通知</div>
          ) : items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={cn("block cursor-pointer px-3 py-2.5", !item.readAt && "bg-primary/5")}
              onSelect={() => open(item)}
            >
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  {item.content && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.content}</div>}
                  <div className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
