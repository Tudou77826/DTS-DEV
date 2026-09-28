import { api } from "./api"

export interface LocationSource {
  repositoryId?: string
  kind: "code" | "experience"
  label: string
  detail: string
}
export interface LocationLead {
  id: string
  title: string
  reason: string
  action: string
  sources: LocationSource[]
}
export interface LocationJob {
  id: string
  issueId: string
  issue?: {
    title?: string
    description?: string
    envInfo?: string
    moduleName?: string
    foundVersionName?: string
    submitterId?: number
    submitterName?: string
    assigneeId?: number
    assigneeName?: string
  }
  issueCode: string
  trigger: "auto" | "manual" | "answer" | "retry"
  status: "queued" | "running" | "completed" | "failed"
  phase: string
  createdAt: string
  startedAt?: string | null
  answers?: { question: string; answer: string }[]
  sessionId?: string | null
  execution?: { mode: string; agentProfile: string; settings: LocationSettings }
  completedAt?: string | null
  error?: string | null
  events?: { at: string; message: string }[]
  feedback: "helpful" | "partial" | "not_helpful" | null
  result: null | {
    summary: string
    leads: LocationLead[]
    missingInformation: string[]
    scope: string
  }
}
export interface LocationQuestion {
  id: string
  jobId: string
  issueId: string
  targetRole: "submitter" | "assignee"
  targetUserId: number
  text: string
  status: "open" | "answered"
  answer: string | null
  createdAt: string
}
export interface LocationIssueView {
  issueId: string
  jobs: LocationJob[]
  questions: LocationQuestion[]
  latest: LocationJob | null
}
export interface LocationOverview {
  sources: {
    id: string
    name: string
    kind: "code" | "experience"
    enabled: boolean
    label: string
    root: string
    status: string
    head?: string
    branch?: string
    lastFetchAt?: string | null
    checkedAt: string
  }[]
  load: {
    averageWaitSeconds: number | null
    p95WaitSeconds: number | null
    p95ExecutionSeconds: number | null
    oldestQueuedSeconds: number
    queueCapacity: number
    workerCapacity: number
    chrysRuns: number
    tokenUsage: number | null
    apiRetries: number | null
  }
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  awaitingAnswers: number
  answeredQuestions: number
  averageAnswerSeconds: number
  feedbackCount: number
  helpful: number
  partial: number
  notHelpful: number
  averageDurationSeconds: number
  mode: string
  agentProfile: string
  codeRoot: string
  knowledgeRoot: string
  daily: { date: string; total: number; failed: number }[]
}
export interface LocationSettings {
  autoEnabled: boolean
  maxConcurrent: number
  maxQueued: number
  cooldownSeconds: number
  timeoutSeconds: number
  maxQuestions: number
}
export const aiLocation = {
  issue: (id: number) =>
    api.get<LocationIssueView>(`/ai-location/issues/${id}`),
  run: (id: number) => api.post<LocationJob>(`/ai-location/issues/${id}/runs`),
  answer: (id: number, questionId: string, answer: string) =>
    api.post<LocationIssueView>(
      `/ai-location/issues/${id}/questions/${questionId}/answer`,
      { answer },
    ),
  feedback: (
    id: number,
    jobId: string,
    value: "helpful" | "partial" | "not_helpful",
  ) =>
    api.post<LocationJob>(`/ai-location/issues/${id}/jobs/${jobId}/feedback`, {
      value,
    }),
  overview: () => api.get<LocationOverview>("/ai-location/admin/overview"),
  settings: () => api.get<LocationSettings>("/ai-location/admin/settings"),
  updateSettings: (settings: LocationSettings) =>
    api.put<LocationSettings>("/ai-location/admin/settings", settings),
  jobs: () =>
    api.get<{ jobs: LocationJob[]; questions: LocationQuestion[] }>(
      "/ai-location/admin/jobs",
    ),
  retry: (id: string) =>
    api.post<LocationJob>(`/ai-location/admin/jobs/${id}/retry`),
}
