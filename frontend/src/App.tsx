import { useEffect } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/store/auth"
import { setOnUnauthorized } from "@/lib/api"
import { AppLayout } from "@/components/app-layout"
import { LoginPage } from "@/pages/login"
import { DashboardPage } from "@/pages/dashboard"
import { IssueListPage } from "@/pages/issue-list"
import { IssueNewPage } from "@/pages/issue-new"
import { IssueDetailPage } from "@/pages/issue-detail"
import { MyTasksPage } from "@/pages/my-tasks"
import { InvestigationPage } from "@/pages/investigation"
import { StatsPage } from "@/pages/stats"
import { ConfigPage } from "@/pages/config"
import { CustomizationPage } from "@/pages/customization"
import { useCustomization } from "@/store/customization"

function Protected({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setOnUnauthorized(() => navigate("/login"))
  }, [navigate])

  if (!token) return <Navigate to="/login" replace />
  if (!user) {
    // 已有 token 但还没拉到用户，触发 hydrate
    useAuth.getState().hydrate()
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">加载中…</div>
  }
  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  const loadCustomization = useCustomization((state) => state.load)
  useEffect(() => { void loadCustomization() }, [loadCustomization])
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/issues" element={<Protected><IssueListPage /></Protected>} />
      <Route path="/issues/new" element={<Protected><IssueNewPage /></Protected>} />
      <Route path="/issues/:id" element={<Protected><IssueDetailPage /></Protected>} />
      <Route path="/my-tasks" element={<Protected><MyTasksPage /></Protected>} />
      <Route path="/investigations" element={<Protected><InvestigationPage /></Protected>} />
      <Route path="/stats" element={<Protected><StatsPage /></Protected>} />
      <Route path="/config" element={<Protected><ConfigPage /></Protected>} />
      <Route path="/customization" element={<Protected><CustomizationPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
