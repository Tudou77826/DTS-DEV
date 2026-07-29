import type { ApiResponse } from "./types"

const BASE = "/api"

let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb
}

function getToken() {
  return localStorage.getItem("dts-token")
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    onUnauthorized?.()
    throw new Error("未登录或登录已过期")
  }

  let body: ApiResponse<T>
  try {
    body = await res.json()
  } catch {
    throw new Error(`请求失败 (${res.status})`)
  }

  if (body.code !== 0) {
    throw new Error(body.message || `请求失败 (${res.status})`)
  }
  return body.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
