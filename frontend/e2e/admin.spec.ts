import { test, expect, Page } from "@playwright/test"
import { adminUnlock, login, uniqueTitle } from "./helpers"

/**
 * 管理员职责：密码门禁（错误拒/正确进）；主数据增删即时生效。
 * 注意：/admin 在 Protected 路由下，需先登录任意账号才能进入门禁页。
 */
test.describe("管理员页面", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "leader", "123456")
  })

  test("密码门禁：错误密码被拒，正确密码进入", async ({ page }) => {
    await page.goto("/admin")
    const pwdInput = page.getByPlaceholder("输入共享管理员密码")

    // 错误密码：仍在门禁页（不进入管理界面）
    await pwdInput.fill("wrong-password")
    await page.getByRole("button", { name: "验证并进入" }).click()
    await expect(page.getByRole("tab", { name: /接入定制/ })).toHaveCount(0)

    // 重新加载页面清除失败尝试的残留状态，再用正确密码进入
    await page.goto("/admin")
    await page.getByPlaceholder("输入共享管理员密码").fill("123456")
    await page.getByRole("button", { name: "验证并进入" }).click()
    await expect(page.getByRole("tab", { name: /接入定制/ })).toBeVisible()
  })

  test("主数据：添加/删除产品即时生效并写回配置", async ({ page }) => {
    await adminUnlock(page)
    // 进入 接入定制 → 主数据 tab（内嵌基础配置）
    await page.getByRole("tab", { name: /主数据/ }).click()
    const productName = uniqueTitle("E2E产品")
    // 产品 tab 默认选中，输入并添加
    await page.getByPlaceholder("产品名称").fill(productName)
    await page.getByRole("button", { name: "添加", exact: true }).click()
    // 立即出现在列表
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 })
    // 刷新后仍在（写回生效）
    await page.reload()
    await page.getByRole("tab", { name: /主数据/ }).click()
    await expect(page.getByText(productName)).toBeVisible()

    // 删除该产品（行内删除按钮 → 确认删除）
    await deleteProductRow(page, productName)
    await expect(page.getByText(productName)).toHaveCount(0)
  })
})

async function deleteProductRow(page: Page, name: string) {
  const row = page.locator("div.divide-y.divide-border > div").filter({ hasText: name }).first()
  await row.getByRole("button").first().click() // 垃圾桶
  await page.getByRole("button", { name: "确认删除" }).click()
}
