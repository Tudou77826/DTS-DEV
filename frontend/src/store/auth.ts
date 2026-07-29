import { create } from "zustand"
import { api } from "@/lib/api"
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
    const token = localStorage.getItem("dts-token")
    if (!token) {
      set({ user: null })
      return
    }
    api.get<User>("/auth/me").then((user) => set({ user })).catch(() => {
      localStorage.removeItem("dts-token")
      set({ user: null, token: null })
    })
  },
}))
