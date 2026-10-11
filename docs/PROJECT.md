# 项目守则（opencode 会话删除）

> 本文件是项目的唯一事实来源。新会话开始前先读此文件，避免重复探索、减少上下文输入。
> 每次有新的结论（路径、命令、接口、坑），直接补充到本文件对应章节。

## 1. 项目目的
- **目标**：删除 opencode 会话（session），用于清理庞大的会话数据。
- 核心场景：本机 `opencode.db` 已膨胀到约 3.19 GB，需要高效、安全地删除/清理会话。

## 2. 工作约定（重点）
- **主对话**负责（必须亲自执行，不可交给子代理）：
  - 编译 / 构建
  - 后台启动进程
  - 发请求（HTTP/CLI 调用）
  - 跑 smoke 测试
  - 停进程
- **其它任务**（探索代码、检索、批量读写、分析、调研）**优先使用子代理**，减少主对话上下文占用。
- 主对话只保留结论；原始探索过程留在子代理里。

## 3. 目录
- 工作目录：`<workdir>`
- 本项目：`<repo>`（当前为空，新建项目）
- 文档：`<repo>\docs`（本文件所在处）

## 4. 运行环境事实
| 项 | 值 |
|---|---|
| OS / Shell | win32 / PowerShell 5.1 |
| Node | v24.18.1（`<node-dir>`） |
| npm | 11.16.0 |
| Python | `C:\Python3x\python.exe` |
| opencode | `opencode-ai@1.18.35`（全局，`<node-dir>\node_modules\opencode-ai`，入口 `bin/opencode.exe` 为编译后二进制） |

## 5. opencode 数据布局
数据根目录：`%USERPROFILE%\.local\share\opencode`
- `opencode.db` —— **SQLite，约 3.19 GB，会话主存储**（`-shm`/`-wal` 同目录）
- `storage\session_diff\ses_*.json` —— 各会话的 diff 快照
- `storage\migration` —— 迁移记录
- `log\`、`repos\`、`snapshot\`、`tool-output\`、`auth.json`
- 配置目录：`%USERPROFILE%\.config\opencode`（`opencode.jsonc`、`cli.json`、`tui.json`、`service.json`、`plugins\`、`skill\`）

> 注意：opencode 运行时 `opencode.db` 被占用（文件锁），直接读写会失败；需先停掉 opencode 进程，或走 opencode 自身接口。

## 6. 可用命令（opencode 1.18.35）
- `opencode session list` —— 列出会话
- `opencode session delete <sessionID>` —— 删除单个会话
- `opencode serve [--port N] [--hostname]` —— 无头服务器（可发 HTTP 请求）
- `opencode export [sessionID]` / `opencode import <file>` —— 会话导入导出
- `opencode db` —— 数据库工具
- `opencode stats` —— token/花费统计

## 7. 数据模型（已核实，来自 `opencode db`/`session list`）
会话分散在**两张表**：`session`(v1) 与 `session_v2`(v2)。
计数（2026-10-11 实测）：`session`=372、`session_v2`=345、`message`=22333、`part`=94831、`todo`=96、`session_message`=21969；v1-only 40、v2-only 13、both 332。

关键字段（分类/可视化可用）：
- `session.directory` / `session.title` / `time_created` / `time_updated`
- `session.project_id` → `project.worktree`/`name`（项目分类）
- `session.parent_id`（fork 父子关系）
- `session.model` / `agent` / `cost` / `tokens_input|output|reasoning|cache_read|cache_write`
- `session.time_archived`（**已支持归档=软删除**）、`time_compacting`
- `session.summary_files|additions|deletions|summary_diffs`

**删除依赖图（硬删必须全覆盖，否则残留/损坏）**：
- `session` → 级联 `message` → `part`；→ `todo`；→ `session_share`
- `session_v2` → 级联 `session_message`
- `event.aggregate_id` = 会话 id，`event_sequence.aggregate_id` 同键（372 行，与 v1 会话一一对应）→ 删会话需删对应 `event` + `event_sequence`
- 文件：`storage\session_diff\ses_<id>.json` 需一并删
- `project`/`project_directory`/`worktree` 为多会话共享，**不可删**

## 8. 性能/空间现状（实测）
- `opencode.db` = 779172 页 × 4096 ≈ **3.19 GB**；其中 `freelist_count`=598861 页 ≈ **2.45 GB 是空闲页**（历史删除未回收）。
- 实际占用仅 180311 页 ≈ 738 MB（part 270MB + message 30MB + session_message 260MB）。
- 结论：仅删除会话**不会**让 db 变小，需 **VACUUM** 才能回收磁盘（可回收约 2.4GB）。dbstat 扩展不可用，用 `pragma page_count/page_size/freelist_count` 估算。
- 最大会话示例：`部署BiRefNet_HR-matting本地模型` 单会话 part 数据 ~27MB。

## 9. 决策（已定）
1. 形态：**Web UI**（本地服务 + 浏览器）。
2. 技术栈：**Node / TypeScript**。
3. 操作方式：**走 `opencode serve` 的 HTTP API**（运行中即可安全操作，不直接写 SQLite）。
4. 删除语义：**归档（软删除）+ 硬删除** 都要；硬删等价于 `opencode session delete <id>`。
5. 范围：**只管本机单个 db**，但**预留多实例接口**（抽象 client/config）。
- 不做：空间回收 / VACUUM（太危险，暂不考虑）。目标是"安全可靠方便地清除过期或无用会话"。
- 目标功能：B 批量/条件删除、C 软删除(归档)与回收站、D 导出/备份、E 保护名单、F 全文搜索、G 健康检查/清理、I 统计看板、J fork 树管理。

## 10. opencode HTTP API 事实（实测 v1.18.35，默认 `http://127.0.0.1:4096`）
启动：`opencode serve --port 4096 --hostname 127.0.0.1`（无密码时打印 unsecured 警告）。
- `GET /session` — 列会话。query: `directory, workspace, scope, path, roots, start, search, limit`。**默认不含已归档**。
- `POST /session` — 新建会话。
- `GET /session/{id}` — 详情。
- `PATCH /session/{id}` — body `{title?, metadata?, permission?, time:{archived:number}}`。**改标题 & 归档/取消归档都用它**。
- `DELETE /session/{id}` — 硬删除（= CLI `session delete`）。
- `GET /session/{id}/message` — 消息，返回裸数组 `[{info,parts}]`。**无参=全部（升序）**；`limit=N`=仅最新 N 条（页内仍升序）；**`before` 恒 400，不可用**（详情页改为一次加载全部）。parts 类型：`text/reasoning/tool/step-start/step-finish`。
- `GET /session/{id}/todo` — 待办，裸数组。
- `GET /session/{id}/children` — fork 子会话。
- `GET /session/{id}/todo` — 待办。
- `GET /experimental/session` — query 含 `archived, cursor, search, limit`。**返回裸数组**；`?limit=1000&archived=true` = 全量（实测 374 条，含归档），未带 `archived=true` 只回未归档。**列表一律用这个**。
- `GET /session` 不完整（limit=500 只回 160），**弃用**。`start` 非 offset，勿用于分页；分页由本服务内存实现。
- `GET /project` / `GET /project/{id}/directories` — 项目分类。

**smoke 已验证**：建会话 → `PATCH title`（UTF-8 正常）→ `PATCH time.archived`（生效，归档后从默认列表消失）→ `DELETE`(200) → 再查(404)。

## 11. 已知坑（重要）
- **代理**：本机设了 HTTP 代理，`curl.exe` 直连 127.0.0.1 会返回 502。务必加 `--noproxy "*"`（或用 `Invoke-RestMethod`）。Node 侧 fetch 需注意 `NO_PROXY`。
- **编码**：PS 5.1 控制台默认 GBK，`Invoke-RestMethod`/`curl` 打印中文会乱码，**数据本身是 UTF-8 正常**。校验用 `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 或写文件按 UTF-8 读。
- **大输出**：不要把大 JSON 列表直接打到终端（会截断并刷屏），一律落盘再解析。
- **PowerShell 变量名含 `?`**：`"$id?force=true"` 会被解析成变量 `$id?force`（空）→ URL 变成 `.../=true`。带 `?` 的 URL 必须写 `"${id}?force=true"`。
- opencode 运行时 `opencode.db` 有文件锁，**不直接读写 SQLite**。
- `/experimental/*` 为实验接口，版本升级可能变动，接入时做隔离封装。
- 归档会话在 db 里表现为 `session.time_archived` 有值；`/session` 默认过滤掉。

## 12. 运行方式（本地开发，T1 已实现）
根目录 `<repo>`（npm workspaces: server + web）。
```
npm install                     # 安装（如走代理失败：先清空 HTTP_PROXY 环境变量）
npm run build                   # 构建 server(tsc) + web(vite)
npm run build:server            # 只构建后端
npm run dev:server              # 后端热重载（tsx watch）
npm run start                   # 运行后端（node server/dist/index.js）
```
- 后端端口默认 `8787`（`PORT` 可覆盖），opencode 地址默认 `http://127.0.0.1:4096`（`OPENCODE_SERVER_URL` 可覆盖）。
- 依赖 opencode serve 在跑：`opencode serve --port 4096 --hostname 127.0.0.1`（后台）。
- 一键（已就绪）：双击项目根目录的 **`启动.bat`** / **`停止.bat`**；等价命令 `npm run start` / `npm run stop`。
- 自测：`GET http://127.0.0.1:8787/api/health`、`GET http://127.0.0.1:8787/api/sessions`（curl 记得 `--noproxy "*"`）。
- 代码结构见 `ARCHITECTURE.md`。

## 12.5 归档限制（重要，实测）
- 归档：`PATCH /session/{id}` body `{time:{archived:<毫秒时间戳>}}` → 生效，默认列表隐藏，`/experimental/session?archived=true` 可见。
- **取消归档：HTTP API 不支持**。`{time:{archived:0}}`（值变 0 但仍判为已归档）、`{archived:null}`/`{}`/`{metadata:{}}` 均无法清除；OpenAPI 无 archive/unarchive 专用接口，`/api/session/{id}` 仅 GET。
- 推论：通过 opencode serve 只能"单向归档"；要还原必须停 opencode 后直接改 SQLite（`time_archived=NULL`），已超出"仅走 HTTP API"的决策范围 → 待用户定夺（T5）。

## 12.6 双存储：V1 vs V2（重要，实测）
- **CLI `opencode serve` 只读写旧表 `session`(V1)**。实测 `/experimental/session?limit=1000&archived=true` 返回的 354 条 **与 `session` 表 id 完全一致**（名字叫 experimental，其实是 V1）。
- **桌面版 OpenCode 1.19 使用 `session_v2`(V2)**。两套存储并存：`session_v2` 345 条中 53 条为 V2-only，对 CLI **完全不可见**（`GET /session/{id}`、`DELETE`、`move-session` 全 404）。
- 已把 CLI 1.18.35 升级到 **1.19.0**，但 CLI 仍只服务 V1（未切到 V2）。
- **影响**：本工具列表(=V1)只会显示可删会话；V2 遗留不会出现。若删除时报 `Session not found`，是"会话在列表后被桌面版迁到 V2"的竞态。
- **已做**：删除遇上游 404 → 本服务返回 `404 {error:'not_found'}`（不再 502）；UI 当"已不存在"刷新；批量删除计入 `notFound`。
- 若要彻底清除 V2-only 遗留，需直接写 SQLite（`session_v2`/`session_message`/`event`/session_diff），要求停 opencode——待用户决定。

## 13. 待验证
- fork 父会话删除/归档时，子会话如何处置。
- `/session` 是否也能列出归档（`scope` 参数语义）。
- `opencode export` CLI 与 `/session/{id}/message` 导出内容差异（做备份方案时定）。

## 8. 交付物（待定）
- 删除工具/服务的形态（CLI、HTTP 服务、脚本）由后续任务确定后补充。
