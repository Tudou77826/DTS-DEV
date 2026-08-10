import { useEffect, useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { ClipboardList, Loader2, LogIn } from "lucide-react"
import { useAuth } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { useCustomization } from "@/store/customization"

export function LoginPage() {
  const { login, token, user, mode, authError, fetchMode, redirectToSsoLogin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const customization = useCustomization((state) => state.value)
  const demoAccounts = customization?.masterData.users
    .filter((account) => account.active)
    .map((account) => account.username) || []

  useEffect(() => {
    if (!mode) {
      void fetchMode().catch(() => {})
    }
  }, [mode, fetchMode])

  // 已登录直接进系统
  if (token && user) return <Navigate to="/dashboard" replace />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username.trim(), password)
      toast.success("登录成功")
      navigate("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  const startSsoLogin = () => {
    // 外跳 W3 登录页，登录成功后回跳到 /auth/callback
    redirectToSsoLogin()
  }

  // ── SSO（统一认证）模式：跳 W3 登录页 ──
  if (mode === "sso") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardList className="size-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              {customization?.branding.productName || "DTS"}
            </span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">统一认证登录</CardTitle>
              <CardDescription>系统已接入公司统一身份认证（W3）</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <LogIn className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>点击下方按钮跳转至统一身份认证页面完成登录，登录成功后自动返回本系统。</span>
              </div>
              {authError && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                  {authError}
                </div>
              )}
              <Button type="button" disabled={loading} onClick={() => void startSsoLogin()}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                前往统一认证登录
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── 本地账号密码模式（开发/未接入统一认证时） ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="size-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">
            {customization?.branding.productName || "DTS"}
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{customization?.branding.loginTitle || "登录"}</CardTitle>
            <CardDescription>{customization?.branding.loginSubtitle || ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                登录
              </Button>
            </form>
            {customization?.branding.showDemoAccounts && <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-medium text-foreground">{customization.branding.demoAccountHint || "演示账号"}：</div>
              {demoAccounts.length > 0 ? demoAccounts.join(" · ") : "未配置演示账号"}
            </div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
