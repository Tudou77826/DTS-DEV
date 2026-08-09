import { NavLink, useNavigate } from "react-router-dom"
import { useState } from "react"
import {
  LayoutDashboard, ListChecks, Inbox, ClipboardList,
  BarChart3, Settings, LogOut, Moon, Sun, Plus, MessageSquareText, ShieldCheck,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useAuth } from "@/store/auth"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ROLE_LABEL } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { NotificationCenter } from "@/components/notification-center"
import { useCustomization } from "@/store/customization"

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  feature?: string
  /** 对该角色隐藏（如提出人无处理任务） */
  hiddenForRole?: string
}

const NAV_MAIN: NavItem[] = [
  { to: "/dashboard", label: "工作台", icon: LayoutDashboard },
  { to: "/issues", label: "问题列表", icon: ListChecks },
  { to: "/my-tasks", label: "我的任务", icon: Inbox, hiddenForRole: "SUBMITTER" },
]

const NAV_OTHER: NavItem[] = [
  { to: "/stats", label: "统计看板", icon: BarChart3 },
  { to: "/config", label: "基础配置", icon: Settings },
  { to: "/feedback", label: "使用反馈", icon: MessageSquareText },
]

const SIDEBAR_COLLAPSED_KEY = "dts-sidebar-collapsed"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const customization = useCustomization((state) => state.value)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1")

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const toggleSidebar = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <aside className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}>
        {/* Logo + 收起按钮 */}
        <div className={cn("flex h-14 items-center px-3", collapsed ? "justify-center" : "justify-between gap-2")}>
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ClipboardList className="size-4" />
              </div>
              <span className="truncate text-sm font-semibold tracking-tight">
                {customization?.branding.productName || "DTS"}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={toggleSidebar}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {/* 新建按钮 */}
        <div className="px-3 pb-2">
          <Button
            className={cn("w-full justify-start gap-2", collapsed && "justify-center px-0")}
            size="sm"
            onClick={() => navigate("/issues/new")}
            title={collapsed ? `新建${customization?.terminology.issue || "事项"}` : undefined}
          >
            <Plus className="size-4 shrink-0" />
            {!collapsed && `新建${customization?.terminology.issue || "事项"}`}
          </Button>
        </div>

        {/* 导航 */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {NAV_MAIN.filter((item) => (!item.feature || customization?.features[item.feature] !== false)
            && item.hiddenForRole !== user?.role).map((item) => (
            <SideLink key={item.to} {...item} collapsed={collapsed} />
          ))}
          <div className="my-2 h-px bg-sidebar-border" />
          {NAV_OTHER.map((item) => (
            <SideLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* 底部用户 */}
        <div className="border-t border-sidebar-border p-2">
          {customization?.features.notifications !== false && <div className="mb-1">
            <NotificationCenter collapsed={collapsed} />
          </div>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent",
                  collapsed && "justify-center px-0"
                )}
              >
                <UserAvatar name={user?.displayName} color={user?.avatarColor} />
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{user?.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {ROLE_LABEL[user?.role || ""]}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>{user?.displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <ShieldCheck />
                管理员页面
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {theme === "dark" ? <Sun /> : <Moon />}
                {theme === "dark" ? "切换亮色" : "切换暗色"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

function SideLink({ to, label, icon: Icon, collapsed }: NavItem & { collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  )
}

/** 页面顶部标题栏 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 页面内容容器 */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-6", className)}>{children}</div>
}
