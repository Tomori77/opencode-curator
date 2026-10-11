# opencode-curator — opencode 会话管理器

一个本地 Web 工具，用于**安全、可分类地浏览与清理 opencode 会话**。后端只通过 `opencode serve` 的 HTTP API 操作会话，**绝不直接写数据库**。

> 截图：待补充（运行 `npm run start` 后访问 `http://127.0.0.1:8787`）。

## 功能

- **会话列表**：多维过滤（项目 / 目录 / 模型 / Agent / 归档 / 仅根会话）、全文搜索、排序、分页。
- **主会话分组**：默认只显示你发出的根会话；每条根会话可展开查看它派生的**子代理**会话（`▸ 子代理 N`）。
- **详情与可视化**：消息时间线（文本 / 思考 / 工具调用 / 步骤），费用与 tokens、待办、状态徽章。
- **改标题**：在详情面板行内编辑。
- **归档（软删除）**：隐藏会话并保留数据，可在归档视图查看。
- **硬删除（安全）**：影响面预览（消息 / 片段 / 子会话）+ 二次确认 + 保护名单拦截 + 删除前可选服务器备份。
- **批量删除**：多选（含本页全选）与"删除这些空会话"快捷操作。
- **备份 / 导出 / 恢复**：导出为可被 `opencode import` 还原的 JSON；删除前可自动备份；备份列表支持下载 / 恢复 / 删除。
- **统计看板**：总会话 / 花费 / tokens，按模型、项目、Agent、月份的分布与排行。
- **分支树**：按 `parentID` 展示父子关系。
- **健康检查**：孤儿子会话、孤儿 diff 文件、空会话、长期未更新、受保护但已不存在（只读扫描）。

## 技术栈与架构

- 后端：Node.js + TypeScript + Express。
- 前端：Vite + React + TypeScript（苹果风卡片 UI）。
- 上游：`opencode serve`（默认 `http://127.0.0.1:4096`）。

```
浏览器 SPA (web/) ──HTTP──▶ 本服务 (server/, :8787) ──HTTP──▶ opencode serve (:4096)
                                   └─ 本地状态：data/protected.json、data/exports/
```

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 与 [docs/API.md](docs/API.md)。

## 环境要求

- Node.js（建议 20+）
- 已安装 `opencode` CLI，并可在 PATH 中调用
- Windows：仓库附带 `.ps1` / `.bat` 启动脚本；其它平台可手动执行等价命令

## 安装与运行

```bash
npm install      # 安装依赖
npm run build    # 构建后端(tsc) + 前端(vite)
```

**一键（Windows）**：双击项目根目录的 `启动.bat` / `停止.bat`。
`启动.bat` 会：确保 `opencode serve`（4096，已在跑则复用）→ 启动本服务（8787）→ 打开浏览器。

**手动 / 跨平台**：

```bash
opencode serve --port 4096 --hostname 127.0.0.1   # 另开一个终端，保持运行
npm run start                                     # 启动本服务（默认 8787）
```

开发模式：

```bash
npm run dev:server          # 后端热重载 (tsx watch)
cd web && npm run dev       # 前端 Vite 开发服务器（/api 代理到 8787）
```

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8787` | 本服务监听端口 |
| `OPENCODE_SERVER_URL` | `http://127.0.0.1:4096` | 上游 opencode serve 地址 |
| `OPENCODE_DATA_DIR` | `%USERPROFILE%\.local\share\opencode` | opencode 数据目录（健康检查扫描 `storage/session_diff` 用） |
| `OPENCODE_BIN` | `opencode` | 恢复备份时调用的 opencode 可执行文件 |

## 目录结构

```
opencode-curator/
  server/       后端（Express + TS）：routes / services / opencode 客户端 / store
  web/          前端（Vite + React）：components / api / ui(设计令牌)
  scripts/      start.ps1 / stop.ps1
  启动.bat 停止.bat
  data/         运行时本地状态（已被 .gitignore 忽略）
    protected.json   保护名单
    exports/         会话备份
  docs/         PROJECT.md / ARCHITECTURE.md / API.md
```

## 已知限制

- opencode CLI 只读写旧存储 `session`(V1)；桌面版写入的 `session_v2`(V2) 遗留会话对 CLI 不可见、无法删除（列表不会显示它们）。
- 归档是**单向**的：opencode HTTP API 不支持取消归档。
- 不提供空间回收（VACUUM）。
- 删除上游 404 会被当作"会话已不存在"优雅处理（不再报错）。
- 本机若设了 HTTP 代理，`curl.exe` 访问 `127.0.0.1` 需加 `--noproxy "*"`；Node `fetch` 默认不走代理。

## 许可

[MIT](LICENSE)
