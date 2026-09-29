import type { FlowHandler } from "./issue-flow-model"
import type { Issue } from "@/lib/types"
import { formatShortDateTime } from "@/lib/labels"

/*
 * 问题流程图的横向脊线几何——视觉词汇移植自 ZCode
 * `packages/ui/app-shell/workflowRunSpine.ts`（Apache-2.0）并把坐标系转置 90°：
 * 轨道横走（主轨 y = 21，AI 轨 y = 21 + AI_GAP），站按列排布，分叉/合流曲线
 * 变成上下跨轨的 S 弯。与流程草图一致：人工处理链在主轨上串行，AI 处理
 * 从「分配」下方分叉、平行一段后在「给出结论」汇合。
 *
 * 纯函数、只有下标与像素偏移，没有 React、没有 DOM——渲染件照着画就行。
 */

export type SpineInk = "faint" | "strong" | "march"
export type SpineLampStatus = "done" | "active" | "pending" | "failed"

/** 一段横轨。`left` = 列左缘到站标记，`right` = 站标记到列右缘，`full` = 整列穿过。 */
export interface SpineRailPiece {
  track: 0 | 1
  ink: SpineInk
  position: "left" | "right" | "full"
}

/** 分支轨道离开 / 回到主轨的那段 S 曲线（画在专用的曲线列里）。 */
export interface SpineCurvePiece {
  kind: "fork" | "merge"
  ink: SpineInk
}

export interface SpineSection {
  rails: SpineRailPiece[]
  curves: SpineCurvePiece[]
}

export type FlowStationKind = "milestone" | "handler" | "ai"

export interface FlowStation {
  id: string
  kind: FlowStationKind
  /** 0 = 主轨（人工链在主轨上），1 = AI 分支轨 */
  track: 0 | 1
  label: string
  status: SpineLampStatus
  /** 站名下的小字：时间点 / 提出人等 */
  detail?: string
  /** handler 站的头像药丸 */
  handler?: FlowHandler
  /** AI 站的待补充提问数 */
  openQuestions?: number
}

export type FlowColumn =
  | { kind: "station"; station: FlowStation; spine: SpineSection }
  /** 并行段：人工站在上轨、AI 站在下轨，同一列一上一下。 */
  | { kind: "stacked"; top: FlowStation; bottom: FlowStation; spine: SpineSection }
  | { kind: "curve"; variant: "fork" | "merge"; spine: SpineSection }

const inkFor = (target: SpineLampStatus): SpineInk =>
  target === "active" ? "march" : target === "done" ? "strong" : "faint"

export function buildIssueFlowColumns(input: {
  issue: Issue
  model: {
    raised: { state: SpineLampStatus }
    assigned: { state: SpineLampStatus }
    handlers: FlowHandler[]
    ai: { state: string; detail: string; openQuestions: number }
    resolved: { state: SpineLampStatus }
    closed: { state: SpineLampStatus }
  }
}): FlowColumn[] {
  const { issue, model } = input

  const aiLamp: SpineLampStatus =
    model.ai.state === "completed" ? "done"
    : model.ai.state === "queued" || model.ai.state === "running" ? "active"
    : model.ai.state === "failed" ? "failed"
    : "pending"

  const aiStation: FlowStation = {
    id: "ai", kind: "ai", track: 1, label: "AI 处理", status: aiLamp,
    detail: model.ai.detail, openQuestions: model.ai.openQuestions,
  }

  // ---- 墨色：主轨各段边 + AI 分支轨的进/出墨 ----
  const e01 = inkFor(model.assigned.state)
  // 主轨穿过带：控制流只有到了结论才算走完「分配 → 给出结论」这一段。
  const mainThrough = inkFor(model.resolved.state)
  const eClose = inkFor(model.closed.state)
  const aiEntry = inkFor(aiLamp)
  const aiExit: SpineInk = mainThrough

  const empty = (): SpineSection => ({ rails: [], curves: [] })
  const columns: FlowColumn[] = []

  // 提出：只有右侧出去的边。
  columns.push({
    kind: "station",
    station: { id: "raised", kind: "milestone", track: 0, label: "提出", status: model.raised.state, detail: issue.submitterName ?? undefined },
    spine: { ...empty(), rails: [{ track: 0, ink: e01, position: "right" }] },
  })

  // 分配：左边进来，右边进入带（下一站是首个处理人或直接是 AI）。
  const afterAssign: SpineInk = model.handlers.length > 0 ? inkFor(model.handlers[0]!.state) : mainThrough
  columns.push({
    kind: "station",
    station: { id: "assigned", kind: "milestone", track: 0, label: "分配", status: model.assigned.state },
    spine: { ...empty(), rails: [{ track: 0, ink: e01, position: "left" }, { track: 0, ink: afterAssign, position: "right" }] },
  })

  // 分叉曲线列：主轨照常穿过，AI 轨从这里离开主轨。
  columns.push({
    kind: "curve",
    variant: "fork",
    spine: {
      rails: [{ track: 0, ink: afterAssign, position: "full" }],
      curves: [{ kind: "fork", ink: aiEntry }],
    },
  })

  // 人工处理链：主轨上的站。首个处理人与 AI 站一上一下叠在同一列
  // （并行关系，不是先后），AI 轨随后在其余处理人列下方穿过。
  model.handlers.forEach((handler, index) => {
    const next = model.handlers[index + 1]
    const handlerStation: FlowStation = {
      id: `handler:${handler.userId ?? index}`, kind: "handler", track: 0,
      label: handler.name, status: handler.state, handler,
    }
    const rails: SpineRailPiece[] = [
      { track: 0, ink: inkFor(handler.state), position: "left" },
      { track: 0, ink: next === undefined ? mainThrough : inkFor(next.state), position: "right" },
    ]
    if (index === 0) {
      rails.push({ track: 1, ink: aiEntry, position: "left" })
      rails.push({ track: 1, ink: aiExit, position: "right" })
      columns.push({
        kind: "stacked",
        top: handlerStation,
        bottom: aiStation,
        spine: { rails, curves: [] },
      })
    } else {
      rails.push({ track: 1, ink: aiExit, position: "full" })
      columns.push({
        kind: "station",
        station: handlerStation,
        spine: { rails, curves: [] },
      })
    }
  })

  // 无处理人（待分配）时 AI 独占一列：主轨从上方穿过，AI 轨左进右出。
  if (model.handlers.length === 0) {
    columns.push({
      kind: "station",
      station: aiStation,
      spine: {
        rails: [
          { track: 0, ink: mainThrough, position: "full" },
          { track: 1, ink: aiEntry, position: "left" },
          { track: 1, ink: aiExit, position: "right" },
        ],
        curves: [],
      },
    })
  }

  // 合流曲线列：AI 轨回到主轨，主轨继续进「给出结论」。
  columns.push({
    kind: "curve",
    variant: "merge",
    spine: {
      rails: [{ track: 0, ink: mainThrough, position: "full" }],
      curves: [{ kind: "merge", ink: aiExit }],
    },
  })

  // 给出结论：左边汇合进来，右边去往确认关闭。
  columns.push({
    kind: "station",
    station: { id: "resolved", kind: "milestone", track: 0, label: "给出结论", status: model.resolved.state, detail: issue.resolvedAt ? formatShortDateTime(issue.resolvedAt) : undefined },
    spine: { ...empty(), rails: [{ track: 0, ink: mainThrough, position: "left" }, { track: 0, ink: eClose, position: "right" }] },
  })

  // 确认关闭：末站，只有左边进来的边。
  columns.push({
    kind: "station",
    station: { id: "closed", kind: "milestone", track: 0, label: "确认关闭", status: model.closed.state, detail: issue.closedAt ? formatShortDateTime(issue.closedAt) : undefined },
    spine: { ...empty(), rails: [{ track: 0, ink: eClose, position: "left" }] },
  })

  return columns
}
