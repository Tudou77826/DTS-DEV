import type { Issue, IssueStatus, OperationLog, User } from "@/lib/types"
import type { LocationIssueView } from "@/lib/ai-location"

export type FlowLampState = "done" | "active" | "pending"

export interface FlowLamp {
  state: FlowLampState
}

/** 人工处理链上的一环（一次分配/改派产生一个节点） */
export interface FlowHandler {
  userId: number | null
  name: string
  color?: string
  state: FlowLampState
}

export type FlowAiState =
  | "idle" | "queued" | "running" | "completed" | "failed"
  | "forbidden" | "unavailable"

export interface FlowAiTrack {
  state: FlowAiState
  /** 主标签，如「AI 处理」 */
  label: string
  /** 状态说明，如「定位中」「已形成定位建议」 */
  detail: string
  /** 等待回答的 AI 提问数 */
  openQuestions: number
}

export interface IssueFlowModel {
  raised: FlowLamp
  assigned: FlowLamp
  /** 按时间顺序的人工处理人链；最后一环为当前责任人 */
  handlers: FlowHandler[]
  ai: FlowAiTrack
  resolved: FlowLamp
  closed: FlowLamp
  status: IssueStatus
}

const AI_STATE_DETAIL: Record<FlowAiState, string> = {
  idle: "未启动",
  queued: "排队中",
  running: "定位中",
  completed: "已形成定位建议",
  failed: "分析失败",
  forbidden: "无使用权限",
  unavailable: "服务不可用",
}

/**
 * AI 定位任务的最新状态：以最近一次任务为准；有未关闭提问时在 detail 之外
 * 保留 openQuestions 供节点展示角标。错误按 HTTP 状态分类：403 视为无权限，
 * 其余视为服务异常。
 */
export function deriveAiTrack(
  view: LocationIssueView | null,
  errorStatus: number | null,
): FlowAiTrack {
  const openQuestions = view?.questions.filter((question) => question.status === "open").length ?? 0
  let state: FlowAiState
  if (!view && errorStatus !== null) {
    state = errorStatus === 403 ? "forbidden" : "unavailable"
  } else if (!view || view.jobs.length === 0) state = "idle"
  else {
    const latest = view.latest ?? view.jobs[0]
    state = latest.status
  }
  return { state, label: "AI 处理", detail: AI_STATE_DETAIL[state], openQuestions }
}

/** 人工处理链：ASSIGNEE 日志按时间正序去重连续重复人；末尾对齐当前责任人。 */
export function deriveHandlerChain(
  issue: Issue,
  ops: OperationLog[],
  users: User[],
): FlowHandler[] {
  const asc = [...ops].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id - b.id : a.createdAt.localeCompare(b.createdAt),
  )
  const userIds: number[] = []
  for (const op of asc) {
    if (op.action !== "ASSIGNEE" || !op.newValue) continue
    const id = Number(op.newValue)
    if (!Number.isFinite(id)) continue
    if (userIds[userIds.length - 1] === id) continue
    userIds.push(id)
  }
  // 操作日志可能落后于权威数据：末尾对齐当前责任人。
  if (issue.assigneeId && userIds[userIds.length - 1] !== issue.assigneeId) {
    userIds.push(issue.assigneeId)
  }

  const terminal = issue.status === "RESOLVED" || issue.status === "CLOSED"
  return userIds.map((userId, index) => {
    const user = users.find((u) => u.id === userId)
    const isLast = index === userIds.length - 1
    return {
      userId,
      name: user?.displayName ?? issue.assigneeName ?? `用户${userId}`,
      color: user?.avatarColor,
      state: !isLast ? "done" : terminal ? "done" : issue.status === "PENDING_HANDLE" || issue.status === "PROCESSING" ? "active" : "pending",
    }
  })
}

/**
 * 问题生命周期 → 流程图模型。
 *
 * 主线：提出 → 分配 →（人工处理链 ∥ AI 处理）→ 给出结论 → 确认关闭。
 * 节点状态只由问题状态机（IssueStatus）与 AI 定位任务状态驱动，不感知渲染。
 */
export function buildIssueFlowModel(input: {
  issue: Issue
  ops: OperationLog[]
  users: User[]
  aiView: LocationIssueView | null
  aiErrorStatus: number | null
}): IssueFlowModel {
  const { issue, ops, users, aiView, aiErrorStatus } = input
  const handlers = deriveHandlerChain(issue, ops, users)

  const assignedDone = Boolean(issue.assigneeId) || handlers.length > 0 ||
    issue.status !== "PENDING_ASSIGN"

  return {
    raised: { state: "done" },
    assigned: { state: assignedDone ? "done" : "active" },
    handlers,
    ai: deriveAiTrack(aiView, aiErrorStatus),
    resolved: {
      state: issue.status === "CLOSED" ? "done" : issue.status === "RESOLVED" ? "active" : "pending",
    },
    closed: { state: issue.status === "CLOSED" ? "done" : "pending" },
    status: issue.status,
  }
}
