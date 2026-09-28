import { useState } from "react"
import type { LocationOverview } from "@/lib/ai-location"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { date, shortDate } from "./labels"

export function RepositoryManager({
  sources,
}: {
  sources: LocationOverview["sources"]
}) {
  const [repositoriesOpen, setRepositoriesOpen] = useState(false)
  const [repositoryQuery, setRepositoryQuery] = useState("")
  const [repositoryKind, setRepositoryKind] = useState<"code" | "experience">(
    "code",
  )
  const [repositoryState, setRepositoryState] = useState("all")
  const [repositoryPage, setRepositoryPage] = useState(1)
  const categorySources = sources.filter(
    (source) => source.kind === repositoryKind,
  )
  const openSources = (kind: "code" | "experience") => {
    setRepositoryKind(kind)
    setRepositoryQuery("")
    setRepositoryState("all")
    setRepositoryPage(1)
    setRepositoriesOpen(true)
  }
  const filteredSources = sources.filter(
    (source) =>
      source.kind === repositoryKind &&
      (repositoryState === "all" ||
        (repositoryState === "disabled"
          ? !source.enabled
          : source.enabled && source.status === "unavailable")) &&
      `${source.name} ${source.root} ${source.branch || ""}`
        .toLowerCase()
        .includes(repositoryQuery.toLowerCase()),
  )
  const repositoryPages = Math.max(1, Math.ceil(filteredSources.length / 10))
  const currentRepositoryPage = Math.min(repositoryPage, repositoryPages)
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["code", "experience"] as const).map((kind) => {
          const items = sources.filter((source) => source.kind === kind)
          const unavailable = items.filter(
            (source) => source.enabled && source.status === "unavailable",
          ).length
          return (
            <Card key={kind}>
              <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs">
                <strong>
                  {kind === "code" ? "代码仓库" : "定位经验 / 文档"}{" "}
                  <span className="ml-1 tabular-nums">{items.length}</span>
                </strong>
                <span className="text-muted-foreground">
                  启用 {items.filter((source) => source.enabled).length} · 停用{" "}
                  {items.filter((source) => !source.enabled).length}
                </span>
                {unavailable > 0 && (
                  <span className="text-amber-700">不可访问 {unavailable}</span>
                )}
                {items.some((source) => source.status === "checking") && (
                  <span className="text-muted-foreground">检查中</span>
                )}
                <button
                  type="button"
                  className="ml-auto text-blue-600 hover:underline"
                  onClick={() => openSources(kind)}
                >
                  {kind === "code" ? "管理代码仓库" : "管理经验文档"}
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Dialog open={repositoriesOpen} onOpenChange={setRepositoriesOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogTitle>
            {repositoryKind === "code" ? "代码仓库管理" : "定位经验 / 文档管理"}
          </DialogTitle>
          <DialogDescription>
            {repositoryKind === "code"
              ? "服务器上的只读代码副本，查看仓库可用性、分支和版本。"
              : "服务器上的定位经验与文档资料，查看资料可用性和版本来源。"}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={
                repositoryKind === "code" ? "搜索代码仓库" : "搜索经验文档"
              }
              placeholder={
                repositoryKind === "code"
                  ? "仓库名称 / 路径 / 分支"
                  : "资料名称 / 存放位置"
              }
              value={repositoryQuery}
              onChange={(event) => {
                setRepositoryQuery(event.target.value)
                setRepositoryPage(1)
              }}
              className="h-8 sm:max-w-64"
            />
            <select
              aria-label={repositoryKind === "code" ? "仓库状态" : "资料状态"}
              className="h-8 rounded border bg-background px-2 text-xs"
              value={repositoryState}
              onChange={(event) => {
                setRepositoryState(event.target.value)
                setRepositoryPage(1)
              }}
            >
              <option value="all">全部状态</option>
              <option value="attention">不可访问</option>
              <option value="disabled">已停用</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              匹配 {filteredSources.length} / 共 {categorySources.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  {[
                    repositoryKind === "code"
                      ? "仓库 / 目录"
                      : "资料 / 存放位置",
                    "状态",
                    repositoryKind === "code" ? "分支 / 版本" : "资料版本",
                    "最近拉取",
                  ].map((label) => (
                    <th key={label} className="p-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSources
                  .slice(
                    (currentRepositoryPage - 1) * 10,
                    currentRepositoryPage * 10,
                  )
                  .map((source) => (
                    <tr key={source.id}>
                      <td className="max-w-72 p-2">
                        <p className="font-medium">{source.name}</p>
                        <p
                          className="mt-1 truncate text-muted-foreground"
                          title={source.root}
                        >
                          {source.root}
                        </p>
                      </td>
                      <td className="whitespace-nowrap p-2">
                        <span
                          className={
                            !source.enabled
                              ? "text-muted-foreground"
                              : source.status === "unavailable"
                                ? "text-amber-700"
                                : "text-teal-700"
                          }
                        >
                          {!source.enabled
                            ? "已停用"
                            : source.status === "checking"
                              ? "检查中"
                              : source.status === "unavailable"
                                ? "不可访问"
                                : "可用"}
                        </span>
                      </td>
                      <td className="p-2" title={source.head}>
                        {repositoryKind === "code" ? (
                          <>
                            {source.branch || "—"}
                            <span className="ml-2 font-mono text-muted-foreground">
                              {source.head?.slice(0, 8)}
                            </span>
                          </>
                        ) : source.head ? (
                          <details>
                            <summary className="cursor-pointer font-mono text-muted-foreground">
                              {source.head.slice(0, 8)}
                            </summary>
                            <p className="mt-1 break-all text-[11px] text-muted-foreground">
                              Git 分支 {source.branch} · {source.head}
                            </p>
                          </details>
                        ) : (
                          "未记录"
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap p-2"
                        title={`检查时间：${date(source.checkedAt)}`}
                      >
                        {shortDate(source.lastFetchAt)}
                      </td>
                    </tr>
                  ))}
                {filteredSources.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-muted-foreground"
                    >
                      {categorySources.length
                        ? "暂无匹配记录"
                        : repositoryKind === "code"
                          ? "尚未配置代码仓库"
                          : "尚未配置定位经验或文档资料"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              每页 10 项 · {currentRepositoryPage} / {repositoryPages} 页
            </span>
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={currentRepositoryPage <= 1}
                onClick={() => setRepositoryPage(currentRepositoryPage - 1)}
              >
                上一页
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={currentRepositoryPage >= repositoryPages}
                onClick={() => setRepositoryPage(currentRepositoryPage + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            仅检查服务端本地副本，未核对远端最新版本；拉取时间不代表成功合并时间。清单配置在服务重启后生效。
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
