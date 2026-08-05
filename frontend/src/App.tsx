import { useEffect } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/store/auth"
import { setOnAdminUnauthorized, setOnUnauthorized } from "@/lib/api"
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
  const { token, user, mode, authError, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setOnUnauthorized(() => navigate("/login"))
    // 管理员令牌失效时清除管理员会话，回到管理页的密码门禁
    setOnAdminUnauthorized(() => useAuth.getState().logoutAdmin())
    // 确认当前认证方式（local / oauth）
    if (!mode) void useAuth.getState().fetchMode()
  }, [navigate, mode])

  // local 模式必须有本地 token；oauth 模式身份由代理头决定
  if (!token && mode === "local") return <Navigate to="/login" replace />
  if (!user && authError) return <Navigate to="/login" replace />
  if (!user) {
    // 还没拉到用户，触发 hydrate（oauth 模式下后端靠代理头认证）
    if (!loading) useAuth.getState().hydrate()
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
