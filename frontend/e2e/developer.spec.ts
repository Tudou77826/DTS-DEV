import { test, expect } from "@playwright/test"
import {
  apiLogin, assign, createIssue, dictionaries, login, transition, uniqueTitle,
} from "./helpers"

/**
 * 开发者职责：我的任务入口能看到分配给我的问题；已解决须按是/非问题标注。
 */
test.describe("开发者处理", () => {
  test("我的任务展示分配给我的问题并可进入处理", async ({ page }) => {
    // 预置：leader 建问题并分配给 wangwu（保持待处理）
    const leaderToken = await apiLogin(page, "leader", "123456")
    const dict = await dictionaries(page, leaderToken)
    const wangwu = dict.developers.find((d) => d.username === "wangwu")!
    const title = uniqueTitle("我的任务")
    const issue = await createIssue(page, leaderToken, { title, moduleId: dict.modules[0].id })
    await assign(page, leaderToken, issue.id, wangwu.id)

    // 开发者登录：「我的任务」能看到该问题
    await login(page, "wangwu", "123456")
    await page.goto("/my-tasks")
    await expect(page.getByText(title)).toBeVisible()

    // 进入详情，可执行流转（开始处理）
    await page.getByText(title).click()
    await expect(page).toHaveURL(`/issues/${issue.id}`)
    await page.getByRole("button", { name: "流转状态" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
    await page.getByRole("option", { name: "处理中" }).click()
    await dialog.getByRole("button", { name: "确认流转" }).click()
    await expect(page.getByText(/处理中/).first()).toBeVisible({ timeout: 10_000 })
  })

  test("已解决：标注是问题必填 DTS 单号", async ({ page }) => {
    const devToken = await apiLogin(page, "wangwu", "123456")
    const leaderToken = await apiLogin(page, "leader", "123456")
    const dict = await dictionaries(page, leaderToken)
    const title = uniqueTitle("是问题")
    const issue = await createIssue(page, leaderToken, { title, moduleId: dict.modules[0].id })
    await assign(page, leaderToken, issue.id, dict.developers[0].id)
    await transition(page, devToken, issue.id, { status: "PROCESSING" })

    await login(page, "wangwu", "123456")
    await page.goto(`/issues/${issue.id}`)
    await page.getByRole("button", { name: "流转状态" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
    await page.getByRole("option", { name: "已解决" }).click()
    await dialog.getByPlaceholder("填写处理经过与结果").fill("修复完成")
    await dialog.getByRole("button", { name: "是问题" }).click()
    // 不填 DTS 直接点确认 → 被拦截（按钮禁用）
    const confirmBtn = dialog.getByRole("button", { name: "确认流转" })
    await expect(confirmBtn).toBeDisabled()
    // 填入 DTS 后可提交
    await dialog.getByPlaceholder("请填写 DTS 系统问题单号").fill("DTS-E2E-PROBLEM")
    await confirmBtn.click()
    await expect(page.getByText(/已解决/).first()).toBeVisible({ timeout: 10_000 })
  })

  test("已解决：标注非问题无需 DTS 单号", async ({ page }) => {
    const devToken = await apiLogin(page, "wangwu", "123456")
    const leaderToken = await apiLogin(page, "leader", "123456")
    const dict = await dictionaries(page, leaderToken)
    const title = uniqueTitle("非问题")
    const issue = await createIssue(page, leaderToken, { title, moduleId: dict.modules[0].id })
    await assign(page, leaderToken, issue.id, dict.developers[0].id)
    await transition(page, devToken, issue.id, { status: "PROCESSING" })

    await login(page, "wangwu", "123456")
    await page.goto(`/issues/${issue.id}`)
    await page.getByRole("button", { name: "流转状态" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox").filter({ hasText: "选择目标状态" }).click()
    await page.getByRole("option", { name: "已解决" }).click()
    await dialog.getByPlaceholder("填写处理经过与结果").fill("环境误报")
    await dialog.getByRole("button", { name: "非问题" }).click()
    // 非问题需要处理结论
    const confirmBtn = dialog.getByRole("button", { name: "确认流转" })
    await expect(confirmBtn).toBeDisabled()
    await dialog.getByPlaceholder(/判定为非问题/).fill("经排查为环境误报，非系统问题")
    await confirmBtn.click()
    await expect(page.getByText(/已解决/).first()).toBeVisible({ timeout: 10_000 })
  })

  test("非责任人看不到流转目标状态（按钮级权限）", async ({ page }) => {
    const leaderToken = await apiLogin(page, "leader", "123456")
    const dict = await dictionaries(page, leaderToken)
    // 分配给 wangwu，zhaoliu 登录查看
    const title = uniqueTitle("越权")
    const issue = await createIssue(page, leaderToken, { title, moduleId: dict.modules[0].id })
    await assign(page, leaderToken, issue.id, dict.developers[0].id)

    await login(page, "zhaoliu", "123456")
    await page.goto(`/issues/${issue.id}`)
    // 非责任人：无「流转状态」按钮（IssueActions 按 assigneeId 过滤）
    await expect(page.getByRole("button", { name: "流转状态" })).toHaveCount(0)
  })
})
