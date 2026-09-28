export function seconds(value: number | null) {
  return value == null ? "暂无样本" : `${value} 秒`
}
export function date(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "未记录"
}
export function plainText(value?: string) {
  return value?.replace(/<[^>]*>/g, " ").trim()
}
export function jobStatus(value: string) {
  return (
    (
      {
        queued: "排队中",
        running: "执行中",
        completed: "已完成",
        failed: "失败",
      } as Record<string, string>
    )[value] || value
  )
}
export function trigger(value: string) {
  return (
    (
      {
        auto: "自动触发",
        manual: "人工触发",
        answer: "补充后续跑",
        retry: "失败重试",
      } as Record<string, string>
    )[value] || value
  )
}
export function shortDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "未记录"
}
