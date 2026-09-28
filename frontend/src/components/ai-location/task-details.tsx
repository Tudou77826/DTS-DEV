import type { LocationJob, LocationQuestion } from "@/lib/ai-location"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Link } from "react-router-dom"
import { date, trigger, jobStatus, plainText } from "./labels"
import { Detail } from "./presentation"

export function TaskDetails({
  job,
  questions,
  onClose,
}: {
  job: LocationJob | null
  questions: LocationQuestion[]
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!job}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        {job && (
          <>
            <DialogTitle>
              分析任务详情 · {job.issueCode || job.issueId}
            </DialogTitle>
            <DialogDescription>
              {job.issue?.title || "问题定位任务"} · {jobStatus(job.status)}
            </DialogDescription>
            <Link
              to={`/issues/${job.issueId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              打开问题
            </Link>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Detail label="触发方式" value={trigger(job.trigger)} />
              <Detail label="提交时间" value={date(job.createdAt)} />
              <Detail label="开始时间" value={date(job.startedAt)} />
              <Detail label="完成时间" value={date(job.completedAt)} />
              <Detail
                label="反馈"
                value={
                  job.feedback === "helpful"
                    ? "有帮助"
                    : job.feedback === "partial"
                      ? "部分有帮助"
                      : job.feedback === "not_helpful"
                        ? "无帮助"
                        : "未反馈"
                }
              />
              <Detail
                label="运行模式"
                value={job.execution?.mode || "历史任务未记录"}
              />
            </dl>
            <section className="space-y-2 rounded-md border p-4">
              <h4 className="text-sm font-semibold">分析时的问题快照</h4>
              <p className="whitespace-pre-wrap break-words text-sm">
                {plainText(job.issue?.description) || "未填写描述"}
              </p>
              <p className="text-xs text-muted-foreground">
                环境：{plainText(job.issue?.envInfo) || "未填写"} · 版本：
                {job.issue?.foundVersionName || "未填写"} · 模块：
                {job.issue?.moduleName || "未填写"}
              </p>
              {job.answers?.map((answer, index) => (
                <p key={index} className="text-sm">
                  补充：{answer.question} — {answer.answer}
                </p>
              ))}
            </section>
            <section>
              <h4 className="mb-2 text-sm font-semibold">执行进展</h4>
              <ol className="space-y-2 text-sm">
                {job.events?.map((event, index) => (
                  <li key={index}>
                    <span className="mr-3 text-xs text-muted-foreground">
                      {date(event.at)}
                    </span>
                    {event.message}
                  </li>
                ))}
              </ol>
              {job.error && (
                <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {job.error}
                </p>
              )}
            </section>
            {job.result && (
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">定位结果</h4>
                <p className="text-sm">{job.result.summary}</p>
                {job.result.leads.map((lead) => (
                  <div key={lead.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{lead.title}</p>
                    <p className="mt-1 text-muted-foreground">{lead.reason}</p>
                    <p className="mt-2">建议：{lead.action}</p>
                    {lead.sources.map((source, index) => (
                      <p
                        key={index}
                        className="mt-1 break-all text-xs text-muted-foreground"
                      >
                        依据：{source.label} · {source.detail}
                      </p>
                    ))}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {job.result.scope}
                </p>
              </section>
            )}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">本次产生的提问</h4>
              {questions.filter((question) => question.jobId === job.id)
                .length === 0 && (
                <p className="text-sm text-muted-foreground">无提问记录</p>
              )}
              {questions
                .filter((question) => question.jobId === job.id)
                .map((question) => (
                  <div
                    key={question.id}
                    className="rounded-md border p-3 text-sm"
                  >
                    <p>
                      {question.text} ·{" "}
                      {question.status === "answered" ? "已回答" : "待补充"}
                    </p>
                    {question.answer && (
                      <p className="mt-2 text-muted-foreground">
                        回答：{question.answer}
                      </p>
                    )}
                  </div>
                ))}
            </section>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">
                运行配置与追踪信息
              </summary>
              <div className="mt-3 space-y-2 break-all text-muted-foreground">
                <p>任务 ID：{job.id}</p>
                <p>Chrys 会话：{job.sessionId || "未记录 / Mock 不产生会话"}</p>
                <p>Agent：{job.execution?.agentProfile || "历史任务未记录"}</p>
                {job.execution && (
                  <p>
                    并发 {job.execution.settings.maxConcurrent} · 排队上限{" "}
                    {job.execution.settings.maxQueued} · 冷却{" "}
                    {job.execution.settings.cooldownSeconds} 秒 · 超时{" "}
                    {job.execution.settings.timeoutSeconds} 秒 · 提问上限{" "}
                    {job.execution.settings.maxQuestions}
                  </p>
                )}
                <p>模型用量：未采集</p>
              </div>
            </details>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
