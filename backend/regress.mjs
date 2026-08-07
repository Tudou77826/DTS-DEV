// 全面回归：覆盖核心闭环 + P0/P1/P2 新功能
const BASE = "http://localhost:8080/api";
let pass = 0, fail = 0;
function assert(name, expected, actual) {
  const ok = expected === actual || (expected === "notempty" && actual !== "" && actual != null && actual !== undefined);
  if (ok) { console.log(`✅ ${name}`); pass++; }
  else { console.log(`❌ ${name}\n   expected=${JSON.stringify(expected)}\n   actual=  ${JSON.stringify(actual)}`); fail++; }
}
async function req(method, path, body, token, isForm) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let opt = { method, headers };
  if (body) {
    if (isForm) opt.body = body;
    else { headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  }
  const res = await fetch(`${BASE}${path}`, opt);
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text), headers: res.headers }; }
  catch { return { status: res.status, json: null, text }; }
}

// 登录 leader
let r = await req("POST", "/auth/login", { username: "leader", password: "123456" });
const T = r.json.data.token;
const dict = (await req("GET", "/config/dictionaries", null, T)).json.data;
const MODID = dict.modules[0].id, DEVID = dict.developers[0].id, DEVNAME = dict.developers[0].displayName;
// 责任人（开发人员）的登录令牌，用于状态流转
r = await req("POST", "/auth/login", { username: dict.developers[0].username, password: "123456" });
const DT = r.json.data.token;

console.log("=== 核心闭环 ===");
r = await req("POST", "/issues", { moduleId: MODID, title: "回归测试问题", description: "回归测试问题", vpnInfo: "VPN 信息", priority: "HIGH" }, T);
const IID = r.json.data.id;
assert("创建问题", "PENDING_ASSIGN", r.json.data.status);

r = await req("POST", `/issues/${IID}/assign`, { assigneeId: DEVID, priority: "URGENT" }, T);
assert("分配→待定位", "PENDING_LOCATE", r.json.data.status);

r = await req("POST", `/issues/${IID}/status`, { status: "LOCATING" }, DT);
assert("流转→LOCATING", "LOCATING", r.json.data.status);
// 待验证/已解决 需要先填写根本原因与处理结论
r = await req("POST", `/issues/${IID}/progress`, { type: "ROOT_CAUSE", content: "内存泄漏", syncToIssue: true }, DT);
assert("填写根本原因", true, r.json.code === 0);
r = await req("POST", `/issues/${IID}/progress`, { type: "RESOLUTION", content: "修复并验证", syncToIssue: true }, DT);
assert("填写处理结论", true, r.json.code === 0);
for (const s of ["PENDING_VERIFY", "RESOLVED"]) {
  r = await req("POST", `/issues/${IID}/status`, { status: s }, DT);
  assert(`流转→${s}`, s, r.json.data.status);
}
// 已解决后由提交人（leader）关闭
r = await req("POST", `/issues/${IID}/status`, { status: "CLOSED" }, T);
assert("流转→CLOSED（提交人）", "CLOSED", r.json.data.status);
r = await req("POST", `/issues/${IID}/status`, { status: "REOPENED", remark: "复测仍复现" }, T);
assert("重新打开（提交人）", "REOPENED", r.json.data.status);

console.log("\n=== P0: 权限矩阵 ===");
// 权限矩阵：只有责任人可流转；提交人可关闭/重新打开；其余人（含负责人）不可越权
// 创建一个问题分配给另一个开发人员，再用 leader 尝试解决（leader 不是责任人，应被拒）
r = await req("POST", "/issues", { moduleId: MODID, title: "权限测试", description: "权限测试", vpnInfo: "VPN 信息" }, T);
const PID = r.json.data.id;
await req("POST", `/issues/${PID}/assign`, { assigneeId: dict.developers[1].id }, T);
// 由责任人推到定位中
r = await req("POST", "/auth/login", { username: dict.developers[1].username, password: "123456" });
const D2T = r.json.data.token;
r = await req("POST", `/issues/${PID}/status`, { status: "LOCATING" }, D2T);
assert("责任人可流转到定位中", "LOCATING", r.json.data.status);
// leader 尝试解决（非责任人）
r = await req("POST", `/issues/${PID}/status`, { status: "RESOLVED", remark: "我替你解决了" }, T);
assert("非责任人不能解决（应失败 403/400）", true, r.json.code !== 0);

console.log("\n=== P0: 问题编号格式 ISS-yyMMdd-NNN ===");
r = await req("POST", "/issues", { moduleId: MODID, title: "编号格式测试", description: "编号格式测试", vpnInfo: "VPN 信息" }, T);
const codeFormat = /^\d{6}-\d{3}$/.test(r.json.data.code.replace("ISS-", ""));
assert("编号是 ISS-yyMMdd-NNN", true, codeFormat);

console.log("\n=== P0: 附件上传/下载 ===");
// 用 FormData 上传一个测试文件
const blob = new Blob(["log line 1\nlog line 2"], { type: "text/plain" });
const fd = new FormData();
fd.append("file", blob, "test.log");
fd.append("sourceType", "ISSUE");
fd.append("sourceId", String(IID));
r = await req("POST", `/issues/${IID}/attachments`, fd, T, true);
const attOk = r.json.code === 0 && r.json.data?.id;
assert("上传附件成功", true, !!attOk);
if (attOk) {
  const aid = r.json.data.id;
  // 下载（后端路由为 /attachments/{id}/download）
  r = await req("GET", `/attachments/${aid}/download`, null, T);
  assert("下载附件（200）", 200, r.status);
  // 列表
  r = await req("GET", `/issues/${IID}/attachments`, null, T);
  assert("附件列表≥1", true, (r.json.data?.length ?? 0) >= 1);
  // 删除：仅上传者本人（上传者=leader）
  r = await req("DELETE", `/attachments/${aid}`, null, T);
  assert("删除附件（上传者本人）", true, r.json.code === 0);
}

console.log("\n=== P1: 通知 ===");
// 重新分配会触发通知给新处理人
r = await req("GET", `/notifications`, null, T);
assert("通知接口可访问", true, r.status === 200 && r.json.code === 0);
r = await req("GET", `/notifications/unread-count`, null, T);
assert("未读计数接口", true, r.status === 200 && r.json.code === 0);
r = await req("GET", `/notifications?unread=true`, null, T);
assert("最新通知列表", true, r.status === 200 && r.json.code === 0);
r = await req("PATCH", `/notifications/read-all`, null, DT);
assert("全部标记已读", true, r.status === 200 && r.json.code === 0);

console.log("\n=== P1: 批量操作 ===");
r = await req("POST", `/issues/batch/assign`, { issueIds: [IID], assigneeId: DEVID }, T);
assert("批量指派", true, r.json.code === 0 || r.status === 200);

// 批量关闭：仅负责人可用；非负责人应 403
r = await req("POST", `/issues/batch/close`, { issueIds: [IID], remark: "越权尝试" }, DT);
assert("非负责人批量关闭被拒（403）", 403, r.json.code);
// 构造一个已解决问题，再由负责人批量关闭
r = await req("POST", "/issues", { moduleId: MODID, title: "批量关闭测试", description: "批量关闭测试", vpnInfo: "VPN 信息" }, T);
const CID = r.json.data.id;
await req("POST", `/issues/${CID}/assign`, { assigneeId: DEVID }, T);
await req("POST", `/issues/${CID}/status`, { status: "LOCATING" }, DT);
await req("POST", `/issues/${CID}/progress`, { type: "ROOT_CAUSE", content: "内存泄漏", syncToIssue: true }, DT);
await req("POST", `/issues/${CID}/progress`, { type: "RESOLUTION", content: "修复并验证", syncToIssue: true }, DT);
await req("POST", `/issues/${CID}/status`, { status: "PENDING_VERIFY" }, DT);
await req("POST", `/issues/${CID}/status`, { status: "RESOLVED" }, DT);
r = await req("POST", `/issues/batch/close`, { issueIds: [CID], remark: "已解决待关闭" }, T);
assert("负责人批量关闭已解决问题", true, r.json.code === 0 && r.json.data.succeeded === 1);
// 未解决的问题不能批量关闭
r = await req("POST", `/issues/batch/close`, { issueIds: [IID], remark: "未解决不应成功" }, T);
assert("未解决问题批量关闭失败计数", true, r.json.data.failed >= 1);

console.log("\n=== P1: Excel 导出 ===");
r = await req("GET", `/issues/export`, null, T);
assert("导出接口（200 + xlsx）", 200, r.status);

console.log("\n=== P2: 问题关联 ===");
r = await req("POST", `/issues/${IID}/relations`, { targetIssueId: PID, relationType: "RELATED" }, T);
assert("添加关联", true, r.json.code === 0 || r.status === 200);

console.log("\n=== P2: XSS 过滤 ===");
// ContentSanitizer 是否存在
r = await req("POST", "/issues", { moduleId: MODID, title: "XSS测试", description: "<script>alert(1)</script><b>正常</b>", vpnInfo: "VPN 信息" }, T);
const desc = r.json.data?.description || "";
assert("script 被过滤", true, !desc.includes("<script>"));

console.log(`\n===============================`);
console.log(`结果: ✅ ${pass} 通过, ❌ ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
