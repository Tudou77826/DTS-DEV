import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Check,
  CircleHelp,
  Clock3,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import {
  aiLocation,
  type LocationJob,
  type LocationQuestion,
} from "@/lib/ai-location"
import type { Issue } from "@/lib/types"
import { useAuth } from "@/store/auth"
import { useAiLocationView } from "@/hooks/use-ai-location-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

function statusText(job: LocationJob | null) {
  if (!job) return "等待自动分析"
  if (job.status === "failed") return "分析失败"
  if (job.status === "completed") return "已形成定位建议"
  return job.phase
}

export function AiLocationIndicator({ issueId }: { issueId: number }) {
  const { view } = useAiLocationView(issueId)
  const pending =
    view?.questions.filter((question) => question.status === "open").length ?? 0
  return pending > 0 ? (
    <span
      role="status"
      aria-label={`${pending} 条信息等待补充`}
      title={`${pending} 条信息等待补充`}
      className="size-2 shrink-0 rounded-full bg-red-500"
    />
  ) : null
}

export function AiLocationPanel({ issue }: { issue: Issue }) {
  const [searchParams] = useSearchParams()
  const focusedQuestionId = searchParams.get("aiQuestion")
  const scrolledQuestion = useRef<string | null>(null)
  const user = useAuth((state) => state.user)
  const { view, refresh, error: viewError } = useAiLocationView(issue.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const displayError = error || viewError
  useEffect(() => {
    if (!view) return
    setSelectedId((current) =>
      current && view.jobs.some((job) => job.id === current)
        ? current
        : view.latest?.id || null,
    )
  }, [view])
  useEffect(() => {
    if (
      !focusedQuestionId ||
      scrolledQuestion.current === focusedQuestionId ||
      !view?.questions.some((question) => question.id === focusedQuestionId)
    )
      return
    document
      .getElementById(`ai-question-${focusedQuestionId}`)
      ?.scrollIntoView({ block: "center" })
    scrolledQuestion.current = focusedQuestionId
  }, [focusedQuestionId, view])
  const selected = view?.jobs.find((job) => job.id === selectedId) || null
  const active = selected?.status === "queued" || selected?.status === "running"
  const run = async () => {
    setBusy(true)
    try {
      const job = await aiLocation.run(issue.id)
      setSelectedId(job.id)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法启动分析")
    } finally {
      setBusy(false)
    }
  }
  const feedback = async (value: "helpful" | "partial" | "not_helpful") => {
    if (!selected) return
    try {
      await aiLocation.feedback(issue.id, selected.id, value)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "反馈未保存")
    }
  }
  return (
    <div className="space-y-4">
      <Card className="border-teal-200 dark:border-teal-900">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-teal-700 text-white">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">AI 辅助定位</h3>
              <p className="text-xs text-muted-foreground">
                问题创建后自动分析；这里持续展示进展和待补充信息
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={run}
            disabled={busy || active}
          >
            <RotateCcw className="size-3.5" />
            手动重新分析
          </Button>
        </CardContent>
      </Card>
      {displayError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}
      {view?.questions && view.questions.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CircleHelp className="size-4 text-amber-600" />
              待补充的信息
            </h4>
            {view.questions.map((question) => (
              <QuestionRow
                key={question.id}
                issueId={issue.id}
                targetName={resolveTargetName(question, issue, view.jobs)}
                question={question}
                currentUserId={user?.id}
                highlighted={question.id === focusedQuestionId}
                onAnswered={refresh}
              />
            ))}
          </CardContent>
        </Card>
      )}
      {view?.jobs && view.jobs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">分析记录</span>
          {view.jobs.map((job, index) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedId(job.id)}
              className={`rounded-md border px-2.5 py-1.5 ${job.id === selectedId ? "border-teal-500 bg-teal-50 text-teal-800" : "border-border hover:bg-muted"}`}
            >
              第 {view.jobs.length - index} 次 ·{" "}
              {job.trigger === "answer"
                ? "补充后续跑"
                : job.trigger === "auto"
                  ? "自动"
                  : "手动"}
            </button>
          ))}
        </div>
      )}
      {!selected && !displayError && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            等待自动分析启动…
          </CardContent>
        </Card>
      )}
      {selected && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-sm font-semibold">定位进展与建议</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(selected.createdAt).toLocaleString("zh-CN")} ·{" "}
                  {selected.trigger === "auto"
                    ? "自动触发"
                    : selected.trigger === "answer"
                      ? "收到补充后继续"
                      : "人工触发"}
                </p>
              </div>
              <span className="text-xs text-teal-700">
                {statusText(selected)}
              </span>
            </div>
            {selected.events && selected.events.length > 0 && (
              <ol className="space-y-1 border-b py-4 text-xs text-muted-foreground">
                {selected.events.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="flex gap-3">
                    <span className="shrink-0">
                      {new Date(event.at).toLocaleTimeString("zh-CN")}
                    </span>
                    <span>{event.message}</span>
                  </li>
                ))}
              </ol>
            )}
            {active && (
              <div className="flex items-center gap-3 py-8 text-sm">
                <Loader2 className="size-4 animate-spin text-teal-700" />
                {selected.phase}
              </div>
            )}
            {selected.status === "failed" && (
              <div className="py-6 text-sm text-red-700">
                {selected.error || "分析失败，可手动重试"}
              </div>
            )}
            {selected.result && (
              <div className="space-y-5 pt-5">
                <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
                  <p className="mb-1 text-xs font-medium text-teal-800">
                    当前判断
                  </p>
                  <p className="text-sm leading-6">{selected.result.summary}</p>
                </div>
                {selected.result.leads.length > 0 && (
                  <section>
                    <h4 className="mb-3 text-sm font-semibold">建议优先核查</h4>
                    <div className="space-y-3">
                      {selected.result.leads.map((lead, index) => (
                        <div key={lead.id} className="rounded-lg border p-4">
                          <h5 className="text-sm font-medium">
                            {index + 1}. {lead.title}
                          </h5>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {lead.reason}
                          </p>
                          <p className="mt-2 text-sm">
                            <strong>下一步：</strong>
                            {lead.action}
                          </p>
                          {lead.sources.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              依据：
                              {lead.sources
                                .map(
                                  (source) =>
                                    `${source.label}（${source.detail}）`,
                                )
                                .join("；")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {selected.result.missingInformation.length > 0 && (
                  <section className="rounded-lg border bg-muted/25 p-4">
                    <h4 className="text-sm font-medium">仍需确认</h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {selected.result.missingInformation.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <span className="text-sm">这次建议是否有帮助？</span>
                  <div className="flex gap-2">
                    {(["helpful", "partial", "not_helpful"] as const).map(
                      (value) => (
                        <Button
                          key={value}
                          size="xs"
                          variant={
                            selected.feedback === value ? "default" : "outline"
                          }
                          onClick={() => void feedback(value)}
                        >
                          {value === "helpful"
                            ? "有帮助"
                            : value === "partial"
                              ? "部分有帮助"
                              : "无帮助"}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
                <p className="flex items-start gap-1 text-xs text-amber-700">
                  <Clock3 className="mt-0.5 size-3.5" />
                  {selected.result.scope}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function resolveTargetName(
  question: LocationQuestion,
  issue: Issue,
  jobs: LocationJob[],
) {
  const snapshots = [
    issue,
    ...jobs.map((job) => job.issue).filter((snapshot) => snapshot != null),
  ]
  for (const snapshot of snapshots) {
    if (
      Number(snapshot.submitterId) === question.targetUserId &&
      snapshot.submitterName
    )
      return snapshot.submitterName
    if (
      Number(snapshot.assigneeId) === question.targetUserId &&
      snapshot.assigneeName
    )
      return snapshot.assigneeName
  }
  return `用户 ${question.targetUserId}`
}

function QuestionRow({
  issueId,
  targetName,
  question,
  currentUserId,
  highlighted,
  onAnswered,
}: {
  issueId: number
  targetName: string
  question: LocationQuestion
  currentUserId?: number
  highlighted: boolean
  onAnswered: () => Promise<void>
}) {
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const mine = currentUserId === question.targetUserId
  const submit = async () => {
    if (!answer.trim()) return
    setBusy(true)
    try {
      await aiLocation.answer(issueId, question.id, answer.trim())
      setAnswer("")
      await onAnswered()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "回答未保存")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      id={`ai-question-${question.id}`}
      className={`rounded-lg border p-4 ${highlighted ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-blue-600 dark:text-blue-400">
          @{targetName}
        </span>
        <span className="text-muted-foreground">{question.text}</span>
        {question.status === "answered" && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700">
            <Check className="size-3" />
            已回答
          </span>
        )}
      </div>
      {question.answer && (
        <p className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
          {question.answer}
        </p>
      )}
      {question.status === "open" && mine && (
        <div className="mt-3 space-y-2">
          <Textarea
            aria-label="补充回答"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            maxLength={3000}
            placeholder="补充具体时间、请求 ID、日志线索或排查结果…"
            className="min-h-16"
          />
          <Button size="sm" onClick={submit} disabled={busy || !answer.trim()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            提交补充并继续分析
          </Button>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  )
}
