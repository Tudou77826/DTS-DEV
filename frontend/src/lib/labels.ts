import type { DtsCustomization, IssueStatus, Priority } from "./types"

export const STATUS_META: Record<IssueStatus, { label: string; className: string; dot: string }> = {
  PENDING_ASSIGN: { label: "待分配", className: "bg-secondary text-secondary-foreground", dot: "#a1a1a1" },
  PENDING_HANDLE: { label: "待处理", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", dot: "#f59e0b" },
  PROCESSING: { label: "处理中", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", dot: "#3b82f6" },
  RESOLVED: { label: "已解决", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "#10b981" },
  CLOSED: { label: "已关闭", className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", dot: "#71717a" },
}

export const ISSUE_FLAG_LABEL: Record<string, string> = {
  PROBLEM: "是问题",
  NON_PROBLEM: "非问题",
}

export const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  LOW: { label: "低", className: "bg-secondary text-muted-foreground" },
  MEDIUM: { label: "中", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  HIGH: { label: "高", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  URGENT: { label: "紧急", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
}

export const INVESTIGATION_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待排查", className: "bg-secondary text-secondary-foreground" },
  INVESTIGATING: { label: "排查中", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  HAS_ISSUE: { label: "存在问题", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  NO_ISSUE: { label: "不存在问题", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  FIXED: { label: "已修复", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  UNCONFIRMED: { label: "无法确认", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
}

export const PROGRESS_TYPE_LABEL: Record<string, string> = {
  PROGRESS: "定位进展",
  BLOCKER: "遇到的阻塞",
  NEXT_STEP: "下一步计划",
  ROOT_CAUSE: "根本原因",
  WORKAROUND: "临时规避方案",
  RESOLUTION: "正式处理方案",
  VERIFY: "验证结论",
}

export const ROLE_LABEL: Record<string, string> = {
  SUBMITTER: "问题提出人",
  DEVELOPER: "开发人员",
  LEADER: "项目负责人",
}

export function applyCustomizationLabels(config: DtsCustomization) {
  for (const status of config.issue.statuses) {
    const current = STATUS_META[status.value]
    if (current) current.label = status.label
  }
  for (const priority of config.issue.priorities) {
    const current = PRIORITY_META[priority.value]
    if (current) current.label = priority.label
  }
  for (const role of config.roles) ROLE_LABEL[role.value] = role.label
}

export function statusLabel(s: string) {
  return STATUS_META[s as IssueStatus]?.label ?? s
}
export function priorityLabel(p: string) {
  return PRIORITY_META[p as Priority]?.label ?? p
}

export function formatDateTime(s?: string) {
  if (!s) return "-"
  const d = new Date(s)
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function formatDuration(min?: number) {
  if (!min && min !== 0) return "-"
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function formatFileSize(bytes?: number) {
  if (bytes === undefined || bytes === null) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
