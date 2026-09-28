import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { loadRepositories, mapBounded } from "./repositories.mjs"
test("registry supports 50 code and 10 knowledge repositories, rejects escaping roots and duplicate IDs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-test-"))
  try {
    const file = path.join(root, "repositories.json")
    const repositories = Array.from({ length: 60 }, (_, index) => ({
      id: `repo-${index}`,
      name: `Repo ${index}`,
      kind: index < 50 ? "code" : "experience",
      root: `repo-${index}`,
      enabled: index !== 59,
    }))
    fs.writeFileSync(file, JSON.stringify({ workdir: root, repositories }))
    const loaded = loadRepositories({ repositoriesFile: file })
    assert.equal(loaded.repositories.length, 60)
    assert.equal(
      loaded.repositories.filter((item) => item.kind === "experience").length,
      10,
    )
    assert.equal(loaded.repositories[59].enabled, false)
    fs.writeFileSync(
      file,
      JSON.stringify({
        workdir: root,
        repositories: [{ ...repositories[0], root: "../outside" }],
      }),
    )
    assert.throws(
      () => loadRepositories({ repositoriesFile: file }),
      /工作目录/,
    )
    fs.writeFileSync(
      file,
      JSON.stringify({
        workdir: root,
        repositories: [repositories[0], repositories[0]],
      }),
    )
    assert.throws(() => loadRepositories({ repositoriesFile: file }), /重复/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
test("repository inspection keeps result order and limits concurrency", async () => {
  let active = 0,
    maximum = 0
  const output = await mapBounded(
    Array.from({ length: 60 }, (_, i) => i),
    async (item) => {
      active++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active--
      return item
    },
    4,
  )
  assert.equal(maximum, 4)
  assert.deepEqual(
    output,
    Array.from({ length: 60 }, (_, i) => i),
  )
})
