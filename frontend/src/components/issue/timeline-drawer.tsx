import { useEffect, useState } from "react"
import { History, X } from "lucide-react"
import { OperationTimeline } from "./operation-timeline"
import type { OperationLog } from "@/lib/types"

/**
 * 屏幕右缘的操作时间线抽屉：平时收成一条贴边的竖向把手（不占版面），
 * 展开为全高面板；Esc 或 × 收回。时间线很长也不再把侧栏顶出屏幕。
 */
export function TimelineDrawer({
  items, topOffset = 84,
}: {
  items: OperationLog[]
  /** 抽屉与把手的顶边（页面标题栏下沿），由宿主页面测量传入——抽屉不感知页面布局。 */
  topOffset?: number
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {/* 收纳把手：贴屏幕右缘，竖排文字 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "收起操作时间线" : "展开操作时间线"}
        className="fixed right-0 z-40 flex items-center gap-1 rounded-l-lg border border-r-0 border-border bg-card px-1.5 py-3 text-xs text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        style={{ writingMode: "vertical-rl", top: topOffset + 12 }}
      >
        <History className="size-3.5" style={{ writingMode: "horizontal-tb" }} />
        操作时间线
      </button>

      {/* 抽屉面板：不铺遮罩，展开时页面其余部分仍可交互 */}
      <div
        className={[
          "fixed right-0 bottom-0 z-50 w-80 max-w-[85vw] border-l border-border bg-card shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
        style={{ top: topOffset }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4 text-muted-foreground" />
            操作时间线
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="收起"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="h-[calc(100%-45px)] overflow-y-auto">
          <OperationTimeline items={items} bare />
        </div>
      </div>
    </>
  )
}
