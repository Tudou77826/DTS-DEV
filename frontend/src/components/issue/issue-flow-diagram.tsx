import { useId, type CSSProperties } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from "@/components/user-avatar"
import { useAiLocationView } from "@/hooks/use-ai-location-view"
import { useUsers } from "@/hooks/use-users"
import { PRIORITY_META, formatDuration } from "@/lib/labels"
import { StatusBadge } from "@/components/status-badge"
import type { Issue, OperationLog, Priority } from "@/lib/types"
import { buildIssueFlowModel } from "./issue-flow-model"
import {
  buildIssueFlowColumns, type FlowStation, type SpineInk,
  type SpineLampStatus, type SpineSection,
} from "./issue-flow-spine"

/*
 * 问题生命周期横向脊线——视觉体系移植自 ZCode `packages/ui` 的工作流侧栏脊线
 * （Apache-2.0）并把坐标系转置 90°：轨道横走、站按列排、分叉/合流是上下跨轨
 * 的 S 曲线。
 *
 *   提出 ── 分配 ──●─ 王五 ─ 赵六 ─●── 给出结论 ── 确认关闭
 *                  └─ AI 处理 ────┘
 *
 * 站灯词汇：空心 = 未到，绿 = 已过，红环 = 失败，琥珀带搏动 = 正在进行；
 * 行进段是 1.5px 的亮轨，沿控制流方向渐亮、在灯那一头最满，它不动——动作
 * 属于正在运行的灯（药丸 / AI 瓦片复用同一条 wf-lamp-running 心跳）。
 */

/** 主轨纵坐标；AI 分支轨再往下 AI_GAP。 */
const RAIL_Y = 21
const AI_GAP = 56
const AI_Y = RAIL_Y + AI_GAP
/** 站列宽 / 曲线列宽；灯在列内居中（左 33px），AI 瓦片宽 20px 同样居中。 */
const COL_W = 76
const CURVE_W = 24
const LAMP_X = (COL_W - 10) / 2
const TILE_X = (COL_W - 20) / 2

/** 站灯的状态词汇表（ZCode `run-status-presentation.ts` 的 STATUS_DOT，换成本仓库色板）。 */
const STATUS_DOT: Record<SpineLampStatus, string> = {
  done: "bg-[var(--wf-success)]",
  failed: "bg-[var(--wf-destructive)] ring-2 ring-[var(--wf-destructive)]/30",
  pending: "border-[1.5px] border-muted-foreground/50 bg-transparent",
  active: "animate-pulse bg-[var(--wf-warning)] motion-reduce:animate-none",
}

/** 轨道纵坐标（march 亮轨 1.5px，与 1px 细轨同心）。 */
function railTop(track: 0 | 1, ink: SpineInk): number {
  const y = track === 0 ? RAIL_Y : AI_Y
  return ink === "march" ? y - 0.75 : y - 0.5
}

/**
 * 横轨道段的一半：相邻两站之间的一段轨道拆成两截，上一站标记右到列右缘、下一站
 * 列左缘到标记左——两截同墨接在列边界上。`full` 整列穿过（主轨越过 AI 站、AI 轨
 * 穿过处理人列）。`march` 是 1.5px 的亮轨，渐变方向由 `data-rail-position` 选：
 * right（离开已过的灯）从透明涨到七成，left（进运行灯）从七成涨到满，full 整列
 * 平的七成。
 */
function SpineRail({ ink, position, track = 0 }: {
  ink: SpineInk
  position: "left" | "right" | "full"
  track?: 0 | 1
}) {
  const style: CSSProperties = { top: railTop(track, ink) }
  // 左右两截的让位宽度跟站标记走：主轨让给 10px 灯，AI 轨让给 20px 瓦片。
  const [markerLeft, markerRight] = track === 0 ? [LAMP_X, LAMP_X + 10] : [TILE_X, TILE_X + 20]
  if (position === "left") { style.left = 0; style.width = markerLeft + 0.5 }
  if (position === "right") { style.left = markerRight - 0.5; style.right = 0 }
  if (position === "full") { style.left = 0; style.right = 0 }
  return (
    <span
      aria-hidden
      className={[
        "wf-ink absolute rounded-full",
        ink === "march" ? "h-[1.5px]" : "h-px",
        ink !== "march" && "bg-muted-foreground/30",
        ink === "march" && "wf-spine-march",
      ].filter(Boolean).join(" ")}
      data-rail-ink={ink}
      data-rail-position={position}
      data-rail-track={track}
      style={style}
    />
  )
}

/** 行进边的光：1.5px 圆头路径叠 `userSpaceOnUse` 渐变——灯那一头最亮，朝控制流来的方向淡去。 */
function MarchLight({ d, from, id, to }: {
  d: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  id: string
}) {
  const alongY = from.x === to.x
  return (
    <>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={id}
          x1={alongY ? 0 : from.x}
          x2={alongY ? 0 : to.x}
          y1={alongY ? from.y : 0}
          y2={alongY ? to.y : 0}
        >
          <stop offset={0} stopColor="var(--wf-warning)" stopOpacity={0} />
          <stop offset={0.8} stopColor="var(--wf-warning)" />
        </linearGradient>
      </defs>
      <path className="wf-lit" d={d} fill="none" stroke={`url(#${id})`} />
    </>
  )
}

/** 分叉 / 合流曲线：AI 轨在分叉列离开主轨、在汇合列回到主轨的 S 弯。 */
function SpineCurve({ ink, kind }: { ink: SpineInk; kind: "fork" | "merge" }) {
  const lightId = useId()
  const path =
    kind === "fork"
      ? `M0,0 H1 C${CURVE_W / 2},0 ${CURVE_W / 2},${AI_GAP} ${CURVE_W},${AI_GAP}`
      : `M0,${AI_GAP} C${CURVE_W / 2},${AI_GAP} ${CURVE_W / 2},0 ${CURVE_W},0`
  const from = kind === "fork" ? { x: 0, y: 0 } : { x: 0, y: AI_GAP }
  const to = kind === "fork" ? { x: CURVE_W, y: AI_GAP } : { x: CURVE_W, y: 0 }
  return (
    <svg
      aria-hidden
      className="absolute left-0"
      data-curve-ink={ink}
      data-curve-kind={kind}
      height={AI_GAP}
      style={{ top: RAIL_Y }}
      viewBox={`0 0 ${CURVE_W} ${AI_GAP}`}
      width={CURVE_W}
    >
      <path d={path} fill="none" stroke="var(--wf-subtle)" strokeLinecap="round" strokeWidth={1} />
      {ink === "march" ? <MarchLight d={path} from={from} id={lightId} to={to} /> : null}
    </svg>
  )
}

function SpinePieces({ section }: { section: SpineSection }) {
  return (
    <>
      {section.rails.map((rail, index) => (
        <SpineRail key={`${rail.track}:${rail.position}:${index}`} {...rail} />
      ))}
      {section.curves.map((curve) => (
        <SpineCurve key={curve.kind} {...curve} />
      ))}
    </>
  )
}

/** 站灯：空心 = 未到，绿 = 已过，红环 = 失败，琥珀带搏动 = 正在进行。 */
function SpineLamp({ status, top }: { status: SpineLampStatus; top: number }) {
  return (
    <span
      aria-hidden
      className={[
        "wf-lamp absolute size-2.5 rounded-full",
        STATUS_DOT[status],
        status === "active" && "wf-lamp-running motion-reduce:animate-none",
      ].filter(Boolean).join(" ")}
      data-lamp={status}
      style={{ left: LAMP_X, top }}
    />
  )
}

/** AI 站的方形瓦片：骑在 AI 分支轨上（与灯同款语言），站名放轨下；颜色说「状态」。 */
function AiStationMarker({ station, top }: { station: FlowStation; top: number }) {
  return (
    <>
      <span
        className={[
          "flow-ai-tile wf-lamp absolute flex size-5 items-center justify-center rounded border text-[9px] font-bold",
          station.status === "active"
            ? "border-amber-300 bg-amber-50 text-amber-700 wf-lamp-running dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 motion-reduce:animate-none"
            : station.status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : station.status === "failed"
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                : "border-border bg-card text-muted-foreground",
        ].join(" ")}
        style={{ left: TILE_X, top }}
      >
        AI
      </span>
      <span
        className={[
          "flow-station-label absolute inset-x-0 top-[30px] truncate px-0.5 text-center text-xs",
          station.status === "pending" ? "text-muted-foreground" : "font-medium text-foreground",
        ].join(" ")}
      >
        {station.label}
      </span>
    </>
  )
}

/**
 * 站的可交互区：一个 62px 高的横带，装下自己轨道上的标记与轨道下的站名/小字，
 * 点击与悬停都落在这里。并行段（人工 ∥ AI）一列里有上下两个区，互不重叠。
 */
function StationZone({
  station, offsetY, onClick, title,
}: {
  station: FlowStation
  /** 区在列内的纵向偏移：主轨站 0，AI 站 62。区内坐标统一。 */
  offsetY: number
  onClick?: () => void
  title?: string
}) {
  const interactive = Boolean(onClick)
  return (
    <span
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      title={title}
      className={[
        "absolute inset-x-0 rounded-lg",
        interactive &&
          "station-clickable cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      ].filter(Boolean).join(" ")}
      style={{ top: offsetY, height: 62 }}
    >
      {station.kind === "ai" ? (
        <AiStationMarker station={station} top={AI_Y - 10 - offsetY} />
      ) : (
        <SpineLamp status={station.status} top={RAIL_Y - 5 - offsetY} />
      )}
      <span
        className={[
          "flow-station-label absolute inset-x-0 top-[30px] flex items-center justify-center gap-1 px-0.5 text-center text-xs",
          station.status === "pending" ? "text-muted-foreground" : "font-medium text-foreground",
        ].join(" ")}
      >
        {station.kind === "handler" && station.handler && (
          <UserAvatar name={station.handler.name} color={station.handler.color} className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{station.label}</span>
      </span>
      {station.detail && (
        <span
          className={[
            "absolute inset-x-0 top-[46px] truncate px-1 text-center text-[10px]",
            station.kind === "ai"
              ? station.status === "active"
                ? "text-amber-600 dark:text-amber-400"
                : station.status === "failed"
                  ? "text-red-600 dark:text-red-400"
                  : station.status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              : "text-muted-foreground",
          ].join(" ")}
          title={station.detail}
        >
          {station.kind === "ai" && station.openQuestions
            ? `${station.openQuestions} 条待补充 · ${station.detail}`
            : station.detail}
        </span>
      )}
    </span>
  )
}

export function IssueFlowDiagram({
  issue, ops, onStationClick, stationTitle,
}: {
  issue: Issue
  ops: OperationLog[]
  /** 点击站列的回调（切换下方职能 Tab 等）；未提供时站列纯展示。 */
  onStationClick?: (station: FlowStation) => void
  /** 站列悬停提示文案，与 onStationClick 同源。 */
  stationTitle?: (station: FlowStation) => string
}) {
  const users = useUsers()
  const { view, errorStatus } = useAiLocationView(issue.id)
  const model = buildIssueFlowModel({ issue, ops, users, aiView: view, aiErrorStatus: errorStatus })
  const columns = buildIssueFlowColumns({ issue, model })
  const priority = PRIORITY_META[issue.priority as Priority]
  const totalWidth = columns.reduce(
    (sum, column) => sum + (column.kind === "station" ? COL_W : CURVE_W), 0,
  )

  return (
    <Card>
      <CardContent className="p-4 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={issue.status} />
          <Badge variant="secondary" className={priority?.className}>
            {priority?.label}优先级
          </Badge>
          {issue.overdue && <Badge variant="destructive">已超期</Badge>}
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">责任人</span>
            {issue.assigneeName ? (
              <div className="flex items-center gap-1.5">
                <UserAvatar name={issue.assigneeName} color={issue.assigneeColor} className="size-5" />
                <span>{issue.assigneeName}</span>
              </div>
            ) : <span className="text-muted-foreground">未分配</span>}
          </div>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">
            定位时长 <span className="font-medium text-foreground">{formatDuration(issue.locateDurationMin)}</span>
          </span>
        </div>

        <div className="wf-motion mt-2 overflow-x-auto">
          <div className="relative flex h-[124px]" style={{ minWidth: totalWidth }}>
            {columns.map((column, index) => {
              const key =
                column.kind === "station" ? column.station.id
                : column.kind === "stacked" ? `stacked:${column.top.id}`
                : `${column.variant}Curve`
              return (
                <div
                  key={key}
                  className="wf-arrive relative h-full shrink-0"
                  style={{
                    width: column.kind === "curve" ? CURVE_W : COL_W,
                    animationDelay: `${Math.min(index * 24, 240)}ms`,
                  }}
                >
                  <SpinePieces section={column.spine} />
                  {column.kind === "station" && (
                    <StationZone
                      station={column.station}
                      offsetY={column.station.track === 1 ? 62 : 0}
                      onClick={onStationClick ? () => onStationClick(column.station) : undefined}
                      title={stationTitle?.(column.station)}
                    />
                  )}
                  {column.kind === "stacked" && (
                    <>
                      <StationZone
                        station={column.top}
                        offsetY={0}
                        onClick={onStationClick ? () => onStationClick(column.top) : undefined}
                        title={stationTitle?.(column.top)}
                      />
                      <StationZone
                        station={column.bottom}
                        offsetY={62}
                        onClick={onStationClick ? () => onStationClick(column.bottom) : undefined}
                        title={stationTitle?.(column.bottom)}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
