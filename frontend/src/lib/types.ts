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
  role: "SUBMITTER" | "DEVELOPER" | "LEADER"
  email?: string
  phone?: string
  avatarColor?: string
  active?: boolean
}

/** 认证方式：local = 本地账号密码；oauth = 反向代理注入用户头 */
export interface AuthMode {
  mode: "local" | "oauth"
  localLoginEnabled: boolean
}

export interface AdminVerifyResult {
  token: string
  expiresInMs: number
}

export interface Product { id: number; name: string; description?: string; active?: boolean }
export interface ProductVersion { id: number; productId?: number; version: string; description?: string; active?: boolean }
export interface ProductModule { id: number; productId?: number; name: string; description?: string; active?: boolean }
export interface IssueDomain { id: number; name: string; description?: string }
export interface Team { id: number; name: string; description?: string }

export interface Dictionaries {
  users: User[]
  developers: User[]
  teams: Team[]
  products: Product[]
  versions: ProductVersion[]
  modules: ProductModule[]
  domains: IssueDomain[]
  customization: DtsCustomization
}

export interface IssueFormFieldConfig {
  label: string
  placeholder?: string
  required: boolean
  visible: boolean
}

export interface DtsCustomization {
  profile: {
    id: string
    name: string
    targetTeam?: string
    targetSystem?: string
  }
  branding: {
    productName: string
    shortName: string
    loginTitle: string
    loginSubtitle: string
    primaryColor: string
    showDemoAccounts: boolean
    demoAccountHint: string
  }
  terminology: {
    issue: string
    product: string
    module: string
    version: string
    domain: string
    submitter: string
    assignee: string
  }
  roles: Array<{ value: string; label: string; color?: string }>
  /** 接入定制管理入口的共享管理员密码（BCrypt 哈希，不在页面回显） */
  admin?: {
    passwordHash?: string
  }
  issue: {
    code: { prefix: string; datePattern: string; sequenceDigits: number }
    defaultPriority: Priority
    priorities: Array<{ value: Priority; label: string; color?: string }>
    statuses: Array<{ value: IssueStatus; label: string; color?: string }>
    fields: Record<
      "title" | "description" | "module" | "product" | "domain" |
      "foundVersion" | "priority" | "vpnInfo" | "envInfo" |
      "expectedFinishAt" | "subModule",
      IssueFormFieldConfig
    >
    transitions: Partial<Record<IssueStatus, IssueStatus[]>>
  }
  masterData: {
    syncMode: string
    teams: Array<{
      key: string
      name: string
      description?: string
    }>
    users: Array<{
      employeeNo: string
      username: string
      displayName: string
      role: string
      team?: string
      avatarColor?: string
      active: boolean
    }>
    modules: string[]
    domains: Array<{ name: string; description?: string }>
  }
  features: Record<string, boolean>
  extensions: Record<string, unknown>
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
  subModule?: string
  dtsTicketNo?: string
  title: string
  description: string
  searchKeywords?: string
  envInfo?: string
  vpnInfo?: string
  domainId?: number
  domainName?: string
  productName?: string
  submitterId: number
  submitterName?: string
  submitterNo?: string
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
  expectedFinishAt?: string
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
  versionName: string
  investigatorId?: number
  status: string
  result?: string
  handlingNote?: string
  fixVersionName?: string
  verifyResult?: string
  completedAt?: string
  createdAt: string
}

export interface IssueAttachment {
  id: number
  issueId: number
  uploaderId: number
  uploaderName?: string
  sourceType: "ISSUE" | "COMMENT"
  sourceId?: number
  originalName: string
  contentType?: string
  fileSize: number
  createdAt: string
}

export interface IssueRelation {
  id: number
  issueId: number
  issueCode: string
  title: string
  description: string
  relationType: "RELATED" | "DUPLICATE"
  createdBy: number
  createdAt: string
}

export interface Notification {
  id: number
  userId: number
  type: string
  title: string
  content?: string
  link?: string
  readAt?: string
  createdAt: string
}

export interface BatchResult {
  succeeded: number
  failed: number
  errors: string[]
}
