import { create } from "zustand"
import { api, ApiError, ADMIN_TOKEN_KEY } from "@/lib/api"
import type { AuthMode, User } from "@/lib/types"

interface LoginResponse {
  token: string
  tokenType: string
  user: User
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  /** 认证方式：local / oauth */
  mode: "local" | "oauth" | null
  /** 拉取当前用户失败时的提示（如统一认证未通过） */
  authError: string | null
  /** 管理员共享密码门禁签发的短时令牌 */
  adminToken: string | null
  adminExpiresAt: number | null
  fetchMode: () => Promise<AuthMode>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
  verifyAdminPassword: (password: string) => Promise<void>
  logoutAdmin: () => void
  isAdminActive: () => boolean
}

function readAdminToken(): { token: string | null; expiresAt: number | null } {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  if (!token) return { token: null, expiresAt: null }
  try {
    const raw = localStorage.getItem(`${ADMIN_TOKEN_KEY}-exp`)
    const expiresAt = raw ? Number(raw) : 0
    if (expiresAt && Date.now() < expiresAt) return { token, expiresAt }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(`${ADMIN_TOKEN_KEY}-exp`)
  return { token: null, expiresAt: null }
}

function persistAdminToken(token: string, expiresInMs: number) {
  const expiresAt = Date.now() + expiresInMs
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
  localStorage.setItem(`${ADMIN_TOKEN_KEY}-exp`, String(expiresAt))
  return expiresAt
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(`${ADMIN_TOKEN_KEY}-exp`)
}

export const useAuth = create<AuthState>((set) => {
  const admin = readAdminToken()
  return {
    user: null,
    token: localStorage.getItem("dts-token"),
    loading: false,
    mode: null,
    authError: null,
    adminToken: admin.token,
    adminExpiresAt: admin.expiresAt,

    fetchMode: async () => {
      const mode = await api.get<AuthMode>("/auth/mode")
      set({ mode: mode.mode })
      return mode
    },

    login: async (username, password) => {
      const resp = await api.post<LoginResponse>("/auth/login", { username, password })
      localStorage.setItem("dts-token", resp.token)
      set({ token: resp.token, user: resp.user, authError: null })
    },

    logout: () => {
      localStorage.removeItem("dts-token")
      clearAdminToken()
      set({ token: null, user: null, authError: null, adminToken: null, adminExpiresAt: null })
    },

    hydrate: () => {
      if (useAuth.getState().loading) return
      const token = localStorage.getItem("dts-token")
      if (!token) {
        // oauth 模式无本地 token：身份由反向代理注入的用户头决定，仍尝试拉取当前用户
        set({ loading: true })
        api.get<User>("/auth/me").then((user) => set({ user, loading: false, authError: null })).catch((error) => {
          if (error instanceof ApiError && error.status === 401) {
            set({ user: null, loading: false, authError: "未登录或登录已过期" })
          } else {
            set({ user: null, loading: false, authError: null })
          }
        })
        return
      }
      set({ loading: true })
      api.get<User>("/auth/me").then((user) => set({ user, loading: false, authError: null })).catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem("dts-token")
          set({ user: null, token: null, loading: false, authError: "未登录或登录已过期" })
        } else {
          set({ loading: false })
          window.setTimeout(() => useAuth.getState().hydrate(), 1500)
        }
      })
    },

    verifyAdminPassword: async (password) => {
      const resp = await api.post<{ token: string; expiresInMs: number }>(
        "/config/customization/admin/verify",
        { password },
      )
      const expiresAt = persistAdminToken(resp.token, resp.expiresInMs)
      set({ adminToken: resp.token, adminExpiresAt: expiresAt })
    },

    logoutAdmin: () => {
      clearAdminToken()
      set({ adminToken: null, adminExpiresAt: null })
    },

    isAdminActive: () => {
      // 直接从本地存储判断，避免在 store 初始化中引用自身造成循环依赖
      const { token: adminToken, expiresAt: adminExpiresAt } = readAdminToken()
      return !!adminToken && !!adminExpiresAt && Date.now() < adminExpiresAt
    },
  }
})
