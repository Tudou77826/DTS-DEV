import { create } from "zustand"
import { api, ApiError, ADMIN_TOKEN_KEY, TOKEN_KEY } from "@/lib/api"
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
  /** 认证方式：local = 本地账号密码；sso = 公司统一身份源（W3/W3X） */
  mode: "local" | "sso" | null
  /** SSO 登录页地址（仅 mode=sso 时有意义，401 时外跳） */
  ssoLoginPageUrl: string | null
  /** SSO 登录页识别的回跳参数名 */
  ssoRedirectParam: string | null
  /** W3 登录成功后回跳 URL 中携带 SSO 凭证的参数名（前端按此取凭证再换 token） */
  ssoCredentialParam: string | null
  /** 拉取当前用户失败时的提示（如统一认证未通过） */
  authError: string | null
  /** 管理员共享密码门禁签发的短时令牌 */
  adminToken: string | null
  adminExpiresAt: number | null
  fetchMode: () => Promise<AuthMode>
  login: (username: string, password: string) => Promise<void>
  /**
   * 用 W3 回跳带回的凭证换取本系统 JWT（SSO 模式专用）。
   * 跨域场景下浏览器 JS 读不到 W3 cookie，必须由 W3 把凭证回带到前端 URL，
   * 再由此方法 POST 给后端换 token。
   */
  ssoExchange: (credential: string) => Promise<void>
  /** 外跳 W3 登录页（回跳地址固定为前端的 /auth/callback）。 */
  redirectToSsoLogin: () => void
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

export const useAuth = create<AuthState>((set, get) => {
  const admin = readAdminToken()
  return {
    user: null,
    token: localStorage.getItem(TOKEN_KEY),
    loading: false,
    mode: null,
    ssoLoginPageUrl: null,
    ssoRedirectParam: null,
    ssoCredentialParam: null,
    authError: null,
    adminToken: admin.token,
    adminExpiresAt: admin.expiresAt,

    fetchMode: async () => {
      const mode = await api.get<AuthMode>("/auth/mode")
      set({
        mode: mode.mode,
        ssoLoginPageUrl: mode.ssoLoginPageUrl ?? null,
        ssoRedirectParam: mode.ssoRedirectParam ?? null,
        ssoCredentialParam: mode.ssoCredentialParam ?? null,
      })
      return mode
    },

    login: async (username, password) => {
      const resp = await api.post<LoginResponse>("/auth/login", { username, password })
      localStorage.setItem(TOKEN_KEY, resp.token)
      set({ token: resp.token, user: resp.user, authError: null })
    },

    ssoExchange: async (credential) => {
      // 跨域场景：前端把 W3 回跳带回的凭证 POST 给后端，后端调 W3X 换用户信息并签发本系统 JWT。
      const resp = await api.post<LoginResponse>("/auth/sso/exchange", { credential })
      localStorage.setItem(TOKEN_KEY, resp.token)
      set({ token: resp.token, user: resp.user, authError: null })
    },

    redirectToSsoLogin: () => {
      const { ssoLoginPageUrl, ssoRedirectParam } = get()
      if (!ssoLoginPageUrl) {
        // 配置缺失时退回本地登录页，避免卡死。
        set({ authError: "SSO 登录页未配置" })
        return
      }
      const param = ssoRedirectParam || "redirect"
      // 回跳地址固定指向前端 /auth/callback 页：W3 登录成功后带凭证回跳到这里，
      // 由 AuthCallback 组件取凭证并调 ssoExchange 换 token。
      const callbackUrl = `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`
      const sep = ssoLoginPageUrl.includes("?") ? "&" : "?"
      window.location.href = `${ssoLoginPageUrl}${sep}${param}=${encodeURIComponent(callbackUrl)}`
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      clearAdminToken()
      set({ token: null, user: null, authError: null, adminToken: null, adminExpiresAt: null })
    },

    hydrate: () => {
      if (useAuth.getState().loading) return
      const token = localStorage.getItem(TOKEN_KEY)
      const currentMode = useAuth.getState().mode
      if (!token) {
        // 无本地 token：
        // - sso 模式：跨域场景浏览器不会自动带 W3 cookie，直接判未登录，由 /login 引导跳 W3。
        //   （若部署在同域，SsoAuthFilter 会在首个请求里隐式换发 JWT 并通过响应头回传，
        //    persistTokenFromResponse 会存下来；此处无需主动调 exchange。）
        // - local 模式：直接判未登录。
        if (currentMode === "sso") {
          set({ user: null, loading: false, authError: "请通过统一认证登录" })
          return
        }
        // local / mode 未知：尝试拉当前用户，失败则提示未登录
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
          localStorage.removeItem(TOKEN_KEY)
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
