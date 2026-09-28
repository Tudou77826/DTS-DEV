import http from "node:http"
import { timingSafeEqual } from "node:crypto"
import { config } from "./config.mjs"
import { createLocationService } from "./location-service.mjs"

const service = createLocationService(config)
function safeEqual(a, b) {
  const x = Buffer.from(a || "")
  const y = Buffer.from(b || "")
  return x.length === y.length && timingSafeEqual(x, y)
}
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(body))
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 100_000) {
        reject(new Error("请求内容过大"))
        req.destroy()
      }
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"))
      } catch {
        reject(new Error("JSON 格式错误"))
      }
    })
    req.on("error", reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const route = new URL(req.url || "/", "http://localhost").pathname
    const method = req.method
    if (method === "GET" && route === "/health")
      return send(res, 200, { status: "ok", mode: config.mode })
    if (!safeEqual(req.headers["x-ai-location-key"], config.key))
      return send(res, 401, { error: "未授权" })
    if (method === "POST" && route === "/ai-location/issues")
      return send(res, 200, service.intake(await readJson(req)))
    const issue = route.match(/^\/ai-location\/issues\/([^/]+)(?:\/(runs))?$/)
    if (issue) {
      if (method === "GET" && !issue[2])
        return send(res, 200, service.issue(issue[1]))
      if (method === "POST" && issue[2])
        return send(res, 202, service.run(issue[1], await readJson(req)))
    }
    const answer = route.match(/^\/ai-location\/questions\/([^/]+)\/answer$/)
    if (method === "POST" && answer)
      return send(res, 200, service.answer(answer[1], await readJson(req)))
    const feedback = route.match(/^\/ai-location\/jobs\/([^/]+)\/feedback$/)
    if (method === "POST" && feedback)
      return send(res, 200, service.feedback(feedback[1], await readJson(req)))
    if (method === "GET" && route === "/ai-location/admin/overview")
      return send(res, 200, await service.overview())
    if (method === "GET" && route === "/ai-location/admin/settings")
      return send(res, 200, service.settings())
    if (method === "PUT" && route === "/ai-location/admin/settings")
      return send(res, 200, service.updateSettings(await readJson(req)))
    if (method === "GET" && route === "/ai-location/admin/jobs")
      return send(res, 200, service.jobs())
    const retry = route.match(/^\/ai-location\/admin\/jobs\/([^/]+)\/retry$/)
    if (method === "POST" && retry)
      return send(res, 202, service.retry(retry[1]))
    return send(res, 404, { error: "接口不存在" })
  } catch (error) {
    return send(res, error.status || 400, {
      error: String(error.message || error),
    })
  }
})
server.listen(config.port, config.host, () => {
  console.log(
    `AI location ${config.mode} listening on http://${config.host}:${config.port}`,
  )
  service.start()
})
