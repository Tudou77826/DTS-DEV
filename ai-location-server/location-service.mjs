import { createHash, randomUUID } from "node:crypto"
import { analyze } from "./agent.mjs"
import { mapBounded } from "./repositories.mjs"
import { sourceStatus, loadMetrics } from "./operations.mjs"
import { createStore } from "./store.mjs"
import { issueId, normalizeIssue } from "./contracts.mjs"

/** Owns localization state and lifecycle; HTTP and DTS remain adapters. */
export function createLocationService(config) {
  const store = createStore(config.dataFile)
  let running = 0
  let wakeTimer = null
  function issueJobs(id) {
    return Object.values(store.state.jobs)
      .filter((job) => job.issueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  function issueView(id) {
    const jobs = issueJobs(id)
    const questions = Object.values(store.state.questions)
      .filter((question) => question.issueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { issueId: id, jobs, questions, latest: jobs[0] || null }
  }
  function answeredFacts(id) {
    return Object.values(store.state.questions)
      .filter((item) => item.issueId === id && item.status === "answered")
      .map((item) => ({
        question: item.text,
        answer: item.answer,
        targetRole: item.targetRole,
      }))
  }
  function fingerprint(issue, answers = []) {
    return createHash("sha256")
      .update(JSON.stringify({ issue, answers }))
      .digest("hex")
  }
  function queueJob(issue, trigger, answers = null) {
    const id = issue.id
    answers ??= answeredFacts(id)
    const hash = fingerprint(issue, answers)
    const last = issueJobs(id)[0]
    if (
      trigger === "auto" &&
      last?.fingerprint === hash &&
      last.status !== "failed"
    )
      return last
    if (trigger === "auto" && last?.status === "queued") {
      store.mutate(() => {
        last.issue = issue
        last.fingerprint = hash
        last.answers = answers
        last.phase = "等待最新问题内容稳定"
      })
      kick()
      return last
    }
    if (
      Object.values(store.state.jobs).filter((item) => item.status === "queued")
        .length >= store.state.settings.maxQueued
    ) {
      const error = new Error("定位任务队列已满，请稍后重试")
      error.status = 429
      throw error
    }
    const now = new Date().toISOString()
    const earliest =
      trigger === "auto" && last
        ? new Date(last.createdAt).getTime() +
          store.state.settings.cooldownSeconds * 1000
        : 0
    const job = {
      id: randomUUID(),
      issueId: id,
      issueCode: issue.code || "",
      trigger,
      fingerprint: hash,
      status: "queued",
      phase: "等待执行",
      createdAt: now,
      startedAt: null,
      completedAt: null,
      note: "",
      feedback: null,
      result: null,
      error: null,
      sessionId: null,
      durationSeconds: null,
      issue,
      answers,
      notBefore: Math.max(Date.now(), earliest),
      events: [{ at: now, message: "已接收问题，等待分析" }],
    }
    store.mutate((state) => {
      state.jobs[job.id] = job
    })
    kick()
    return job
  }
  function publishQuestions(job, result) {
    for (const request of result.questions.slice(
      0,
      job.execution.settings.maxQuestions,
    )) {
      const targetUserId =
        request.targetRole === "submitter"
          ? job.issue.submitterId
          : job.issue.assigneeId
      if (!targetUserId || !request.text.trim()) continue
      if (
        Object.values(store.state.questions).some(
          (question) =>
            question.issueId === job.issueId &&
            question.targetRole === request.targetRole &&
            question.text === request.text,
        )
      )
        continue
      const question = {
        id: randomUUID(),
        issueId: job.issueId,
        jobId: job.id,
        targetRole: request.targetRole,
        targetUserId: Number(targetUserId),
        text: request.text,
        status: "open",
        answer: null,
        answeredBy: null,
        createdAt: new Date().toISOString(),
        answeredAt: null,
        notified: false,
      }
      store.state.questions[question.id] = question
    }
  }
  async function deliverNotifications() {
    if (!config.callbackUrl) return
    const pending = Object.values(store.state.questions).filter(
      (question) => question.status === "open" && !question.notified,
    )
    for (const question of pending) {
      try {
        const response = await fetch(config.callbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AI-Location-Key": config.key,
          },
          body: JSON.stringify(question),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) continue
        store.mutate(() => {
          question.notified = true
        })
      } catch {
        /* Retry on the next delivery cycle. */
      }
    }
  }
  function kick() {
    if (wakeTimer) {
      clearTimeout(wakeTimer)
      wakeTimer = null
    }
    while (running < store.state.settings.maxConcurrent) {
      const queued = Object.values(store.state.jobs).filter(
        (item) => item.status === "queued",
      )
      const job = queued
        .filter((item) => (item.notBefore || 0) <= Date.now())
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      if (!job) {
        if (queued.length)
          wakeTimer = setTimeout(
            kick,
            Math.max(
              50,
              Math.min(...queued.map((item) => item.notBefore || 0)) -
                Date.now(),
            ),
          )
        break
      }
      running++
      store.mutate(() => {
        job.status = "running"
        job.phase = "正在检查问题信息"
        job.startedAt = new Date().toISOString()
        job.execution = {
          mode: config.mode,
          agentProfile: config.agentProfile,
          settings: { ...store.state.settings },
        }
        job.events.push({ at: job.startedAt, message: job.phase })
      })
      const onProgress = (message) =>
        store.mutate(() => {
          job.phase = message
          job.events.push({ at: new Date().toISOString(), message })
        })
      void analyze(job, job.issue, job.execution.settings, config, onProgress)
        .then((result) => {
          store.mutate(() => {
            job.status = "completed"
            job.phase = "分析完成"
            job.result = result
            job.sessionId = result.sessionId || null
            job.durationSeconds = result.durationSeconds || null
            job.completedAt = new Date().toISOString()
            job.events.push({
              at: job.completedAt,
              message: "已形成可核查的定位方向",
            })
            publishQuestions(job, result)
          })
          void deliverNotifications()
        })
        .catch((error) => {
          store.mutate(() => {
            job.status = "failed"
            job.phase = "分析失败"
            job.error = String(error.message || error).slice(0, 500)
            job.completedAt = new Date().toISOString()
            job.events.push({
              at: job.completedAt,
              message: "分析失败，可稍后重试",
            })
          })
        })
        .finally(() => {
          running--
          kick()
        })
    }
  }
  let sourceCache = null
  let sourceChecked = 0
  let sourceRefreshing = false
  async function overview() {
    if (!sourceCache)
      sourceCache = config.repositories.map((repo) => ({
        ...repo,
        label: repo.name,
        status: "checking",
        checkedAt: new Date().toISOString(),
      }))
    if (!sourceRefreshing && Date.now() - sourceChecked > 30_000) {
      sourceRefreshing = true
      sourceChecked = Date.now()
      void mapBounded(config.repositories, async (repo) => ({
        ...(await sourceStatus(repo.name, repo.root)),
        ...repo,
      }))
        .then((sources) => {
          sourceCache = sources
        })
        .catch((error) => console.error("仓库状态检查失败", error.message))
        .finally(() => {
          sourceRefreshing = false
        })
    }

    const jobs = Object.values(store.state.jobs)
    const completed = jobs.filter((job) => job.status === "completed")
    const helpful = completed.filter((job) => job.feedback === "helpful").length
    const questions = Object.values(store.state.questions)
    const answered = questions.filter(
      (question) => question.status === "answered",
    )
    const formatDay = (value) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: config.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(value)
    const daily = Array.from({ length: 7 }, (_, offset) => {
      const date = formatDay(Date.now() - (6 - offset) * 86_400_000)
      const dailyJobs = jobs.filter(
        (job) => formatDay(new Date(job.createdAt)) === date,
      )
      return {
        date,
        total: dailyJobs.length,
        failed: dailyJobs.filter((job) => job.status === "failed").length,
      }
    })
    return {
      sources: sourceCache,
      load: loadMetrics(jobs, store.state.settings),
      total: jobs.length,
      queued: jobs.filter((job) => job.status === "queued").length,
      running: jobs.filter((job) => job.status === "running").length,
      completed: completed.length,
      failed: jobs.filter((job) => job.status === "failed").length,
      awaitingAnswers: questions.filter(
        (question) => question.status === "open",
      ).length,
      answeredQuestions: answered.length,
      averageAnswerSeconds: answered.length
        ? Math.round(
            answered.reduce(
              (sum, question) =>
                sum +
                (new Date(question.answeredAt) - new Date(question.createdAt)) /
                  1000,
              0,
            ) / answered.length,
          )
        : 0,
      feedbackCount: completed.filter((job) => job.feedback).length,
      helpful,
      partial: completed.filter((job) => job.feedback === "partial").length,
      notHelpful: completed.filter((job) => job.feedback === "not_helpful")
        .length,
      averageDurationSeconds: completed.length
        ? Math.round(
            completed.reduce(
              (sum, job) =>
                sum +
                (new Date(job.completedAt) - new Date(job.startedAt)) / 1000,
              0,
            ) / completed.length,
          )
        : 0,
      mode: config.mode,
      agentProfile: config.agentProfile,
      codeRoot: config.codeRoot,
      knowledgeRoot: config.knowledgeRoot,
      daily,
    }
  }

  function fail(status, message) {
    throw Object.assign(new Error(message), { status })
  }
  function intake(input) {
    const issue = normalizeIssue(input.issue)
    store.mutate((state) => {
      state.issues[issue.id] = issue
      for (const question of Object.values(state.questions)) {
        if (question.issueId !== issue.id || question.status !== "open")
          continue
        const target =
          question.targetRole === "assignee"
            ? issue.assigneeId
            : issue.submitterId
        if (target && question.targetUserId !== Number(target)) {
          question.targetUserId = Number(target)
          question.notified = false
        }
      }
    })
    void deliverNotifications()
    if (
      store.state.settings.autoEnabled &&
      !["RESOLVED", "CLOSED"].includes(issue.status)
    )
      queueJob(issue, "auto")
    return issueView(issue.id)
  }
  function run(id, input) {
    const issue = input.issue
      ? normalizeIssue(input.issue)
      : store.state.issues[id]
    if (!issue || issue.id !== id) fail(404, "问题快照不存在")
    store.mutate((state) => {
      state.issues[id] = issue
    })
    return queueJob(issue, "manual")
  }
  function answer(id, input) {
    const question = store.state.questions[id]
    if (!question) fail(404, "问题不存在")
    if (question.issueId !== issueId(input.issueId)) fail(404, "问题不匹配")
    if (question.status !== "open") fail(409, "已回答")
    const actorId = Number(input.actorId)
    if (!actorId || actorId !== question.targetUserId)
      fail(403, "仅指定人员可回答")
    const text = String(input.answer || "").trim()
    if (!text || text.length > 3000) fail(400, "回答长度应为 1-3000 字")
    const issue = store.state.issues[question.issueId]
    if (
      issue &&
      Object.values(store.state.jobs).filter((item) => item.status === "queued")
        .length >= store.state.settings.maxQueued
    ) {
      fail(429, "定位任务队列已满，请稍后提交回答")
    }
    store.mutate(() => {
      question.status = "answered"
      question.answer = text
      question.answeredBy = actorId
      question.answeredAt = new Date().toISOString()
    })
    if (issue) queueJob(issue, "answer", answeredFacts(question.issueId))
    return issueView(question.issueId)
  }
  function feedback(id, input) {
    const job = store.state.jobs[id]
    if (!job) fail(404, "任务不存在")
    if (job.issueId !== issueId(input.issueId)) fail(404, "问题不匹配")
    if (!["helpful", "partial", "not_helpful"].includes(input.value))
      fail(400, "反馈值无效")
    store.mutate(() => {
      job.feedback = input.value
    })
    return job
  }
  function updateSettings(input) {
    const next = { ...store.state.settings }
    if (typeof input.autoEnabled === "boolean")
      next.autoEnabled = input.autoEnabled
    for (const [key, min, max] of [
      ["maxConcurrent", 1, 8],
      ["maxQueued", 1, 10000],
      ["cooldownSeconds", 0, 3600],
      ["timeoutSeconds", 15, 900],
      ["maxQuestions", 0, 10],
    ]) {
      if (input[key] === undefined) continue
      if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max)
        fail(400, `${key} 超出范围`)
      next[key] = input[key]
    }
    store.mutate((state) => {
      state.settings = next
    })
    kick()
    return next
  }
  function jobs() {
    const recent = Object.values(store.state.jobs)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
    const ids = new Set(recent.map((job) => job.id))
    return {
      jobs: recent,
      questions: Object.values(store.state.questions).filter((question) =>
        ids.has(question.jobId),
      ),
    }
  }
  function retry(id) {
    const failed = store.state.jobs[id]
    if (!failed || failed.status !== "failed") fail(409, "仅失败任务可重试")
    return queueJob(failed.issue, "retry", failed.answers)
  }
  return {
    intake,
    run,
    answer,
    feedback,
    overview,
    updateSettings,
    jobs,
    retry,
    issue: issueView,
    settings: () => store.state.settings,
    start() {
      kick()
      void deliverNotifications()
      setInterval(() => void deliverNotifications(), 30_000).unref()
    },
  }
}
