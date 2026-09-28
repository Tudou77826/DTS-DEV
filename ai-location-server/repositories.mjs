import fs from "node:fs"
import path from "node:path"
export function loadRepositories(config) {
  if (!config.repositoriesFile)
    return {
      workdir: config.codeRoot,
      repositories: [
        {
          id: "code",
          name: "代码",
          kind: "code",
          root: config.codeRoot,
          enabled: true,
        },
        ...(config.knowledgeRoot
          ? [
              {
                id: "knowledge",
                name: "经验资料",
                kind: "experience",
                root: config.knowledgeRoot,
                enabled: true,
              },
            ]
          : []),
      ],
    }
  const file = path.resolve(config.repositoriesFile)
  const input = JSON.parse(fs.readFileSync(file, "utf8"))
  const workdir = fs.realpathSync(
    path.resolve(path.dirname(file), input.workdir),
  )
  if (!Array.isArray(input.repositories) || input.repositories.length > 200)
    throw new Error("仓库清单需为数组，最多 200 个")
  const ids = new Set()
  const repositories = input.repositories.map((item) => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(item.id || "") || ids.has(item.id))
      throw new Error("仓库 ID 无效或重复")
    if (!["code", "experience"].includes(item.kind) || !item.name || !item.root)
      throw new Error("仓库需配置名称、类型与目录")
    ids.add(item.id)
    const root = path.resolve(workdir, item.root)
    const relative = path.relative(workdir, root)
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("仓库必须位于 Agent 工作目录内")
    if (fs.existsSync(root)) {
      const real = path.relative(workdir, fs.realpathSync(root))
      if (real.startsWith("..") || path.isAbsolute(real))
        throw new Error("仓库链接不能越出 Agent 工作目录")
    }
    return {
      id: item.id,
      name: String(item.name).slice(0, 100),
      kind: item.kind,
      root,
      enabled: item.enabled !== false,
    }
  })
  return { workdir, repositories }
}
export async function mapBounded(items, action, concurrency = 4) {
  const results = new Array(items.length)
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index++
        results[current] = await action(items[current])
      }
    }),
  )
  return results
}
