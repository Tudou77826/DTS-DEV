import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { verifiedSources } from "./agent.mjs"

test("only existing in-root source references survive verification", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-source-test-"))
  try {
    await fs.mkdir(path.join(root, "src"))
    await fs.writeFile(path.join(root, "src", "entry.ts"), "one\ntwo\n")
    const result = {
      leads: [
        {
          sources: [
            { kind: "code", label: "valid", detail: "src/entry.ts:2" },
            { kind: "code", label: "wrong line", detail: "src/entry.ts:99" },
            { kind: "code", label: "traversal", detail: "../secret.txt:1" },
            { kind: "code", label: "missing", detail: "src/missing.ts:1" },
          ],
        },
      ],
    }
    await verifiedSources(result, { codeRoot: root, knowledgeRoot: "" })
    assert.deepEqual(
      result.leads[0].sources.map((source) => source.label),
      ["code · valid"],
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("multi-repository evidence must identify its repository", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-repos-test-"))
  try {
    await fs.mkdir(path.join(root, "a"))
    await fs.mkdir(path.join(root, "b"))
    await fs.writeFile(path.join(root, "a", "entry.ts"), "one")
    await fs.writeFile(path.join(root, "b", "entry.ts"), "two")
    const result = {
      leads: [
        {
          sources: [
            { kind: "code", label: "ambiguous", detail: "entry.ts:1" },
            {
              kind: "code",
              repositoryId: "b",
              label: "correct",
              detail: "entry.ts:1",
            },
            {
              kind: "experience",
              repositoryId: "b",
              label: "wrong kind",
              detail: "entry.ts:1",
            },
            {
              kind: "code",
              repositoryId: "missing",
              label: "unknown",
              detail: "entry.ts:1",
            },
          ],
        },
      ],
    }
    await verifiedSources(result, {
      repositories: [
        {
          id: "a",
          kind: "code",
          name: "A",
          root: path.join(root, "a"),
          enabled: true,
        },
        {
          id: "b",
          kind: "code",
          name: "B",
          root: path.join(root, "b"),
          enabled: true,
        },
      ],
    })
    assert.equal(result.leads[0].sources.length, 1)
    assert.equal(result.leads[0].sources[0].repositoryId, "b")
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
