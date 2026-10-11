# 架构设计（opencode-curator · opencode 会话管理 Web UI）

决策见 `PROJECT.md` 第 9 节。本文件描述架构与任务拆分。

## 1. 总体形态
本地 Node/TS 服务 + 浏览器 SPA。服务通过 `opencode serve` 的 HTTP API 操作会话，**绝不直接写 opencode.db**。

```
浏览器 SPA (web/)  ──HTTP──▶  本服务 (server/)  ──HTTP──▶  opencode serve (127.0.0.1:4096)
                                     │
                                     └─本地状态: 保护名单/配置/导出文件 (data/)
```

## 2. 目录结构（拟）
```
opencode-curator/
  docs/            守则与设计（本目录）
  server/          后端 Node/TS
    src/
      index.ts           启动 HTTP 服务
      config.ts          配置（OPENCODE_SERVER_URL 等）
      opencode/
        client.ts        OpencodeClient 接口（为多实例预留）
        http-client.ts   基于 fetch 的实现
      routes/            REST 路由
      services/          业务逻辑
      store/             本地 JSON 状态（保护名单）
  web/             SPA (Vite + React + TS)
  package.json     workspace 根
```

## 3. 核心抽象（多实例预留）
`OpencodeClient` 接口（session list/get/updateTitle/archive/delete/messages/children/search/todos…），
`HttpOpencodeClient` 实现，构造时传入 baseUrl。
未来多 db/多机 = 配置多个 baseUrl，路由按 instanceId 选择 client。当前单实例，默认 `http://127.0.0.1:4096`。

## 4. 功能 → API 映射
| 功能 | 依赖 API |
|---|---|
| 分类（项目/目录/模型/时间/体积/fork/归档/占位） | `GET /session`(+`/project`) |
| 列表/分页/搜索(F) | `GET /experimental/session?limit=1000&archived=true`（全量后内存过滤/分页） |
| 已归档视图(C) | `GET /experimental/session?archived=true&cursor` |
| 详情+可视化(4) | `GET /session/{id}` + `/message` |
| 改标题(5) | `PATCH /session/{id}` `{title}` |
| 归档/还原(C) | `PATCH /session/{id}` `{time:{archived}}` |
| 硬删除(3) | `DELETE /session/{id}` |
| fork 树(J) | `GET /session/{id}/children` + `parentID` |
| 备份(D) | `GET /session/{id}` + `/message` 落盘 JSON |
| 保护名单(E) | 本地 `data/protected.json` |
| 健康检查(G) | 对比 `GET /session` 与 `/experimental/session`、孤儿检测 |
| 统计看板(I) | 聚合 list 字段（cost/tokens/数量/体积） |

## 5. 安全删除流程（需求 2/3）
1. 选择会话 → **预览影响面**：消息数、part 数、子会话数、是否在保护名单、是否已归档。
2. **二次确认**：明确列出将删除的 id 列表与影响面；输入确认或勾选。
3. **可选备份**(D)：先导出 JSON 到 `data/exports/`。
4. 执行：归档用 PATCH，硬删用 DELETE；逐个执行并收集结果。
5. **报告**：成功/失败清单，失败原因（404/400/占用）。
- 保护名单命中的会话在预览阶段拦截，禁止删除，除非显式解除。

## 6. 任务拆分（tracer bullets，主对话编译/启动/发请求/smoke，其余交子代理）
- **T1 脚手架 ✅ 完成**：monorepo(server+web)、TS 配置、`/api/health`、OpencodeClient 骨架 + 真实调用。
  - smoke ✅：`GET /api/health` → `{ok:true,reachable:true}`；`GET /api/sessions` → 100 条真实会话。
- **T2 会话列表 + 过滤/搜索/分页(F) ✅ 完成**
  - 后端：`GET /api/sessions`(search/directory/projectId/roots/archived/sort/order/page/pageSize → `{data,total,page,pageSize,pageCount}`)、`GET /api/sessions/facets`。数据源 `/experimental/session?limit=1000&archived=true`（全量拉取后内存过滤/排序/分页）。
  - 前端：搜索(300ms 防抖)/目录/项目/归档/仅根/排序/每页数 + 表格 + 分页 + 加载/空/错误态。
  - smoke ✅：total=374、分页无重叠、search、roots=74、archived 11/363、facets、health。
- **T3 详情 + 消息可视化(4) ✅ 完成**
  - 后端：`GET /api/sessions/:id/messages`（一次返回全部，弃用不可用的 `before`）、`GET /api/sessions/:id/todos`。
  - 前端：`SessionDetail` 右侧面板（主从布局），点行打开；渲染用户/助手消息、text/reasoning(折叠)/tool(状态徽章+输入输出折叠)/step 分隔、费用与 tokens、待办。
  - smoke ✅：详情形列、消息 80 条、待办 3、最大会话 416 条、非法 id → 502。
- **T4 改标题(5) ✅ 完成**
  - 复用 `PATCH /api/sessions/:id`；前端 `web/src/api.ts` 加 `updateSession(id,{title})`；`SessionDetail` 标题行内编辑（编辑/保存/取消，保存失败保留编辑态）；`App` 成功后刷新列表。
  - smoke ✅：建会话→PATCH 改名→GET 校验持久化→DELETE 200。
- **T5 归档 + 归档视图(C) ✅ 完成（不做还原，API 不支持）**
  - `api.archiveSession(id)` → `PATCH {time:{archived:Date.now()}}`（body 必须嵌套，顶层 `archived` 会被 opencode 拒）；表格行与详情头部加"归档"按钮；归档视图复用 archived 筛选(全部/未归档/已归档)。
  - smoke ✅：归档后 archived=false 排除、archived=true 命中、facets 计数更新、清理删除 200。
- **T6 硬删除：预览影响面 + 二次确认 + 保护名单(E) ✅ 完成（需求 2/3）**
  - 后端：`GET /api/sessions/:id/impact`（messages/parts/children/protected/archived）、`GET/POST /api/protected`、`DELETE /api/protected/:id`、`DELETE /api/sessions/:id?force=`（保护且非 force → 409）。名单持久化 `data/protected.json`。
  - 前端：`ConfirmDelete` 弹窗（影响面 + "不可恢复"勾选二次确认 + 受保护禁用）；表格/详情加 删除、保护/取消保护、🔒 标识。
  - smoke ✅：protect→list、无 force 409、force 200、名单移除、会话消失。
- **T7 备份/导出(D) ✅ 完成**
  - 格式对齐 `opencode export`：`{info,messages}`（可 `opencode import` 还原）。
  - 后端：`GET /api/sessions/:id/export`（附件下载）、`POST /api/sessions/:id/backup`（写 `data/exports/<id>.json`）、`GET /api/backups`、`GET /api/backups/:name`（校验安全文件名）。
  - 前端：详情"导出"、删除弹窗默认勾选"删除前服务器备份"（备份失败则中止删除）、头部"备份"面板列出并可下载。
  - smoke ✅：导出 header/113 消息、备份 1.2MB、列表含、下载 200、路径穿越 400。
- **T8 统计看板(I) ✅ 完成**
  - 后端 `GET /api/sessions/stats`：totals(cost/tokens) + byModel/byProject/byAgent/byMonth + topByTokens/topByCost。
  - 前端 `StatsPanel` + 顶部 会话/统计/备份 视图切换。
  - smoke ✅：sessions=387、byModel 计数和=387、byMonth 6 个月、排行正常。
- **T9 fork 树(J) ✅ 完成**
  - 后端 `GET /api/sessions/tree?archived&search`：按 `parentID` 组树，父不可见则升为根，兄弟按 updated 降序。
  - 前端 `ForkTree`（分支视图）：可折叠树 + 归档筛选 + 搜索 + 展开/折叠全部，点标题跳列表。
  - smoke ✅：全量节点 389=stats.sessions、非归档 378 一致、19 个含子树根。
- **T10 健康检查/孤儿扫描(G) ✅ 完成**
  - 只读 `GET /api/health/report?staleDays=90`：孤儿子会话、孤儿 diff 文件、空会话(占位)、长期未更新、受保护但已不存在 + totals。
  - 前端 `HealthPanel`（健康视图）。
  - smoke ✅：sessions=391、空会话 12、孤儿 0、90 天未更新 19；staleDays=1→320。
- **T11 批量/条件删除(B) ✅ 完成**
  - 后端 `POST /api/sessions/bulk-delete` `{ids,force?,backup?}` → 逐条：保护且非 force 跳过、可选先备份（失败则该条不删）、再删；返回 results + deleted/failed/skippedProtected/backedUp。
  - 前端：表格多选（含本页全选）+ 批量操作条 + `BulkDeleteDialog`（预览+备份勾选+二次确认）；健康视图"删除这些空会话"。
  - smoke ✅：deleted=1/backedUp=1/skippedProtected=1、空 ids→400。
- **T12 收尾 ✅ 完成**
  - `docs/API.md`：本服务全量 HTTP 接口参考 + opencode 侧坑 + 多实例扩展说明 + 数据文件位置。
  - 全端点回归 smoke ✅：health/report、sessions、facets、stats、tree、detail、messages、todos、impact、export、protected、backups 全部 200；stats/facets 一致（394）。

---
## 完成状态：T1–T12 全部完成 ✅（需求 1–5 全部落地）
运行：`npm install` → `npm run build` → 先起 `opencode serve --port 4096`，再 `npm run start`（后端 8787）；前端开发 `npm run dev:server` + `cd web; npm run dev`。详见 `API.md`、`PROJECT.md §12`。

## 7. 主对话 vs 子代理（守则）
- 主对话：`npm run build`、后台启动服务、发 HTTP 请求、跑 smoke、停进程。
- 子代理：脚手架之外的编码、组件实现、调研、批量文件操作。
