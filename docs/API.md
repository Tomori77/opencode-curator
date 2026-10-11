# opencode-curator API 手册（opencode 会话管理）

本文件描述 `opencode-curator` 本地服务的 HTTP 接口，以及其依赖的 `opencode serve` HTTP API 事实。
代码为准；如与实现不一致以 `server/src` 为准。

## 0. 概览

| 项 | 值 | 覆盖方式 |
|---|---|---|
| 本服务端口 | `8787` | 环境变量 `PORT` |
| opencode 地址 | `http://127.0.0.1:4096` | 环境变量 `OPENCODE_SERVER_URL` |
| opencode 数据目录 | `~/.local/share/opencode` | 环境变量 `OPENCODE_DATA_DIR` |
| 本服务监听 | `http://127.0.0.1:8787` | — |

启动命令（仓库根 `<repo>`）：

```powershell
npm run build          # 构建 server(tsc) + web(vite)
npm run start          # 运行后端：node server/dist/index.js
npm run dev:server     # 后端热重载（tsx watch）
```

依赖：`opencode serve --port 4096 --hostname 127.0.0.1` 需在后台运行。

**核心原则：本服务只通过 `opencode serve` 的 HTTP API 操作会话，绝不直接读写 `opencode.db`（SQLite）。**
所有会话的列出、查询、改标题、归档、硬删除、消息读取、待办、子会话均经 HTTP 转发；本服务自身只持久化保护名单与导出文件。

## 1. 本服务 HTTP 接口参考

约定：

- 成功响应多为 `200`。列表类返回 `{ "data": ... }`（或分页对象）；`GET /:id` / `PATCH /:id` 直接返回裸对象。
- 转发到 opencode 失败时统一返回 `502 { "error": "<message>" }`。
- 本服务无鉴权、开放 CORS（`cors()`），仅面向本机。
- 请求体解析为 JSON（`express.json()`）。

### 1.1 健康检查

#### `GET /api/health`

- 参数：无。
- 行为：探测 opencode（内部发 `GET /session?limit=1`）。
- 200：

```json
{
  "ok": true,
"service": "opencode-curator",
  "opencode": { "url": "http://127.0.0.1:4096", "reachable": true }
}
```

不可达时 `ok:false`，且 `opencode` 含 `error` 字段（仍为 200）：

```json
{ "ok": false, "service": "opencode-curator",
  "opencode": { "url": "http://127.0.0.1:4096", "reachable": false, "error": "opencode 500 ..." } }
```

#### `GET /api/health/report`

- 查询参数：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `staleDays` | number | `90` | 判定“长期未更新”的天数阈值 |

- 200（`HealthReport`）：

```json
{
  "totals": {
    "sessions": 0, "archived": 0, "orphanChildren": 0, "orphanDiffFiles": 0,
    "emptySessions": 0, "staleSessions": 0, "protectedMissing": 0
  },
  "orphanChildren": [{ "id": "ses_x", "title": "t", "parentID": "ses_parent" }],
  "orphanDiffFiles": ["ses_y.json"],
  "emptySessions": [{ "id": "ses_x", "title": "t", "directory": "d", "updated": 0, "archived": false }],
  "staleSessions": [{ "id": "ses_x", "title": "t", "directory": "d", "updated": 0, "archived": false }],
  "protectedMissing": ["ses_z"]
}
```

语义：

- `orphanChildren`：父会话 id 已不存在（`parentID` 未命中现有会话集合）。
- `orphanDiffFiles`：`<OPENCODE_DATA_DIR>/storage/session_diff/` 下 `ses_*.json` 中，会话 id 已不存在的文件。
- `emptySessions`：`title` 以 `New session` 开头，或 `cost===0` 且 `input+output+cache.read===0`；最多返回 300 条。
- `staleSessions`：未归档且 `time.updated < now - staleDays*86400000`；按 `updated` 升序，最多 300 条。
- `protectedMissing`：保护名单中、但当前会话集合已不存在的 id。
- 错误：`502 { "error": "..." }`。

### 1.2 会话列表与聚合

所有列表/聚合接口的数据源均为 opencode 的
`GET /experimental/session?limit=1000&archived=true`（全量，含归档），在本服务内存中过滤/排序/分页。

#### `GET /api/sessions`

- 查询参数：

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `search` | string | — | 子串匹配，大小写不敏感；匹配 `title` / `directory` / `id` / `model.id` |
| `directory` | string | — | 子串匹配 `directory`，大小写不敏感 |
| `projectId` | string | — | 精确匹配 `projectID` |
| `roots` | `"true"` | — | 仅根会话（无 `parentID`）；其它值忽略 |
| `archived` | `"false"` \| `"true"` \| `"all"` | `"false"` | 归档筛选；非法值忽略并用默认 |
| `sort` | `updated` \| `created` \| `cost` \| `tokens` \| `title` \| `directory` | `updated` | 非法值忽略，用默认 |
| `order` | `asc` \| `desc` | `desc` | 非法值忽略，用默认 |
| `page` | number | `1` | 向下取整，最小 1 |
| `pageSize` | number | `50` | 向下取整，裁剪到 `[1, 500]` |

- 排序 `tokens` 为 `input+output`；`updated` 对应 `time.updated`，`created` 对应 `time.created`。
- 200（`PagedResult<Session>`）：

```json
{ "data": [ /* Session */ ], "total": 374, "page": 1, "pageSize": 50, "pageCount": 8 }
```

- `total` 为过滤后的总数；`pageCount = ceil(total / pageSize)`。分页为内存切片，`start = (page-1)*pageSize`。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/facets`

- 参数：无。
- 200（`Facets`）：

```json
{
  "directories": [{ "value": "D:\\proj", "count": 12 }],
  "projects":    [{ "value": "D:\\proj", "count": 12 }],
  "models":      [{ "value": "anthropic/claude", "count": 30 }],
  "agents":      [{ "value": "build", "count": 40 }],
  "totals": { "all": 374, "nonArchived": 363, "archived": 11, "roots": 74 }
}
```

- `projects` 的 value 取 `project.worktree ?? projectID`；缺失 model/agent 记为 `unknown`。桶按 `count` 降序。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/stats`

- 参数：无。
- 200（`Stats`）：

```json
{
  "totals": {
    "sessions": 0, "archived": 0, "nonArchived": 0,
    "cost": 0, "tokensIn": 0, "tokensOut": 0,
    "tokensReasoning": 0, "cacheRead": 0, "cacheWrite": 0
  },
  "byModel":   [{ "value": "m", "count": 0, "cost": 0, "tokensIn": 0, "tokensOut": 0 }],
  "byProject": [{ "value": "p", "count": 0, "cost": 0, "tokensIn": 0, "tokensOut": 0 }],
  "byAgent":   [{ "value": "a", "count": 0, "cost": 0, "tokensIn": 0, "tokensOut": 0 }],
  "byMonth":   [{ "month": "2026-10", "count": 0, "cost": 0, "tokensIn": 0, "tokensOut": 0 }],
  "topByTokens": [{ "id": "ses_x", "title": "t", "cost": 0, "tokensIn": 0, "tokensOut": 0 }],
  "topByCost":   [{ "id": "ses_x", "title": "t", "cost": 0, "tokensIn": 0, "tokensOut": 0 }]
}
```

- `byMonth` 的 month 取 `time.created` 的 ISO 前 7 位（`YYYY-MM`），按月份升序。
- `byModel/byProject/byAgent` 桶按 `count` 降序，其次 `cost` 降序。
- `topByTokens` / `topByCost` 各取前 10。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/tree`

- 查询参数：

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `archived` | `"false"` \| `"true"` \| `"all"` | `"false"` | 非法值回落为 `"false"` |
| `search` | string | — | 同列表接口的匹配字段（`title`/`directory`/`id`/`model.id`） |

- 行为：按 `parentID` 组装 fork 树；父不在结果集内则升级为根；根与各层子节点均按 `updated` 降序。
- 200：**外层包裹** `{ "data": TreeNode[] }`：

```json
{
  "data": [
    {
      "id": "ses_x", "title": "t", "directory": "D:\\proj", "agent": "build",
      "model": "anthropic/claude", "cost": 0, "tokensIn": 0, "tokensOut": 0,
      "archived": false, "updated": 0,
      "children": [ /* 递归 TreeNode */ ]
    }
  ]
}
```

- 错误：`502 { "error": "..." }`。

### 1.3 单个会话

#### `GET /api/sessions/:id`

- 路径参数：`id`（session id，转发时 URL 编码）。
- 200：裸 `Session` 对象（见 §5 数据模型）。
- 错误：`502 { "error": "..." }`（上游 404 会被包装为 502 文本）。

#### `PATCH /api/sessions/:id`

- 请求体（`SessionPatch`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 改标题 |
| `metadata` | object | 透传 |
| `time` | `{ archived?: number }` | 嵌套归档：`time.archived = Date.now()` 即归档 |

- 200：更新后的裸 `Session`。
- 注意：顶层直接传 `archived` 会被 opencode 拒绝；必须放在 `time` 内。
- 错误：`502 { "error": "..." }`。

#### `DELETE /api/sessions/:id`

- 查询参数：`force`（`"true"` 时绕过保护名单）。
- 语义：
  - 目标在保护名单且 `force !== "true"` → `409 { "error": "protected", "protected": true }`；
  - 否则调用 opencode `DELETE /session/{id}`（硬删除）并从保护名单移除 → `200 { "ok": true }`。
- 错误：其它上游错误 `502 { "error": "..." }`。删除不存在的 id 由上游返回错误 → 502。

### 1.4 会话附属资源

#### `GET /api/sessions/:id/messages`

- 查询参数：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `limit` | number | — | 仅最新 N 条（上游语义） |
| `before` | string | — | 透传，但上游 `before` **恒 400**，实际不可用 |

- 200：`{ "data": Message[] }`，其中 `Message = { info, parts }`。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/:id/todos`

- 参数：无。
- 200：`{ "data": Todo[] }`，`Todo = { content, status, priority, position }`。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/:id/impact`

- 参数：无。
- 行为：读取会话详情、全部消息、子会话，聚合影响面。
- 200：

```json
{
  "data": {
    "session": { "id": "ses_x", "title": "t", "directory": "D:\\proj", "archived": false },
    "messages": 80,
    "parts": 416,
    "children": 0,
    "protected": false
  }
}
```

- `parts` 为所有消息 `parts.length` 之和；`children` 为 `/session/{id}/children` 数量。
- 错误：`502 { "error": "..." }`。

#### `GET /api/sessions/:id/export`

- 参数：无。
- 行为：拉取 `GET /session/{id}` + `GET /session/{id}/message`，组装导出包。
- 响应头：`Content-Disposition: attachment; filename="<id>.json"`。
- 200（`ExportBundle`）：`{ "info": Session, "messages": Message[] }`（与 `opencode export` 对齐，可被 `opencode import` 还原）。
- 错误：`502 { "error": "..." }`。

#### `POST /api/sessions/:id/backup`

- 参数：无。
- 行为：等价于 export，但把 `{info, messages}` 写入 `data/exports/<id>.json`（2 空格缩进）。
- 200：`{ "data": { "name": "<id>.json", "size": 123456, "mtime": 1700000000000 } }`。
- 错误：`502 { "error": "..." }`。

### 1.5 批量删除

#### `POST /api/sessions/bulk-delete`

- 请求体：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `ids` | string[] | 必填 | 非空数组，否则 `400` |
| `force` | boolean | `false` | `true` 时忽略保护名单 |
| `backup` | boolean | `false` | `true` 时先备份再删；备份失败则该条不删 |

- 校验：`ids` 非数组或为空 → `400 { "error": "ids must be a non-empty array" }`。
- 处理：最多处理前 500 个 id（`ids.slice(0,500)`）；非字符串或空串静默跳过。
  - 受保护且非 `force`：记 `{ id, ok:false, protected:true }`，计入 `skippedProtected`；
  - 可选备份成功 → 记 `backupName`；随后 `DELETE`，并从保护名单移除；
  - 异常：记 `{ id, ok:false, error }`，计入 `failed`。
- 200：

```json
{
  "data": {
    "results": [
      { "id": "ses_a", "ok": true, "backupName": "ses_a.json" },
      { "id": "ses_b", "ok": false, "protected": true },
      { "id": "ses_c", "ok": false, "error": "opencode 500 ..." }
    ],
    "deleted": 1, "failed": 1, "skippedProtected": 1, "backedUp": 1
  }
}
```

- 错误：仅参数错误返回 `400`；服务级异常 `502`。

### 1.6 保护名单

持久化于 `data/protected.json`（`{ "ids": string[] }`）。名单命中的会话禁止删除（除非 `force`）。

#### `GET /api/protected`

- 200：`{ "data": ["ses_x", "ses_y"] }`。

#### `POST /api/protected`

- 请求体：`{ "id": string }`。
- 校验：`id` 非非空字符串 → `400 { "error": "id is required" }`。
- 行为：加入名单（重复加入幂等）。
- 200：`{ "ok": true }`。

#### `DELETE /api/protected/:id`

- 行为：从名单移除（不存在也幂等）。
- 200：`{ "ok": true }`（始终成功）。

### 1.7 备份文件

备份文件位于 `data/exports/`。

#### `GET /api/backups`

- 200：`{ "data": [{ "name": "ses_x.json", "size": 123456, "mtime": 1700000000000 }] }`，按 `mtime` 降序；目录不存在时返回空数组。

#### `GET /api/backups/:name`

- 路径参数：`name`（文件名，须以 `.json` 结尾，且不含 `/`、`\`）。
- 行为：
  - 名称非法（含路径分隔符或非 `.json`）→ `400 { "error": "invalid backup name: <name>" }`；
  - 文件不存在 → `404 { "error": "not found" }`；
  - 否则以附件下载（`res.download`）。

## 2. opencode 侧 API 关键事实与坑

来源：`docs/PROJECT.md`（实测 opencode `1.18.35`，默认 `http://127.0.0.1:4096`）。

### 2.1 会话来源

- `GET /experimental/session?limit=1000&archived=true` 是**全量来源**，返回裸数组，含归档会话。
  不带 `archived=true` 只返回未归档。本服务所有列表/聚合都基于此接口。
- `GET /session` **不完整**（曾出现 `limit=500` 只回 160 条），已弃用；其 `start` 不是 offset，**勿用于分页**（分页由本服务内存实现）。
- `GET /session` 默认**不含已归档**；归档会话在 db 中表现为 `time_archived` 有值。

### 2.2 归档为单向操作

- 归档：`PATCH /session/{id}` body `{ "time": { "archived": <毫秒时间戳> } }` 生效，默认列表隐藏，`/experimental/session?archived=true` 可见。
- **取消归档：HTTP API 不支持**。`{time:{archived:0}}`（值变 0 仍判为归档）、`{archived:null}`、`{}`、`{metadata:{}}` 均无法清除；无 archive/unarchive 专用接口。
- 推论：经 `opencode serve` 只能单向归档；还原需停 opencode 后直接改 SQLite（`time_archived=NULL`），超出“仅走 HTTP API”的范围，暂不实现。

### 2.3 PATCH 字段限制

- `PATCH /session/{id}` 接受 `{title?, metadata?, permission?, time:{archived}}`。
- **顶层未知字段（如直接传 `archived`）会被拒**；归档必须嵌套在 `time` 内。

### 2.4 消息接口

- `GET /session/{id}/message` 返回裸数组 `[{info, parts}]`。
- 无参 = 全部（升序）；`limit=N` = 仅最新 N 条（页内仍升序）。
- **`before` 恒 400，不可用**；详情页一次加载全部消息。
- parts 类型：`text` / `reasoning` / `tool` / `step-start` / `step-finish`。

### 2.5 其他

- `GET /session/{id}/todo`：待办，裸数组。
- `GET /session/{id}/children`：fork 子会话。
- `DELETE /session/{id}`：硬删除（等价 CLI `opencode session delete <id>`）。
- `GET /project` / `GET /project/{id}/directories`：项目分类。
- `POST /session`：新建会话。
- `/experimental/*` 为实验接口，版本升级可能变动，本服务已通过 `OpencodeClient` 做隔离封装。

### 2.6 环境/工程坑

- **代理**：本机设有 HTTP 代理，`curl.exe` 直连 `127.0.0.1` 会 502；须加 `--noproxy "*"` 或用 `Invoke-RestMethod`。Node `fetch` 需注意 `NO_PROXY`。
- **编码**：PowerShell 5.1 控制台默认 GBK，打印中文会乱码，但数据本身为 UTF-8 正常；校验时设 `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 或落盘后按 UTF-8 读。
- **大输出**：不要把大 JSON 直接打到终端（会截断/刷屏），先落盘再解析。
- **PowerShell URL 中的 `?`**：`"$id?force=true"` 会被当成变量 `$id?force`；须写 `"${id}?force=true"`。
- `opencode.db` 运行时被文件锁占用，**不直接读写 SQLite**。
- 根目录若 `npm install` 因代理失败，先清空 `HTTP_PROXY` 环境变量。

## 3. 多实例扩展说明

多实例接入点已通过抽象预留，当前为单实例：

- 接口 `OpencodeClient`（`server/src/opencode/client.ts`）声明会话 list/get/children/messages/todos/update/delete/health 等方法，**构造时注入 baseUrl**。
- 实现 `HttpOpencodeClient`（`server/src/opencode/http-client.ts`）接受 `baseUrl`，所有请求基于该地址拼接。
- `config.opencodeUrl`（环境变量 `OPENCODE_SERVER_URL`，默认 `http://127.0.0.1:4096`）在 `index.ts` 中作为该 client 的 baseUrl 注入。

演进方式：配置多个 baseUrl（instanceId → url 映射），路由按 `instanceId` 选择对应 client 实例即可，业务层无需改动接口。当前仅装配单个 `HttpOpencodeClient`。

> 注：`ARCHITECTURE.md` §4 曾设想列表/搜索走 `GET /session?limit&start&search`；实际实现统一走 `listAllSessions()`（`/experimental/session`）后内存处理，`listSessions`/`start` 未被业务调用。

## 4. 数据与文件位置

| 路径 | 内容 | 说明 |
|---|---|---|
| `data/protected.json` | `{ "ids": string[] }` | 保护名单，相对 `process.cwd()`（服务启动目录） |
| `data/exports/<id>.json` | `{ info, messages }` | 单会话备份，相对 `process.cwd()` |
| `<OPENCODE_DATA_DIR>/storage/session_diff/ses_*.json` | diff 快照 | 健康检查扫描孤儿 diff 的来源；默认 `~/.local/share/opencode` |

说明：`data/` 下的路径由 `resolve(process.cwd(), 'data', ...)` 决定，故须在项目根目录启动服务，`protected.json` 与 `exports/` 才会落在预期的 `<repo>\data` 下。

## 5. 数据模型（Session / Message / Todo）

`Session`（`server/src/opencode/types.ts`）：

```json
{
  "id": "ses_...", "slug": "...", "projectID": "prj_...", "workspaceID": "...",
  "directory": "D:\\proj", "path": "...", "parentID": "ses_parent",
  "title": "t", "agent": "build",
  "model": { "id": "anthropic/claude", "providerID": "anthropic", "variant": "..." },
  "version": "1.18.35",
  "summary": { "additions": 0, "deletions": 0, "files": 0 },
  "cost": 0,
  "tokens": { "input": 0, "output": 0, "reasoning": 0, "cache": { "read": 0, "write": 0 } },
  "time": { "created": 0, "updated": 0, "archived": 0 },
  "project": { "id": "prj_...", "worktree": "D:\\proj" }
}
```

`Message = { info, parts }`：`info` 含 `id/sessionID/role('user'|'assistant')/agent/model/cost/tokens/time/finish` 等；
`parts[]` 为 `text` / `reasoning` / `tool`（含 `state.status/input/output/metadata`）/ `step-start` / `step-finish` 等。

`Todo = { content, status, priority, position }`。
