import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/store/auth"
import { toast } from "sonner"

/**
 * W3 登录成功后的回跳落点。
 *
 * 流程：用户在 W3 登录成功 → W3 回跳到 /auth/callback?{credentialParam}=<凭证>
 *   → 本组件按 mode 里的 ssoCredentialParam 取出凭证 → 调 ssoExchange 换本系统 JWT
 *   → 成功跳 /dashboard，失败回 /login 并提示。
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { mode, ssoCredentialParam, ssoExchange, fetchMode } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const run = async () => {
      // mode 还没拉到时先拉一次（用户直接访问 /auth/callback 的兜底）
      const m = mode ? { mode, ssoCredentialParam } : await fetchMode()
      if (m.mode !== "sso") {
        setError("当前未启用统一认证")
        navigate("/login", { replace: true })
        return
      }
      const param = m.ssoCredentialParam || "token"
      const credential = params.get(param)
      if (!credential) {
        toast.error("未收到统一认证凭证，请重新登录")
        navigate("/login", { replace: true })
        return
      }
      try {
        await ssoExchange(credential)
        toast.success("登录成功")
        navigate("/dashboard", { replace: true })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "统一认证失败，请重试")
        navigate("/login", { replace: true })
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span>正在完成统一认证登录…</span>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
