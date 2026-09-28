import type { ApiResponse } from "./types"

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`

/** 管理员令牌请求头 */
export const ADMIN_TOKEN_HEADER = "X-Admin-Token"
export const ADMIN_TOKEN_KEY = "dts-admin-token"
/** 统一的身份令牌头名：本地登录 / SSO 换发的 JWT 都用这个头携带。 */
export const AUTH_TOKEN_HEADER = "X-Auth-Token"
/** SSO 成功后，后端通过此响应头回传签发的 JWT（同域无感续签，跨域走显式 exchange）。 */
export const SSO_TOKEN_HEADER = "X-Auth-Token"
export const TOKEN_KEY = "dts-token"

let onUnauthorized: (() => void) | null = null
let onSsoUnauthorized: (() => void) | null = null
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

/** SSO 模式下 401 时触发的回调（由 App 注入为跳 W3 登录页）。 */
export function setOnSsoUnauthorized(cb: () => void) {
  onSsoUnauthorized = cb
}

export function setOnAdminUnauthorized(cb: () => void) {
  onAdminUnauthorized = cb
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function persistTokenFromResponse(res: Response) {
  // 同域场景：SsoAuthFilter 在首次进入/JWT 过期后，通过响应头回传新签发的 JWT。
  // 顺手存下来，后续请求即可走 JwtAuthFilter，避免每次都触发 SSO 链路。
  const refreshed = res.headers.get(SSO_TOKEN_HEADER)
  if (refreshed) localStorage.setItem(TOKEN_KEY, refreshed)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (!isFormData) headers["Content-Type"] = "application/json"
  if (token) headers[AUTH_TOKEN_HEADER] = token

  // 管理员令牌：存在则附加到管理相关请求（接入定制、基础配置、使用反馈处理）
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY)
  const isAdminPath = path.includes("/customization/admin")
      || path.startsWith("/config")
      || path.startsWith("/feedback")
      || path.startsWith("/ai-location/admin")
  if (adminToken && isAdminPath) {
    headers[ADMIN_TOKEN_HEADER] = adminToken
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  persistTokenFromResponse(res)

  if (res.status === 401) {
    // SSO 模式优先走外跳 W3 登录页；否则回到本地登录页。
    // SSO 回调未注入（如启动初期）则退回 onUnauthorized，避免卡死。
    if (onSsoUnauthorized) onSsoUnauthorized?.()
    else onUnauthorized?.()
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
      headers: token ? { [AUTH_TOKEN_HEADER]: token } : {},
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
