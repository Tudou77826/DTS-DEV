import { test, expect } from "@playwright/test"
import { dictionaries, login, registerSubmitter, uniqueTitle } from "./helpers"

/**
 * 提出人完整视角：注册 → 创建 → 列表只见自己 → 无管理能力。
 * 守住「提出人只能创建和查看自己的问题，不能管理」的职责边界。
 */
test("提出人完整视角：创建、只见自己、无管理能力", async ({ page }) => {
  // 1. 注册新提出人（local 模式无统一认证，通过注册接口建档）
  const username = `submitter_${Date.now().toString().slice(-5)}`
  const user = await registerSubmitter(page, username, "E2E提出人")
  expect(user.role).toBe("SUBMITTER")

  // 2. 提出人登录：侧边栏不应有「我的任务」
  await login(page, username, "123456")
  await expect(page.getByRole("link", { name: "我的任务" })).toHaveCount(0)

  // 3. 创建问题
  const title = uniqueTitle("提出人创建")
  await page.goto("/issues/new")
  await page.getByPlaceholder(/概括问题/).fill(title)
  await page.locator("[contenteditable=true]").fill("提出人视角验证")
  await page.getByRole("combobox").filter({ hasText: "选择模块" }).click()
  await page.getByRole("option", { name: "入侵检测" }).click()
  await page.getByPlaceholder("VPN 连接信息").fill("VPN-E2E")
  await page.getByRole("button", { name: "创建问题" }).click()
  await expect(page).toHaveURL(/\/issues\/\d+$/)
  const issueId = page.url().split("/").pop()!

  // 4. 列表默认只看自己提交的问题（自动作用域）
  await page.goto("/issues")
  await expect(page.getByText(title)).toBeVisible()
  // 提出人筛选默认「我提交的问题」
  await expect(page.getByRole("combobox").filter({ hasText: "我提交的问题" })).toBeVisible()

  // 5. 详情页：提出人无分配/流转能力
  await page.goto(`/issues/${issueId}`)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole("button", { name: "分配/调整" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "流转状态" })).toHaveCount(0)
})
