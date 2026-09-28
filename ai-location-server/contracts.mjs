export const ISSUE_FIELDS = Object.freeze([
  "id",
  "code",
  "title",
  "description",
  "moduleName",
  "subModule",
  "productName",
  "foundVersionName",
  "envInfo",
  "latestProgress",
  "submitterId",
  "submitterName",
  "assigneeId",
  "assigneeName",
  "status",
])
export function issueSnapshot(issue) {
  return Object.fromEntries(
    ISSUE_FIELDS.map((field) => [field, issue[field] ?? null]),
  )
}
export function issueId(value) {
  return String(value ?? "")
}
export function normalizeIssue(issue) {
  if (!issue || issue.id == null || !String(issue.title || "").trim())
    throw new Error("缺少问题 ID 或标题")
  const result = issueSnapshot(issue)
  result.id = issueId(issue.id)
  return result
}
