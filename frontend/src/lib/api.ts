import type { ApiResponse } from "./types"

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`

/** 管理员令牌请求头 */
export const ADMIN_TOKEN_HEADER = "X-Admin-Token"
export const ADMIN_TOKEN_KEY = "dts-admin-token"

let onUnauthorized: (() => void) | null = null
let onAdminUnauthorized: (() => void) | null = null

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb
}

export function setOnAdminUnauthorized(cb: () => void) {
  onAdminUnauthorized = cb
}

function getToken() {
  return localStorage.getItem("dts-token")
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (!isFormData) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`

  // 管理员令牌：存在则附加到接入定制相关的管理请求
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY)
  const isAdminPath = path.includes("/customization/admin")
  if (adminToken && (isAdminPath || path.startsWith("/config"))) {
    headers[ADMIN_TOKEN_HEADER] = adminToken
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    onUnauthorized?.()
    throw new ApiError("未登录或登录已过期", 401)
  }

  let body: ApiResponse<T>
  try {
    body = await res.json()
  } catch {
    throw new ApiError(`请求失败 (${res.status})`, res.status)
  }

  if (body.code !== 0) {
    // 管理员令牌失效/无权限：清除管理员会话
    if (res.status === 401 || res.status === 403) {
      if (isAdminPath) onAdminUnauthorized?.()
    }
    throw new ApiError(body.message || `请求失败 (${res.status})`, res.status)
  }
  return body.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
  download: async (path: string, fallbackName: string) => {
    const token = getToken()
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`下载失败 (${res.status})`)
    const blob = await res.blob()
    const disposition = res.headers.get("Content-Disposition") || ""
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
    const name = encoded ? decodeURIComponent(encoded) : fallbackName
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  },
}
