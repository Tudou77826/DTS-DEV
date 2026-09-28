import fs from "node:fs"
import path from "node:path"

export const DEFAULT_SETTINGS = Object.freeze({
  autoEnabled: true,
  maxConcurrent: 2,
  maxQueued: 200,
  cooldownSeconds: 30,
  timeoutSeconds: 180,
  maxQuestions: 3,
})

export function createStore(file) {
  const location = path.resolve(file)
  fs.mkdirSync(path.dirname(location), { recursive: true })
  let state = fs.existsSync(location)
    ? JSON.parse(fs.readFileSync(location, "utf8"))
    : { issues: {}, jobs: {}, questions: {}, settings: { ...DEFAULT_SETTINGS } }
  state = {
    issues: state.issues || {},
    jobs: state.jobs || {},
    questions: state.questions || {},
    settings: { ...DEFAULT_SETTINGS, ...state.settings },
  }
  for (const job of Object.values(state.jobs)) {
    job.events ||= [{ at: job.createdAt, message: "已接收问题" }]
    if (job.status === "running") {
      job.status = "queued"
      job.phase = "服务重启后等待重新执行"
      job.events.push({ at: new Date().toISOString(), message: job.phase })
    }
  }

  function save() {
    const temporary = `${location}.${process.pid}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 })
    fs.renameSync(temporary, location)
  }

  function mutate(fn) {
    const result = fn(state)
    save()
    return result
  }

  save()
  return { state, mutate, file: location }
}
