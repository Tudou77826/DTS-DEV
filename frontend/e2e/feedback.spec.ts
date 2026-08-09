import { test, expect } from "@playwright/test"
import { adminUnlock, login, registerSubmitter, uniqueTitle } from "./helpers"

/**
 * 反馈闭环（跨角色）：提出人提交使用反馈 → 管理员在处理页看到并回复 → 状态变已处理。
 */
test("反馈闭环：提出人提交，管理员处理", async ({ page }) => {
  // 1. 提出人提交反馈
  const username = `fb_${Date.now().toString().slice(-5)}`
  await registerSubmitter(page, username, "E2E反馈人")
  await login(page, username, "123456")
  const content = `反馈内容-${Date.now().toString().slice(-6)}`
  await page.goto("/feedback")
  await page.locator("[contenteditable=true]").fill(content)
  await page.getByRole("button", { name: /提交反馈/ }).click()
  await expect(page.getByText("反馈已提交")).toBeVisible({ timeout: 10_000 })
  // 反馈列表区出现该条（列表项容器内含该文本）
  await expect(page.locator(".divide-y > div", { hasText: content })).toBeVisible({ timeout: 10_000 })

  // 2. 管理员处理该条反馈
  await adminUnlock(page)
  await page.getByRole("tab", { name: /使用反馈处理/ }).click()
  // 定位到刚提交的那一条（按内容匹配），在其行内填回复并处理
  const feedbackRow = page.locator(".divide-y > div", { hasText: content })
  await expect(feedbackRow).toBeVisible({ timeout: 10_000 })
  await feedbackRow.getByPlaceholder(/处理回复/).fill("已收到，感谢反馈")
  await feedbackRow.getByRole("button", { name: "处理", exact: true }).click()
  // 处理完成后该条显示回复与「已处理」标记
  await expect(feedbackRow.getByText("已收到，感谢反馈")).toBeVisible({ timeout: 10_000 })
  await expect(feedbackRow.getByText("已处理")).toBeVisible()
})
