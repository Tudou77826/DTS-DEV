import { defineConfig } from "@playwright/test"

/**
 * E2E 配置：使用完全隔离的环境，避免污染本地开发数据。
 * - 后端：独立端口 8081 + 独立 SQLite 库 + 独立接入配置文件（e2e/backend-server.mjs）
 * - 前端：vite dev 跑在 5174，/api 代理到 8081
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node e2e/backend-server.mjs",
      url: "http://localhost:8081/api/auth/mode",
      // CI 每次新起；本地若已有 E2E 后端在跑（如调试时手动启动）则复用
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: "npm run dev -- --port 5174",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_TARGET: "http://localhost:8081" },
    },
  ],
})
