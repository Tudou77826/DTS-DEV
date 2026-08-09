import { test, expect } from "@playwright/test"
import { login, logout, uniqueTitle } from "./helpers"

/**
 * 跨角色完整闭环：提出人新建 → 分配 → 开发者处理/解决（DTS）→ 提出人关闭。
 * 一条用例守住整条业务链路的连通性。
 */
test("完整业务闭环：新建 → 分配 → 处理 → 解决 → 关闭", async ({ page }) => {
  // 1. 提出人登录并新建问题
  await login(page, "leader", "123456")
  const title = uniqueTitle("闭环")
  await page.goto("/issues/new")
  await page.getByPlaceholder(/概括问题/).fill(title)
  await page.locator("[contenteditable=true]").fill("E2E 全生命周期闭环验证")
  await page.getByRole("combobox").filter({ hasText: "选择模块" }).click()
  await page.getByRole("option", { name: "入侵检测" }).click()
  await page.getByPlaceholder("VPN 连接信息").fill("VPN-E2E")
  await page.getByRole("button", { name: "创建问题" }).click()
  await expect(page).toHaveURL(/\/issues\/\d+$/)
  const issueId = page.url().split("/").pop()!
  await expect(page.getByText(title)).toBeVisible()

  // 2. 负责人分配责任人 wangwu（待分配 → 待处理）
  await page.getByRole("button", { name: "分配/调整" }).click()
  const assignDialog = page.getByRole("dialog")
  await assignDialog.getByRole("combobox").filter({ hasText: "选择开发人员" }).click()
  await page.getByRole("button", { name: "王五" }).click()
  await assignDialog.getByRole("button", { name: "保存" }).click()
  await expect(page.getByText(/待处理/).first()).toBeVisible({ timeout: 10_000 })

  // 3. 开发者开始处理（待处理 → 处理中）
  await logout(page)
  await login(page, "wangwu", "123456")
  await page.goto(`/issues/${issueId}`)
  await page.getByRole("button", { name: "流转状态" }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
  await page.getByRole("option", { name: "处理中" }).click()
  await dialog.getByRole("button", { name: "确认流转" }).click()
  await expect(page.getByText(/处理中/).first()).toBeVisible({ timeout: 10_000 })

  // 4. 已解决：处理描述 + 标注是问题 + DTS 单号
  await page.getByRole("button", { name: "流转状态" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
  await page.getByRole("option", { name: "已解决" }).click()
  await dialog.getByPlaceholder("填写处理经过与结果").fill("已修复")
  await dialog.getByRole("button", { name: "是问题" }).click()
  await dialog.getByPlaceholder("请填写 DTS 系统问题单号").fill("DTS-E2E-001")
  await dialog.getByRole("button", { name: "确认流转" }).click()
  await expect(page.getByText(/已解决/).first()).toBeVisible({ timeout: 10_000 })

  // 5. 提出人关闭
  await logout(page)
  await login(page, "leader", "123456")
  await page.goto(`/issues/${issueId}`)
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole("button", { name: "流转状态" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
  await page.getByRole("option", { name: "已关闭" }).click()
  await dialog.getByRole("button", { name: "是问题" }).click()
  await dialog.getByRole("button", { name: "确认流转" }).click()
  await expect(page.getByText(/已关闭/).first()).toBeVisible({ timeout: 10_000 })
})
