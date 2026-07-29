// ─── 后端响应 ───────────────────────────────────
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

// ─── 字典 ───────────────────────────────────────
export interface User {
  id: number
  employeeNo: string
  username: string
  displayName: string
  role: "SUBMITTER" | "DEVELOPER" | "LEADER" | "ADMIN"
  email?: string
  phone?: string
  avatarColor?: string
  active?: boolean
}

export interface Product { id: number; name: string; description?: string; active?: boolean }
export interface ProductModule { id: number; productId?: number; name: string; description?: string; active?: boolean }
export interface ProductVersion { id: number; productId?: number; version: string; description?: string; active?: boolean }
export interface IssueDomain { id: number; name: string; description?: string }
export interface Team { id: number; name: string; description?: string }

export interface Dictionaries {
  users: User[]
  developers: User[]
  teams: Team[]
  products: Product[]
  modules: ProductModule[]
  versions: ProductVersion[]
  domains: IssueDomain[]
}

// ─── 问题 ───────────────────────────────────────
export type IssueStatus =
  | "PENDING_ASSIGN" | "PENDING_LOCATE" | "LOCATING" | "PENDING_VERIFY"
  | "RESOLVED" | "CLOSED" | "NEED_INFO" | "DEFERRED"
  | "CANNOT_REPRODUCE" | "WONT_FIX" | "REOPENED"

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface Issue {
  id: number
  code: string
  raisedAt: string
  createdAt: string
  updatedAt: string
  moduleId?: number
  moduleName?: string
  description: string
  searchKeywords?: string
  envInfo?: string
  vpnInfo?: string
  domainId?: number
  domainName?: string
  productId?: number
  productName?: string
  submitterId: number
  submitterName?: string
  submitterNo?: string
  foundVersionId?: number
  foundVersionName?: string
  priority: Priority
  status: IssueStatus
  assigneeId?: number
  assigneeName?: string
  assigneeColor?: string
  collaboratorIds?: number[]
  collaboratorNames?: string[]
  latestProgress?: string
  rootCause?: string
  resolution?: string
  workaround?: string
  planFinishAt?: string
  locatedAt?: string
  resolvedAt?: string
  closedAt?: string
  locateDurationMin?: number
  overdue?: boolean
}

export interface IssueProgress {
  id: number
  issueId: number
  authorId: number
  type: string
  content: string
  createdAt: string
}

export interface Comment {
  id: number
  issueId: number
  authorId: number
  content: string
  mentionIds?: string
  createdAt: string
}

export interface OperationLog {
  id: number
  issueId: number
  operatorId: number
  action: string
  field?: string
  oldValue?: string
  newValue?: string
  remark?: string
  createdAt: string
}

export interface VersionInvestigation {
  id: number
  issueId: number
  versionId: number
  investigatorId?: number
  status: string
  result?: string
  handlingNote?: string
  fixVersionId?: number
  verifyResult?: string
  completedAt?: string
  createdAt: string
}
