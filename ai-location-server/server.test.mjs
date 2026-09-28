import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { after, before, test } from "node:test"

const here = path.dirname(fileURLToPath(import.meta.url))
let processHandle
let origin
let directory
const key = "test-location-key"

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}
async function request(route, method = "GET", body, auth = true) {
  const response = await fetch(`${origin}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { "X-AI-Location-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}
async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const value = await check()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 75))
  }
  throw new Error("等待状态超时")
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "dts-ai-test-"))
  const port = await freePort()
  origin = `http://127.0.0.1:${port}`
  processHandle = spawn(process.execPath, [path.join(here, "server.mjs")], {
    cwd: here,
    stdio: "ignore",
    env: {
      ...process.env,
      AI_LOCATION_PORT: String(port),
      AI_LOCATION_MODE: "mock",
      AI_LOCATION_KEY: key,
      AI_LOCATION_DATA: path.join(directory, "state.json"),
      AI_LOCATION_CALLBACK_URL: "",
    },
  })
  await waitFor(async () => {
    try {
      return (await fetch(`${origin}/health`)).ok
    } catch {
      return false
    }
  })
})
after(async () => {
  processHandle?.kill()
  await fs.rm(directory, { recursive: true, force: true })
})

test("authenticated automatic run is idempotent, asks targeted questions, and resumes after answer", async () => {
  assert.equal(
    (await request("/ai-location/admin/overview", "GET", undefined, false))
      .status,
    401,
  )
  const issue = {
    id: 42,
    code: "ISS-42",
    title: "策略下发失败",
    description: "设备提示成功但没有生效",
    submitterId: 7,
    assigneeId: 8,
    foundVersionName: "V1",
  }
  const first = await request("/ai-location/issues", "POST", { issue })
  assert.equal(first.status, 200)
  const firstId = first.data.latest.id
  const duplicate = await request("/ai-location/issues", "POST", { issue })
  assert.equal(duplicate.data.latest.id, firstId)
  // A settings change during execution must not alter the captured run configuration.
  await request("/ai-location/admin/settings", "PUT", { maxQuestions: 0 })
  const completed = await waitFor(async () => {
    const view = (await request("/ai-location/issues/42")).data
    return view.latest?.status === "completed" ? view : null
  })
  assert.ok(completed.questions.some((question) => question.targetUserId === 7))
  await request("/ai-location/admin/settings", "PUT", { maxQuestions: 3 })
  assert.equal(completed.latest.execution.mode, "mock")
  assert.equal(completed.latest.execution.settings.maxConcurrent, 2)
  const adminJobs = (await request("/ai-location/admin/jobs")).data
  assert.ok(adminJobs.questions.some((item) => item.jobId === firstId))
  const question = completed.questions.find((item) => item.targetUserId === 7)
  assert.equal(
    (
      await request(`/ai-location/questions/${question.id}/answer`, "POST", {
        issueId: 42,
        actorId: 8,
        answer: "wrong",
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await request(`/ai-location/questions/${question.id}/answer`, "POST", {
        issueId: 42,
        actorId: 7,
        answer: "发生在测试环境",
      })
    ).status,
    200,
  )
  const continued = await waitFor(async () => {
    const view = (await request("/ai-location/issues/42")).data
    return view.jobs.length === 2 && view.latest.status === "completed"
      ? view
      : null
  })
  assert.equal(continued.latest.trigger, "answer")
  assert.equal(
    continued.questions.filter((item) => item.id === question.id).length,
    1,
  )
  assert.equal(
    (
      await request(
        `/ai-location/jobs/${continued.latest.id}/feedback`,
        "POST",
        { issueId: 42, value: "helpful" },
      )
    ).status,
    200,
  )
  const overview = (await request("/ai-location/admin/overview")).data
  assert.equal(overview.total, 2)
  assert.equal(overview.helpful, 1)
})

test("settings validation controls automatic intake", async () => {
  assert.equal(
    (await request("/ai-location/admin/settings", "PUT", { maxConcurrent: 0 }))
      .status,
    400,
  )
  assert.equal(
    (
      await request("/ai-location/admin/settings", "PUT", {
        autoEnabled: false,
      })
    ).data.autoEnabled,
    false,
  )
  const issue = { id: 43, title: "人工问题", description: "演示" }
  assert.equal(
    (await request("/ai-location/issues", "POST", { issue })).data.latest,
    null,
  )
  assert.equal(
    (await request("/ai-location/issues/43/runs", "POST")).status,
    202,
  )
})

test("cooldown coalesces updates and queue limit rejects new work", async () => {
  await request("/ai-location/admin/settings", "PUT", {
    autoEnabled: true,
    maxQueued: 1,
    cooldownSeconds: 60,
  })
  const issue = { id: 44, title: "版本异常", description: "第一版" }
  await request("/ai-location/issues", "POST", { issue })
  await waitFor(
    async () =>
      (await request("/ai-location/issues/44")).data.latest?.status ===
      "completed",
  )
  const delayed = await request("/ai-location/issues", "POST", {
    issue: { ...issue, description: "第二版" },
  })
  assert.equal(delayed.data.latest.status, "queued")
  const coalesced = await request("/ai-location/issues", "POST", {
    issue: { ...issue, description: "第三版" },
  })
  assert.equal(coalesced.data.latest.id, delayed.data.latest.id)
  assert.equal(coalesced.data.latest.issue.description, "第三版")
  assert.equal(
    (
      await request("/ai-location/issues", "POST", {
        issue: { id: 45, title: "队列限制" },
      })
    ).status,
    429,
  )
  const question = (
    await request("/ai-location/issues/42")
  ).data.questions.find((item) => item.status === "open")
  assert.ok(question)
  assert.equal(
    (
      await request(`/ai-location/questions/${question.id}/answer`, "POST", {
        issueId: 42,
        actorId: question.targetUserId,
        answer: "队列满时的补充信息",
      })
    ).status,
    429,
  )
  const unchanged = (
    await request("/ai-location/issues/42")
  ).data.questions.find((item) => item.id === question.id)
  assert.equal(unchanged.status, "open")
  assert.equal(unchanged.answer, null)
})
