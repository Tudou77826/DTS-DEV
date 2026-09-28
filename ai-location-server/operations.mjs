import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs/promises"
const execute = promisify(execFile)
async function git(root, args) {
  return (
    await execute("git", args, {
      cwd: root,
      timeout: 2000,
      windowsHide: true,
      maxBuffer: 100000,
    })
  ).stdout.trim()
}
export async function sourceStatus(label, root) {
  const checkedAt = new Date().toISOString()
  if (!root) return { label, root, status: "unconfigured", checkedAt }
  try {
    if (!(await fs.stat(root)).isDirectory()) throw new Error("目录不存在")
    await fs.readdir(root)
    try {
      const [head, branch, fetched] = await Promise.all([
        git(root, ["rev-parse", "HEAD"]),
        git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
        git(root, ["rev-parse", "--git-path", "FETCH_HEAD"]),
      ])
      const fetchPath = (await import("node:path")).resolve(root, fetched)
      const lastFetchAt = await fs
        .stat(fetchPath)
        .then((item) => item.mtime.toISOString())
        .catch(() => null)
      return {
        label,
        root,
        status: "git",
        head,
        branch,
        lastFetchAt,
        checkedAt,
      }
    } catch {
      return { label, root, status: "directory", checkedAt }
    }
  } catch {
    return { label, root, status: "unavailable", checkedAt }
  }
}
export function loadMetrics(jobs, settings) {
  const finished = jobs.filter((job) => job.startedAt && job.completedAt)
  const waits = jobs
    .filter((job) => job.startedAt)
    .map((job) =>
      Math.max(0, (new Date(job.startedAt) - new Date(job.createdAt)) / 1000),
    )
    .sort((a, b) => a - b)
  const executions = finished
    .map((job) =>
      Math.max(0, (new Date(job.completedAt) - new Date(job.startedAt)) / 1000),
    )
    .sort((a, b) => a - b)
  const mean = (values) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10
      : null
  const p95 = (values) =>
    values.length
      ? Math.round(values[Math.ceil(values.length * 0.95) - 1] * 10) / 10
      : null
  const queued = jobs.filter((job) => job.status === "queued")
  return {
    averageWaitSeconds: mean(waits),
    p95WaitSeconds: p95(waits),
    p95ExecutionSeconds: p95(executions),
    oldestQueuedSeconds: queued.length
      ? Math.round(
          Math.max(
            ...queued.map(
              (job) => (Date.now() - new Date(job.createdAt)) / 1000,
            ),
          ),
        )
      : 0,
    queueCapacity: settings.maxQueued,
    workerCapacity: settings.maxConcurrent,
    chrysRuns: jobs.filter(
      (job) => job.execution?.mode === "chrys" || job.sessionId,
    ).length,
    tokenUsage: null,
    apiRetries: null,
  }
}
