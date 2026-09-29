import { useCallback, useEffect, useState } from "react"
import { aiLocation, type LocationIssueView } from "@/lib/ai-location"
import { ApiError } from "@/lib/api"

interface SharedPoller {
  refCount: number
  timer: number | null
  view: LocationIssueView | null
  error: string
  errorStatus: number | null
  subscribers: Set<() => void>
}

const POLL_INTERVAL_MS = 5000
const pollers = new Map<string, SharedPoller>()

function notify(poller: SharedPoller) {
  for (const subscriber of poller.subscribers) subscriber()
}

async function fetchOnce(issueId: number, poller: SharedPoller) {
  try {
    poller.view = await aiLocation.issue(issueId)
    poller.error = ""
    poller.errorStatus = null
  } catch (cause) {
    // 临时故障保留最后一次已知视图，与原 AiLocationIndicator 行为一致。
    poller.error = cause instanceof Error ? cause.message : "无法连接定位服务"
    poller.errorStatus = cause instanceof ApiError ? cause.status : null
  }
  notify(poller)
}

function ensurePoller(issueId: number, poller: SharedPoller) {
  if (poller.timer === null) {
    void fetchOnce(issueId, poller)
    poller.timer = window.setInterval(() => void fetchOnce(issueId, poller), POLL_INTERVAL_MS)
  }
}

function stopPoller(issueId: number, poller: SharedPoller) {
  if (poller.timer !== null) {
    window.clearInterval(poller.timer)
    poller.timer = null
  }
  pollers.delete(String(issueId))
}

/**
 * 问题维度的 AI 定位视图。同一 issueId 的多个消费方（流程图、Tab 指示器、
 * AI 面板）共享一条轮询通道，按引用计数启停，避免重复请求。
 */
export function useAiLocationView(issueId: number) {
  const key = String(issueId)
  const [, setVersion] = useState(0)

  useEffect(() => {
    const existing = pollers.get(key)
    const poller: SharedPoller = existing ?? {
      refCount: 0, timer: null, view: null, error: "", errorStatus: null, subscribers: new Set(),
    }
    if (!existing) pollers.set(key, poller)
    const subscriber = () => setVersion((v) => v + 1)
    poller.refCount += 1
    poller.subscribers.add(subscriber)
    ensurePoller(issueId, poller)
    return () => {
      poller.refCount -= 1
      poller.subscribers.delete(subscriber)
      if (poller.refCount <= 0) stopPoller(issueId, poller)
    }
  }, [key, issueId])

  const refresh = useCallback(async () => {
    const poller = pollers.get(key)
    if (!poller) return
    await fetchOnce(issueId, poller)
  }, [key, issueId])

  const poller = pollers.get(key)
  return {
    view: poller?.view ?? null,
    error: poller?.error ?? "",
    errorStatus: poller?.errorStatus ?? null,
    refresh,
  }
}
