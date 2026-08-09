/**
 * E2E 专用后端启动器：
 * - 使用独立端口 8081（不与本地开发后端 8080 冲突）
 * - 使用独立 SQLite 库（target/e2e/dts-e2e.db，先删后建）
 * - 使用独立接入配置（从 classpath 默认配置复制，E2E 的字典写回只影响该副本）
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "..", "..") // e2e/ → frontend/ → 仓库根
const backend = path.join(repo, "backend")

// 1. 准备隔离目录与数据库
const e2eDir = path.join(backend, "target", "e2e")
fs.mkdirSync(e2eDir, { recursive: true })
const db = path.join(e2eDir, "dts-e2e.db")
try { fs.rmSync(db, { force: true }) } catch { /* 忽略占用 */ }

// 2. 复制 classpath 默认配置为 E2E 配置（E2E 写回只动这个副本）
const srcConfig = path.join(backend, "src", "main", "resources", "dts-customization.yml")
const dstConfig = path.join(e2eDir, "dts-e2e-customization.yml")
fs.copyFileSync(srcConfig, dstConfig)

// 3. 定位 mvn（本地 PATH 无 mvn，给全路径兜底；CI/Linux 用环境内 mvn）
const mvnCandidates = [
  process.env.MVN,
  process.env.MAVEN_HOME ? path.join(process.env.MAVEN_HOME, "bin", process.platform === "win32" ? "mvn.cmd" : "mvn") : null,
  process.platform === "win32" ? "C:/Program Files/Maven/apache-maven-3.9.11/bin/mvn.cmd" : null,
  "mvn",
].filter(Boolean)
const mvn = mvnCandidates[0]

// 4. 启动：sqlite profile + 覆盖 datasource/外部配置/端口
const env = {
  ...process.env,
  SPRING_DATASOURCE_URL: "jdbc:sqlite:target/e2e/dts-e2e.db",
  APP_CUSTOMIZATION_EXTERNAL_FILE: "target/e2e/dts-e2e-customization.yml",
  SERVER_PORT: "8081",
  // 关闭 swagger 等噪音，加快启动
  SPRINGDOC_ENABLED: "false",
  DTS_AUTH_LOCAL_ENABLED: "true",
  DTS_OAUTH_HEADER_ENABLED: "false",
}

console.log("[e2e-backend] mvn =", mvn)
console.log("[e2e-backend] db =", db)
console.log("[e2e-backend] config =", dstConfig)

// Windows 下 .cmd 需要 cmd.exe 包装；Linux/CI 直接执行 mvn
const spawnArgs = process.platform === "win32"
  ? { command: "C:\\Windows\\System32\\cmd.exe", args: ["/c", mvn, "-q", "spring-boot:run", "-Dspring-boot.run.profiles=sqlite"] }
  : { command: mvn, args: ["-q", "spring-boot:run", "-Dspring-boot.run.profiles=sqlite"] }

const child = spawn(spawnArgs.command, spawnArgs.args, {
  cwd: backend,
  env,
  stdio: "inherit",
})

child.on("exit", (code) => process.exit(code ?? 0))
child.on("error", (err) => {
  console.error("[e2e-backend] failed to start:", err)
  process.exit(1)
})
