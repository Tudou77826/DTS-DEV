import { expect, Page } from "@playwright/test"

/** 后端经 vite 代理暴露的 API 前缀（与前端 api.ts 一致）。 */
export const API = "/api"

/** 生成唯一标题，避免用例间数据冲突。 */
export function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`
}

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码").fill(password)
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page.getByRole("link", { name: "工作台" })).toBeVisible()
}

export async function logout(page: Page) {
  await page.locator("aside button").filter({ hasText: /负责人|开发人员|提出人/ }).first().click()
  await page.getByRole("menuitem", { name: "退出登录" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// ─── API 预置（经 vite 代理直达后端，绕开 UI 长前置路径） ───

export async function apiLogin(page: Page, username: string, password: string): Promise<string> {
  const res = await page.request.post(`${API}/auth/login`, { data: { username, password } })
  const body = await res.json()
  if (body.code !== 0) throw new Error(`登录失败 ${username}: ${body.message}`)
  return body.data.token as string
}

async function apiGet(page: Page, path: string, token: string) {
  const res = await page.request.get(`${API}${path}`, { headers: { "X-Auth-Token": token } })
  const body = await res.json()
  if (body.code !== 0) throw new Error(`GET ${path} 失败: ${body.message}`)
  return body.data
}

async function apiPost(page: Page, path: string, token: string | null, body: unknown) {
  const headers: Record<string, string> = {}
  if (token) headers["X-Auth-Token"] = token
  const res = await page.request.post(`${API}${path}`, { headers, data: body })
  const parsed = await res.json()
  if (parsed.code !== 0) throw new Error(`POST ${path} 失败: ${parsed.message}`)
  return parsed.data
}

export interface Dictionaries {
  modules: Array<{ id: number; name: string }>
  subModules: Array<{ id: number; name: string }>
  developers: Array<{ id: number; username: string; displayName: string }>
  products: Array<{ id: number; name: string }>
  versions: Array<{ id: number; version: string }>
  users: Array<{ id: number; username: string; displayName: string; role: string; subModuleId: number | null }>
}

export async function dictionaries(page: Page, token: string): Promise<Dictionaries> {
  return apiGet(page, "/config/dictionaries", token) as Promise<Dictionaries>
}

export async function createIssue(
  page: Page,
  token: string,
  opts: { title: string; moduleId: number; subModuleId?: number; description?: string },
) {
  return apiPost(page, "/issues", token, {
    moduleId: opts.moduleId,
    title: opts.title,
    description: opts.description ?? "E2E 预置问题",
    vpnInfo: "VPN-E2E",
    priority: "HIGH",
    ...(opts.subModuleId ? { subModuleId: opts.subModuleId } : {}),
  }) as Promise<{ id: number; status: string; code: string }>
}

export async function assign(page: Page, token: string, issueId: number, assigneeId: number) {
  return apiPost(page, `/issues/${issueId}/assign`, token, { assigneeId })
}

export async function transition(
  page: Page,
  token: string,
  issueId: number,
  body: { status: string; remark?: string; issueFlag?: string; dtsTicketNo?: string; resolution?: string },
) {
  return apiPost(page, `/issues/${issueId}/status`, token, body)
}

export async function registerSubmitter(page: Page, username: string, displayName: string) {
  const res = await page.request.post(`${API}/auth/register`, {
    data: { employeeNo: `E2E-${username}`, username, displayName, password: "123456" },
  })
  const body = await res.json()
  if (body.code !== 0) throw new Error(`注册提出人失败 ${username}: ${body.message}`)
  return body.data.user as { id: number; role: string }
}

/** 预置一条「已分配给指定处理人且已处理中」的问题，返回 id。 */
export async function presetProcessingIssue(
  page: Page,
  opts: { leaderToken: string; devId: number; subModuleId?: number },
) {
  const dict = await dictionaries(page, opts.leaderToken)
  const issue = await createIssue(page, opts.leaderToken, {
    title: uniqueTitle("预置处理中"),
    moduleId: dict.modules[0].id,
    subModuleId: opts.subModuleId,
  })
  await assign(page, opts.leaderToken, issue.id, opts.devId)
  const devToken = await apiLogin(page, "wangwu", "123456")
  await transition(page, devToken, issue.id, { status: "PROCESSING" })
  return issue.id
}

export async function adminUnlock(page: Page) {
  await page.goto("/admin")
  await page.getByPlaceholder("输入共享管理员密码").fill("123456")
  await page.getByRole("button", { name: "验证并进入" }).click()
  await expect(page.getByRole("tab", { name: /接入定制/ })).toBeVisible()
}
