import { RepositoryManager } from "./repository-manager"
import { TaskDetails } from "./task-details"
import { seconds, date, shortDate, trigger, jobStatus } from "./labels"
import { CompactDetail } from "./presentation"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Bot,
  Clock3,
  HelpCircle,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react"
import {
  aiLocation,
  type LocationQuestion,
  type LocationJob,
  type LocationOverview,
  type LocationSettings,
} from "@/lib/ai-location"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function AiLocationAdminPanel() {
  const [overview, setOverview] = useState<LocationOverview | null>(null)
  const [settings, setSettings] = useState<LocationSettings | null>(null)
  const [jobs, setJobs] = useState<LocationJob[]>([])
  const [questions, setQuestions] = useState<LocationQuestion[]>([])
  const [selected, setSelected] = useState<LocationJob | null>(null)
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const load = async () => {
    setLoading(true)
    try {
      const [summary, configuration, recent] = await Promise.all([
        aiLocation.overview(),
        aiLocation.settings(),
        aiLocation.jobs(),
      ])
      setOverview(summary)
      setSettings(configuration)
      setJobs(recent.jobs)
      setQuestions(recent.questions)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "管理数据加载失败")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    if (!overview?.sources.some((source) => source.status === "checking"))
      return
    let live = true
    const timer = window.setTimeout(() => {
      void aiLocation
        .overview()
        .then((next) => {
          if (live) setOverview(next)
        })
        .catch(() => {
          /* Manual refresh remains available. */
        })
    }, 1500)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [overview])
  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      setSettings(await aiLocation.updateSettings(settings))
      toast.success("AI 定位参数已保存")
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }
  const retry = async (id: string) => {
    try {
      await aiLocation.retry(id)
      toast.success("已加入重试队列")
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "重试失败")
    }
  }
  const visibleJobs = jobs.filter(
    (job) =>
      (filter === "all" || job.status === filter) &&
      `${job.issueCode} ${job.issue?.title || ""} ${job.issueId}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const selectedJob = jobs.find((job) => job.id === selected?.id) || selected
  if (loading && !overview)
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在读取定位服务…
      </div>
    )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          AI 定位运行情况{" "}
          <span className="ml-2 font-normal text-xs text-muted-foreground">
            {overview?.mode === "mock" ? "Mock 演示" : "Chrys"} ·{" "}
            {overview?.agentProfile}
          </span>
        </h2>
        <Button
          variant="outline"
          size="xs"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {overview && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              icon={<Bot className="size-3.5" />}
              label="累计分析"
              value={overview.total}
              detail={`完成 ${overview.completed} · 失败 ${overview.failed}`}
            />
            <Metric
              icon={<Clock3 className="size-3.5" />}
              label="处理中"
              value={overview.queued + overview.running}
              detail={`排队 ${overview.queued} · 执行 ${overview.running}`}
            />
            <Metric
              icon={<HelpCircle className="size-3.5" />}
              label="待补充"
              value={overview.awaitingAnswers}
              detail={`已答 ${overview.answeredQuestions} · 平均 ${overview.averageAnswerSeconds}s`}
            />
            <Metric
              icon={<AlertTriangle className="size-3.5" />}
              label="效果反馈"
              value={overview.feedbackCount}
              detail={`有帮助 ${overview.helpful} · 部分 ${overview.partial} · 无帮助 ${overview.notHelpful}`}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold">近七天分析量</h3>
                  <span className="text-[11px] text-muted-foreground">
                    平均完成 {overview.averageDurationSeconds}s
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {overview.daily.map((day) => (
                    <div key={day.date} className="text-center">
                      <div className="flex h-10 items-end justify-center">
                        <div
                          className="w-full max-w-6 rounded-t bg-teal-600/80"
                          style={{
                            height: `${day.total ? Math.max(3, (day.total / Math.max(1, ...overview.daily.map((item) => item.total))) * 40) : 1}px`,
                          }}
                          title={`${day.total} 次分析，${day.failed} 次失败`}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {day.date.slice(5)}
                      </div>
                      <div className="text-xs font-medium">{day.total}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {overview.load && (
              <Card>
                <CardContent className="p-3">
                  <h3
                    className="text-xs font-semibold"
                    title="涵盖保存的任务；排队等待包含冷却时间"
                  >
                    负载与调用
                  </h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <CompactDetail
                      label="执行 / 排队"
                      value={`${overview.running}/${overview.load.workerCapacity} · ${overview.queued}/${overview.load.queueCapacity}`}
                    />
                    <CompactDetail
                      label="最长等待"
                      value={seconds(overview.load.oldestQueuedSeconds)}
                    />
                    <CompactDetail
                      label="平均等待"
                      value={seconds(overview.load.averageWaitSeconds)}
                    />
                    <CompactDetail
                      label="等待 P95"
                      value={seconds(overview.load.p95WaitSeconds)}
                      title="95% 任务排队不超过此时长，包含冷却"
                    />
                    <CompactDetail
                      label="执行 P95"
                      value={seconds(overview.load.p95ExecutionSeconds)}
                      title="95% 已结束任务执行不超过此时长"
                    />
                    <CompactDetail
                      label="Chrys 任务"
                      value={`${overview.load.chrysRuns} 次`}
                      title="不等于模型 API 请求次数"
                    />
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Token / API 重试：未采集
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <RepositoryManager sources={overview.sources} />
        </>
      )}
      {settings && (
        <Card>
          <CardContent className="p-3">
            <details>
              <summary className="cursor-pointer text-xs">
                <strong>运行参数</strong>
                <span className="ml-3 text-muted-foreground">
                  自动{settings.autoEnabled ? "开启" : "关闭"} · 并发{" "}
                  {settings.maxConcurrent} · 队列 {settings.maxQueued} · 超时{" "}
                  {settings.timeoutSeconds}s
                </span>
                <span className="ml-2 text-blue-600">调整</span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.autoEnabled}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          autoEnabled: event.target.checked,
                        })
                      }
                    />
                    自动分析问题创建与更新
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    保存后应用
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Setting
                    label="并发任务"
                    unit="个"
                    value={settings.maxConcurrent}
                    min={1}
                    max={8}
                    onChange={(value) =>
                      setSettings({ ...settings, maxConcurrent: value })
                    }
                  />
                  <Setting
                    label="队列上限"
                    unit="个"
                    value={settings.maxQueued}
                    min={1}
                    max={10000}
                    onChange={(value) =>
                      setSettings({ ...settings, maxQueued: value })
                    }
                  />
                  <Setting
                    label="分析冷却"
                    unit="秒"
                    value={settings.cooldownSeconds}
                    min={0}
                    max={3600}
                    onChange={(value) =>
                      setSettings({ ...settings, cooldownSeconds: value })
                    }
                  />
                  <Setting
                    label="执行超时"
                    unit="秒"
                    value={settings.timeoutSeconds}
                    min={15}
                    max={900}
                    onChange={(value) =>
                      setSettings({ ...settings, timeoutSeconds: value })
                    }
                  />
                  <Setting
                    label="提问上限"
                    unit="条"
                    value={settings.maxQuestions}
                    min={0}
                    max={10}
                    onChange={(value) =>
                      setSettings({ ...settings, maxQuestions: value })
                    }
                  />
                </div>
                <Button size="xs" onClick={() => void save()} disabled={saving}>
                  <Save className="size-3" />
                  保存参数
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <h3 className="mr-auto text-xs font-semibold">
              分析任务{" "}
              <span className="font-normal text-muted-foreground">
                {visibleJobs.length} / {jobs.length} · 最近 100 次
              </span>
            </h3>
            <Input
              aria-label="搜索分析任务"
              placeholder="问题编号 / 标题"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-7 w-40 text-xs"
            />
            <select
              aria-label="筛选任务状态"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-7 rounded-md border bg-background px-2 text-xs"
            >
              {["all", "queued", "running", "completed", "failed"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "全部状态" : jobStatus(value)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">问题</th>
                  <th className="px-2 py-2 font-medium">触发</th>
                  <th className="px-2 py-2 font-medium">状态</th>
                  <th className="px-2 py-2 font-medium">提交时间</th>
                  <th className="px-2 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30">
                    <td className="max-w-64 px-3 py-2">
                      <p
                        className="truncate font-medium"
                        title={job.issue?.title}
                      >
                        {job.issueCode || job.issueId} ·{" "}
                        {job.issue?.title || "未记录标题"}
                      </p>
                      {job.error && (
                        <p
                          className="mt-0.5 truncate text-red-700"
                          title={job.error}
                        >
                          {job.error}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                      {trigger(job.trigger)}
                    </td>
                    <td
                      className="whitespace-nowrap px-2 py-2"
                      title={job.phase}
                    >
                      <span
                        className={
                          job.status === "failed"
                            ? "text-red-700"
                            : job.status === "completed"
                              ? "text-teal-700"
                              : "text-amber-700"
                        }
                      >
                        {jobStatus(job.status)}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap px-2 py-2 text-muted-foreground"
                      title={date(job.createdAt)}
                    >
                      {shortDate(job.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        className="rounded px-1 py-1 text-blue-600 hover:underline focus-visible:outline-2"
                        onClick={() => setSelected(job)}
                        aria-label={`查看详情 ${job.issueCode || job.issueId}`}
                      >
                        详情
                      </button>
                      {job.status === "failed" && (
                        <button
                          type="button"
                          className="ml-2 rounded px-1 py-1 text-blue-600 hover:underline"
                          onClick={() => void retry(job.id)}
                        >
                          重试
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleJobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-5 text-center text-muted-foreground"
                    >
                      暂无匹配记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <TaskDetails
        job={selectedJob}
        questions={questions}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon}
            {label}
          </span>
          <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
function Setting({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium">
        {label}（{unit}）
      </span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8"
      />
    </label>
  )
}
