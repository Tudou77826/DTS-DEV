import { useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { ClipboardList, Loader2 } from "lucide-react"
import { useAuth } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { useCustomization } from "@/store/customization"

export function LoginPage() {
  const { login, token } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const customization = useCustomization((state) => state.value)
  const demoAccounts = customization?.masterData.users
    .filter((account) => account.active)
    .map((account) => account.username) || []

  if (token) return <Navigate to="/dashboard" replace />

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
