import { create } from "zustand"
import { api, ApiError } from "@/lib/api"
import type { User } from "@/lib/types"

interface LoginResponse {
  token: string
  tokenType: string
  user: User
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("dts-token"),
  loading: false,

  login: async (username, password) => {
    const resp = await api.post<LoginResponse>("/auth/login", { username, password })
    localStorage.setItem("dts-token", resp.token)
    set({ token: resp.token, user: resp.user })
  },

  logout: () => {
    localStorage.removeItem("dts-token")
    set({ token: null, user: null })
  },

  hydrate: () => {
    if (useAuth.getState().loading) return
    const token = localStorage.getItem("dts-token")
    if (!token) {
      set({ user: null })
      return
    }
    set({ loading: true })
    api.get<User>("/auth/me").then((user) => set({ user, loading: false })).catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem("dts-token")
        set({ user: null, token: null, loading: false })
      } else {
        set({ loading: false })
        window.setTimeout(() => useAuth.getState().hydrate(), 1500)
      }
    })
  },
}))
