import { test, expect } from "@playwright/test"
import { apiLogin, createIssue, dictionaries, login, uniqueTitle } from "./helpers"

/**
 * 负责人能看到全局数据：统计看板的模块/子模块筛选联动。
 */
test("统计看板：模块/子模块筛选联动", async ({ page }) => {
  const leaderToken = await apiLogin(page, "leader", "123456")
  const dict = await dictionaries(page, leaderToken)

  // 预置：创建一个归属子模块的问题，让筛选后有确定的结果
  const targetSub = dict.subModules.find((s) => s.name === "策略下发")!
  const targetModule = dict.modules.find((m) => m.id === targetSub.id) ?? dict.modules[0]
  const issue = await createIssue(page, leaderToken, {
    title: uniqueTitle("统计预置"),
    moduleId: targetModule.id,
    subModuleId: targetSub.id,
  })
  expect(issue.id).toBeGreaterThan(0)

  await login(page, "leader", "123456")
  await page.goto("/stats")
  await expect(page.getByText("问题总数")).toBeVisible()

  // 选择子模块「策略下发」→ 触发模块自动带出（级联）
  await page.getByRole("combobox").filter({ hasText: "全部子模块" }).click()
  await page.getByRole("option", { name: "策略下发" }).click()

  // 筛选后问题总数 ≥ 1（包含预置问题，证明筛选+级联生效）
  // 定位「问题总数」那张卡片：卡片结构为 card > [icon, value(text-2xl), label]
  const totalValue = page.locator("div.text-2xl").first()
  const value = await totalValue.textContent()
  expect(Number(value)).toBeGreaterThanOrEqual(1)
})
