import { describe, expect, it } from "vitest"
import { buildIssueFlowModel, deriveAiTrack, deriveHandlerChain } from "./issue-flow-model"
import type { LocationIssueView } from "@/lib/ai-location"
import type { Issue, OperationLog, User } from "@/lib/types"

function makeIssue(overrides: Partial<Issue>): Issue {
  return {
    id: 81,
    title: "测试问题",
    code: "ISS-001",
    status: "PENDING_ASSIGN",
    priority: "HIGH",
    ...overrides,
  } as Issue
}

const USERS: User[] = [
  { id: 1, displayName: "张三", username: "zhangsan", employeeNo: "L0001", role: "LEADER", avatarColor: "#0ea5e9" },
  { id: 2, displayName: "李四", username: "lisi", employeeNo: "D0001", role: "DEVELOPER", avatarColor: "#f59e0b" },
  { id: 3, displayName: "王五", username: "wangwu", employeeNo: "D0002", role: "DEVELOPER", avatarColor: "#10b981" },
] as User[]

function assignOp(id: number, from: number | null, to: number, createdAt: string): OperationLog {
  return {
    id, issueId: 81, operatorId: 1, action: "ASSIGNEE", field: "assigneeId",
    oldValue: from == null ? undefined : String(from), newValue: String(to),
    createdAt,
  } as OperationLog
}

describe("deriveHandlerChain", () => {
  it("待分配时没有处理链", () => {
    const chain = deriveHandlerChain(makeIssue({ status: "PENDING_ASSIGN" }), [], USERS)
    expect(chain).toHaveLength(0)
  })

  it("单次分配得到一个 active 处理人", () => {
    const issue = makeIssue({ status: "PENDING_HANDLE", assigneeId: 2 })
    const chain = deriveHandlerChain(issue, [assignOp(1, null, 2, "2026-09-01T10:00:00Z")], USERS)
    expect(chain).toEqual([
      { userId: 2, name: "李四", color: "#f59e0b", state: "active" },
    ])
  })

  it("多次改派形成串行链，前一环 done 最后一环 active", () => {
    const issue = makeIssue({ status: "PROCESSING", assigneeId: 3 })
    const chain = deriveHandlerChain(issue, [
      assignOp(1, null, 2, "2026-09-01T10:00:00Z"),
      assignOp(2, 2, 3, "2026-09-02T10:00:00Z"),
    ], USERS)
    expect(chain.map((h) => h.name)).toEqual(["李四", "王五"])
    expect(chain[0].state).toBe("done")
    expect(chain[1].state).toBe("active")
  })

  it("乱序日志按时间正序排列，连续同一人去重", () => {
    const issue = makeIssue({ status: "PROCESSING", assigneeId: 2 })
    const chain = deriveHandlerChain(issue, [
      assignOp(2, 3, 2, "2026-09-02T10:00:00Z"),
      assignOp(1, null, 3, "2026-09-01T10:00:00Z"),
    ], USERS)
    expect(chain.map((h) => h.name)).toEqual(["王五", "李四"])
  })

  it("已解决/已关闭时整链 done", () => {
    const issue = makeIssue({ status: "CLOSED", assigneeId: 2 })
    const chain = deriveHandlerChain(issue, [assignOp(1, null, 2, "2026-09-01T10:00:00Z")], USERS)
    expect(chain.every((h) => h.state === "done")).toBe(true)
  })

  it("日志缺失时以当前责任人对齐兜底", () => {
    const issue = makeIssue({ status: "PROCESSING", assigneeId: 3, assigneeName: "王五" })
    const chain = deriveHandlerChain(issue, [], USERS)
    expect(chain).toHaveLength(1)
    expect(chain[0].name).toBe("王五")
    expect(chain[0].state).toBe("active")
  })
})

describe("deriveAiTrack", () => {
  const view = (jobs: LocationIssueView["jobs"], questions: LocationIssueView["questions"] = []) =>
    ({ jobs, questions, latest: jobs[0] ?? null }) as LocationIssueView

  it("无视图且报错 → unavailable；403 → forbidden", () => {
    expect(deriveAiTrack(null, 502).state).toBe("unavailable")
    expect(deriveAiTrack(null, 403).state).toBe("forbidden")
  })

  it("无任务 → idle", () => {
    expect(deriveAiTrack(view([]), null).state).toBe("idle")
    expect(deriveAiTrack(view([]), null).detail).toBe("未启动")
  })

  it("运行中 → running，已完成 → completed", () => {
    const running = { id: "j1", status: "running", phase: "检索" } as LocationIssueView["jobs"][number]
    expect(deriveAiTrack(view([running]), null).state).toBe("running")
    expect(deriveAiTrack(view([running]), null).detail).toBe("定位中")
    const done = { id: "j2", status: "completed", phase: "" } as LocationIssueView["jobs"][number]
    expect(deriveAiTrack(view([done]), null).state).toBe("completed")
  })

  it("统计未关闭的 AI 提问数", () => {
    const questions = [
      { id: "q1", status: "open" },
      { id: "q2", status: "answered" },
      { id: "q3", status: "open" },
    ] as LocationIssueView["questions"]
    expect(deriveAiTrack(view([], questions), null).openQuestions).toBe(2)
  })
})

describe("buildIssueFlowModel", () => {
  const base = { ops: [] as OperationLog[], users: USERS, aiView: null, aiErrorStatus: null }

  it("待分配：分配灯 active，人工与结论未到", () => {
    const model = buildIssueFlowModel({ issue: makeIssue({ status: "PENDING_ASSIGN" }), ...base })
    expect(model.raised.state).toBe("done")
    expect(model.assigned.state).toBe("active")
    expect(model.handlers).toHaveLength(0)
    expect(model.resolved.state).toBe("pending")
    expect(model.closed.state).toBe("pending")
  })

  it("处理中：分配 done、人工链 active、结论未到", () => {
    const issue = makeIssue({ status: "PROCESSING", assigneeId: 2 })
    const model = buildIssueFlowModel({ issue, users: USERS, ops: [assignOp(1, null, 2, "2026-09-01T10:00:00Z")], aiView: null, aiErrorStatus: null })
    expect(model.assigned.state).toBe("done")
    expect(model.handlers[0].state).toBe("active")
    expect(model.resolved.state).toBe("pending")
  })

  it("已解决：结论 active、关闭 pending；已关闭：全 done", () => {
    const resolved = buildIssueFlowModel({ issue: makeIssue({ status: "RESOLVED", assigneeId: 2 }), ...base })
    expect(resolved.resolved.state).toBe("active")
    expect(resolved.closed.state).toBe("pending")
    const closed = buildIssueFlowModel({ issue: makeIssue({ status: "CLOSED", assigneeId: 2 }), ...base })
    expect(closed.resolved.state).toBe("done")
    expect(closed.closed.state).toBe("done")
  })
})

describe("buildIssueFlowColumns", () => {
  const base = { ops: [] as OperationLog[], users: USERS, aiView: null, aiErrorStatus: null }

  it("列序与轨道：人工链在主轨上，AI 是分支轨，分叉曲线列在分配后、合流列在结论前", async () => {
    const { buildIssueFlowColumns } = await import("./issue-flow-spine")
    const issue = makeIssue({ status: "PROCESSING", assigneeId: 2 })
    const model = buildIssueFlowModel({ issue, ...base })
    const columns = buildIssueFlowColumns({ issue, model })
    expect(
      columns.map((c) =>
        c.kind === "station" ? `${c.station.track}:${c.station.label}`
        : c.kind === "stacked" ? `stacked:${c.top.label}/${c.bottom.label}`
        : `curve:${c.variant}`,
      ),
    ).toEqual([
      "0:提出", "0:分配", "curve:fork", "stacked:李四/AI 处理", "curve:merge", "0:给出结论", "0:确认关闭",
    ])
    // 处理中的行进墨：分配右侧指向李四（march），AI 分叉进 AI 站（march）。
    const assignCol = columns[1]!
    if (assignCol.kind !== "station") throw new Error("expect station")
    expect(assignCol.spine.rails.find((r) => r.position === "right")?.ink).toBe("march")
    const fork = columns[2]!
    if (fork.kind !== "curve") throw new Error("expect curve")
    expect(fork.spine.curves[0]?.ink).toBe("faint")
  })

  it("无处理人时主轨直接越过 AI 站汇合，没有药丸列", async () => {
    const { buildIssueFlowColumns } = await import("./issue-flow-spine")
    const issue = makeIssue({ status: "PENDING_ASSIGN" })
    const model = buildIssueFlowModel({ issue, ...base })
    const columns = buildIssueFlowColumns({ issue, model })
    expect(
      columns.map((c) =>
        c.kind === "station" ? `${c.station.track}:${c.station.label}`
        : c.kind === "stacked" ? `stacked:${c.top.label}/${c.bottom.label}`
        : `curve:${c.variant}`,
      ),
    ).toEqual([
      "0:提出", "0:分配", "curve:fork", "1:AI 处理", "curve:merge", "0:给出结论", "0:确认关闭",
    ])
  })

  it("已关闭：主轨全线 strong，AI 分支的合流墨也是 strong", async () => {
    const { buildIssueFlowColumns } = await import("./issue-flow-spine")
    const issue = makeIssue({ status: "CLOSED", assigneeId: 2 })
    const model = buildIssueFlowModel({ issue, ...base })
    const columns = buildIssueFlowColumns({ issue, model })
    const merge = columns.at(-3)!
    if (merge.kind !== "curve") throw new Error("expect curve, got " + merge.kind)
    expect(merge.spine.curves[0]?.ink).toBe("strong")
    const resolved = columns.at(-2)!
    if (resolved.kind !== "station") throw new Error("expect station")
    expect(resolved.station.status).toBe("done")
  })
})
