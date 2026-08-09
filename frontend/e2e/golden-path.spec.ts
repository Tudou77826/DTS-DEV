import { test, expect, Page } from "@playwright/test"

/**
 * 黄金路径 E2E：问题全生命周期。
 * leader（提出人）新建 → 分配 wangwu → wangwu 处理中/已解决（DTS）→ leader 关闭。
 */
test.describe("问题黄金路径", () => {
  test("新建 → 分配 → 处理中 → 已解决（DTS）→ 关闭", async ({ page }) => {
    // 1. 提出人登录并新建问题
    await login(page, "leader", "123456")
    await expect(page.getByRole("link", { name: "问题列表" })).toBeVisible()

    await page.goto("/issues/new")
    const title = `E2E黄金路径-${Date.now().toString().slice(-6)}`
    await page.getByPlaceholder(/概括问题/).fill(title)
    await page.locator("[contenteditable=true]").fill("E2E 测试问题描述：验证全生命周期闭环")
    await page.getByRole("combobox").filter({ hasText: "选择模块" }).click()
    await page.getByRole("option", { name: "入侵检测" }).click()
    await page.getByPlaceholder("VPN 连接信息").fill("VPN-E2E")
    await page.getByRole("button", { name: "创建问题" }).click()
    await expect(page).toHaveURL(/\/issues\/\d+$/)
    const issueId = page.url().split("/").pop()!
    await expect(page.getByText(title)).toBeVisible()

    // 2. 提出人分配责任人 wangwu（待分配 → 待处理）
    await page.getByRole("button", { name: "分配/调整" }).click()
    const assignDialog = page.getByRole("dialog")
    await assignDialog.getByRole("combobox").filter({ hasText: "选择开发人员" }).click()
    await page.getByRole("button", { name: "王五" }).click()
    await assignDialog.getByRole("button", { name: "保存" }).click()
    await expect(page.getByText(/待处理/).first()).toBeVisible({ timeout: 10_000 })

    // 3. 责任人 wangwu 开始处理（待处理 → 处理中）
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
    await dialog.getByPlaceholder("填写处理经过与结果").fill("已修复，E2E 验证")
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
})

async function login(page: Page, username: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码").fill(password)
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page.getByRole("link", { name: "工作台" })).toBeVisible()
}

async function logout(page: Page) {
  // 左下角用户菜单
  await page.locator("aside button").filter({ hasText: /负责人|开发人员|提出人/ }).first().click()
  await page.getByRole("menuitem", { name: "退出登录" }).click()
  await expect(page).toHaveURL(/\/login$/)
}
