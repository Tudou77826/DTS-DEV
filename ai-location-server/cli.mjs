import { issueSnapshot } from "./contracts.mjs"
import { loadRepositories, mapBounded } from "./repositories.mjs"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { searchRepository } from "./agent.mjs"
import { spawn } from "node:child_process"

const here = path.dirname(fileURLToPath(import.meta.url))
const endpoint = process.env.AI_LOCATION_URL || "http://127.0.0.1:8091"
const registry = loadRepositories({
  repositoriesFile: process.env.AI_LOCATION_REPOSITORIES_FILE,
  codeRoot: path.resolve(
    process.env.AI_LOCATION_CODE_ROOT || path.join(here, ".."),
  ),
  knowledgeRoot: process.env.AI_LOCATION_KNOWLEDGE_ROOT || "",
})
const key = process.env.AI_LOCATION_KEY || "local-dev-ai-key"
function git(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
    })
    child.stderr.on("data", (chunk) => {
      output += chunk
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(output.trim() || `git 退出 ${code}`)),
    )
  })
}
async function request(route, method = "GET", body) {
  const response = await fetch(new URL(route, endpoint), {
    method,
    headers: { "X-AI-Location-Key": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data
}
const [command, ...args] = process.argv.slice(2)
try {
  let result
  if (command === "status")
    result = await request("/ai-location/admin/overview")
  else if (command === "jobs") result = await request("/ai-location/admin/jobs")
  else if (command === "settings")
    result = await request("/ai-location/admin/settings")
  else if (command === "set" && args.length === 2) {
    const [name, raw] = args
    const current = await request("/ai-location/admin/settings")
    if (!(name in current)) throw new Error(`不支持参数 ${name}`)
    const value = raw === "true" ? true : raw === "false" ? false : Number(raw)
    result = await request("/ai-location/admin/settings", "PUT", {
      [name]: value,
    })
  } else if (command === "retry" && args[0])
    result = await request(
      `/ai-location/admin/jobs/${encodeURIComponent(args[0])}/retry`,
      "POST",
    )
  else if (command === "ingest" && args[0]) {
    const issue = JSON.parse(await fs.readFile(path.resolve(args[0]), "utf8"))
    result = await request("/ai-location/issues", "POST", {
      issue: issueSnapshot(issue),
    })
  } else if (command === "repo-search" && args[0]) {
    result = await mapBounded(
      registry.repositories.filter((repo) => repo.enabled),
      async (repo) => ({
        id: repo.id,
        name: repo.name,
        matches: await searchRepository(repo.root, args.join(" "), 10),
      }),
    )
  } else if (command === "repo-sync") {
    const roots = process.env.AI_LOCATION_REPOSITORIES_FILE
      ? registry.repositories
          .filter((repo) => repo.enabled)
          .map((repo) => repo.root)
      : [
          process.env.AI_LOCATION_CODE_ROOT,
          process.env.AI_LOCATION_KNOWLEDGE_ROOT,
        ].filter(Boolean)
    if (!roots.length)
      throw new Error(
        "先设置 AI_LOCATION_CODE_ROOT 或 AI_LOCATION_KNOWLEDGE_ROOT",
      )
    result = []
    for (const root of roots) {
      const cwd = path.resolve(root)
      if (await git(["status", "--porcelain"], cwd))
        throw new Error(`${cwd} 有未提交修改，已停止同步`)
      await git(["fetch", "--prune"], cwd)
      const upstream = await git(
        ["rev-parse", "--abbrev-ref", "@{upstream}"],
        cwd,
      )
      await git(["merge", "--ff-only", upstream], cwd)
      result.push({ root: cwd, head: await git(["rev-parse", "HEAD"], cwd) })
    }
  } else if (command === "backfill") {
    const dtsUrl = process.env.AI_LOCATION_DTS_URL
    const tokenFile = process.env.AI_LOCATION_DTS_TOKEN_FILE
    if (!dtsUrl || !tokenFile)
      throw new Error(
        "backfill 需要 AI_LOCATION_DTS_URL 和 AI_LOCATION_DTS_TOKEN_FILE",
      )
    const token = (await fs.readFile(path.resolve(tokenFile), "utf8")).trim()
    let page = 1
    let count = 0
    while (true) {
      const response = await fetch(
        new URL(`/api/issues?page=${page}&size=100&subModuleId=0`, dtsUrl),
        { headers: { "X-Auth-Token": token } },
      )
      if (!response.ok)
        throw new Error(`DTS 拉取第 ${page} 页失败：HTTP ${response.status}`)
      const payload = await response.json()
      if (payload.code !== 0) throw new Error(payload.message || "DTS 拉取失败")
      const issues = payload.data.list || []
      for (const issue of issues) {
        await request("/ai-location/issues", "POST", {
          issue: issueSnapshot(issue),
        })
        count++
      }
      if (issues.length < 100 || page >= payload.data.totalPages) break
      page++
    }
    result = { inspected: count, pages: page }
  } else
    throw new Error(
      "用法：node cli.mjs status | jobs | settings | set <参数> <值> | retry <jobId> | ingest <issue.json> | repo-search <关键词> | repo-sync | backfill",
    )
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
