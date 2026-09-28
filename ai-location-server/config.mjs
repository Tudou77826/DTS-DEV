import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadRepositories } from "./repositories.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
export const config = {
  repositoriesFile: process.env.AI_LOCATION_REPOSITORIES_FILE || "",
  host: process.env.AI_LOCATION_HOST || "127.0.0.1",
  port: Number(process.env.AI_LOCATION_PORT || 8091),
  key: process.env.AI_LOCATION_KEY || "local-dev-ai-key",
  dataFile:
    process.env.AI_LOCATION_DATA || path.join(here, "data", "state.json"),
  mode: process.env.AI_LOCATION_MODE || "chrys",
  chrysPath: path.resolve(
    process.env.AI_LOCATION_CHRYS_PATH || path.join(here, "..", "..", "chrys"),
  ),
  codeRoot: path.resolve(
    process.env.AI_LOCATION_CODE_ROOT || path.join(here, ".."),
  ),
  knowledgeRoot: process.env.AI_LOCATION_KNOWLEDGE_ROOT
    ? path.resolve(process.env.AI_LOCATION_KNOWLEDGE_ROOT)
    : "",
  uvCommand: process.env.AI_LOCATION_UV_COMMAND || "uv",
  agentProfile: process.env.AI_LOCATION_AGENT || "Explore",
  callbackUrl: process.env.AI_LOCATION_CALLBACK_URL || "",
  timeZone: process.env.AI_LOCATION_TIME_ZONE || "Asia/Shanghai",
}
if (
  config.host !== "127.0.0.1" &&
  config.host !== "::1" &&
  (!process.env.AI_LOCATION_KEY || config.key === "local-dev-ai-key")
) {
  throw new Error("非本机监听必须设置非默认的 AI_LOCATION_KEY")
}
if (!["mock", "chrys"].includes(config.mode))
  throw new Error("AI_LOCATION_MODE 只能为 mock 或 chrys")
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error("AI_LOCATION_PORT 无效")
new Intl.DateTimeFormat("sv-SE", { timeZone: config.timeZone }).format(
  new Date(),
)
const registry = loadRepositories(config)
config.repositories = registry.repositories
config.agentWorkdir = registry.workdir
