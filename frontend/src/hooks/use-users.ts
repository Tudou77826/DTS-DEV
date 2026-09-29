import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"

let cache: User[] | null = null
let inflight: Promise<User[]> | null = null
const subscribers = new Set<(users: User[]) => void>()

async function load(): Promise<User[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = api
      .get<User[]>("/config/users")
      .then((users) => {
        cache = users
        for (const subscriber of subscribers) subscriber(users)
        return users
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** 全量用户清单（用于 id → 姓名解析）。模块级缓存，整个会话只拉一次。 */
export function useUsers(): User[] {
  const [users, setUsers] = useState<User[]>(cache ?? [])
  useEffect(() => {
    if (cache) {
      setUsers(cache)
      return
    }
    const subscriber = (next: User[]) => setUsers(next)
    subscribers.add(subscriber)
    void load().catch(() => {
      /* 失败保持空列表，调用方按 id 兜底展示 */
    })
    return () => {
      subscribers.delete(subscriber)
    }
  }, [])
  return users
}
