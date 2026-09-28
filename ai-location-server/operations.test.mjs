import assert from "node:assert/strict"
import { test } from "node:test"
import { loadMetrics, sourceStatus } from "./operations.mjs"
test("load statistics include queue cooling and failed execution", () => {
  const jobs = [
    {
      status: "completed",
      createdAt: "2026-09-28T00:00:00Z",
      startedAt: "2026-09-28T00:00:10Z",
      completedAt: "2026-09-28T00:00:30Z",
      execution: { mode: "chrys" },
    },
    {
      status: "failed",
      createdAt: "2026-09-28T00:00:00Z",
      startedAt: "2026-09-28T00:00:30Z",
      completedAt: "2026-09-28T00:01:30Z",
    },
  ]
  const result = loadMetrics(jobs, { maxQueued: 200, maxConcurrent: 2 })
  assert.equal(result.averageWaitSeconds, 20)
  assert.equal(result.p95WaitSeconds, 30)
  assert.equal(result.p95ExecutionSeconds, 60)
  assert.equal(result.chrysRuns, 1)
  assert.equal(result.tokenUsage, null)
  assert.equal(
    loadMetrics([], { maxQueued: 1, maxConcurrent: 1 }).averageWaitSeconds,
    null,
  )
})
test("source status distinguishes missing configuration from missing directory", async () => {
  assert.equal((await sourceStatus("knowledge", "")).status, "unconfigured")
  assert.equal(
    (await sourceStatus("code", "D:/__dts_nonexistent_test_directory__"))
      .status,
    "unavailable",
  )
})
