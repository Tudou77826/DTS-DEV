import { create } from "zustand"
import { api } from "@/lib/api"
import type { DtsCustomization } from "@/lib/types"
import { applyCustomizationLabels } from "@/lib/labels"

interface CustomizationState {
  value: DtsCustomization | null
  loading: boolean
  loaded: boolean
  attempts: number
  load: () => Promise<void>
}

export function applyThemeColor(color: string) {
  document.documentElement.style.setProperty("--primary", color)
  document.documentElement.style.setProperty("--ring", color)
  document.documentElement.style.setProperty("--sidebar-primary", color)
}

export const useCustomization = create<CustomizationState>((set, get) => ({
  value: null,
  loading: false,
  loaded: false,
  attempts: 0,
  load: async () => {
    if (get().loading || get().loaded) return
    set({ loading: true })
    try {
      const value = await api.get<DtsCustomization>("/config/customization")
      applyCustomizationLabels(value)
      document.title = value.branding.productName
      applyThemeColor(value.branding.primaryColor)
      set({ value, loaded: true, attempts: 0 })
    } catch {
      const attempts = get().attempts + 1
      set({ attempts })
      if (attempts < 20) {
        window.setTimeout(() => void get().load(), Math.min(5000, 750 * attempts))
      }
    } finally {
      set({ loading: false })
    }
  },
}))
