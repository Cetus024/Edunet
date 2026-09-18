# CLAUDE.md — EduNets agent 上下文

> 这份文件会被自动载入每一个 session。**先读它，不要一上来就全仓库 grep**。
> 需要历史背景（某个功能为什么长这样、上次是谁改的）才去读 [`docs/UPDATE_LOG.md`](docs/UPDATE_LOG.md)，那份不自动载入。

---

## 0. 每次改动完成后必做

**验证通过的改动 → 立刻在 [`docs/UPDATE_LOG.md`](docs/UPDATE_LOG.md) 顶部追加一条记录，再提交。**

- 追加到文件顶部（最新在上），格式见该文件开头的模板。
- 一次「有意义的改动」写一条，不是一个文件写一条。
- 只写**做了什么、为什么、碰到什么坑**；不要贴 diff，git 里已经有了。
- 如果这次改动推翻了本文件里的任何描述（结构、约定、已知问题），**同时更新本文件**。

---

## 1. 项目速览

EduNets：面向新加坡 O-Level 的学习平台，学生端做测验／概念图／笔记捕捉／小队协作，教师端看班级学情。

- **前端**：Next.js 16 App Router + React 19 + TypeScript 5（strict）+ Tailwind 4 + Radix UI，状态用 TanStack Query + Jotai。可静态导出到 `out/` 供 Power Apps 部署。
- **后端**：独立 Node 服务 `services/edunets-api`，Hono + Better Auth + Drizzle ORM + Supabase PostgreSQL。
- **AI**：Azure AI Vision OCR + Microsoft Foundry 推理（`AZURE_FOUNDRY_*` 优先，可回退 `MODELARTS_*`）。**所有 key 只留在服务端。**

前端 3000，API 8787。

---

## 2. 仓库地图

| 路径 | 作用 |
|---|---|
| `app/` | Next.js 路由。业务页在 `app/(app)/`（都经过 `AppGate` 鉴权），认证页在根层 |
| `features/` | 业务屏幕的实现，一个页面一个文件／目录。路由文件通常只是薄壳 |
| `lib/api/` | **前端调后端的唯一入口**，每个后端领域一个文件，内含 TanStack Query hooks |
| `lib/` | 纯前端工具：`curriculum.ts`、`teaching-context.ts`、`roles.ts`、`score-color.ts`、`i18n/` 等 |
| `database/schema/` | Drizzle schema，按领域切分（`auth` / `learning` / `catalog` / `study-squads` …） |
| `database/migrations/` | 迁移 SQL + `meta/` 快照 + `_journal.json`。**不要手改已提交的迁移** |
| `services/edunets-api/src/routes/api-v1.ts` | 所有 HTTP 端点定义，路由注册顺序有讲究 |
| `services/edunets-api/src/services/` | 真正的业务逻辑，route 只做校验 + 调用 |
| `services/edunets-api/src/validation.ts` | 所有请求的 Zod schema，**新端点一律在这里定义入参** |
| `services/edunets-api/tests/` | Vitest 测试，241 个，改后端必须跑 |
| `docs/` | `overview.md`（产品定位／user story）、`UPDATE_LOG.md`（更新日志） |

---

## 3. 常用命令

```bash
npm run dev          # 同时起前端 3000 与 API 8787
npm run api:test     # Vitest，改后端必跑（约 16 秒）
npm run typecheck    # 前端 + API 一起
npm run check        # typecheck + lint + api:test + build，提交前的完整闸门
npm run db:generate  # 改完 schema 生成迁移
```

---

## 4. 约定

- **前后端边界**：前端绝不直连数据库。新功能顺序固定为
  `database/schema/` → 迁移 → `services/.../services/` 业务函数 → `validation.ts` 入参 → `routes/api-v1.ts` 端点 → `lib/api/` hook → `features/` 界面。
- **入参校验**：端点的 query / body 一律走 `validation.ts` 里的 Zod schema，不要在 route 里裸读 `context.req.query()`。
- **角色**：`profile.role` 区分 `student` / `teacher`；教师相关判断用 `lib/roles.ts` 的 `isTeachingRole()`，不要散落字符串比较。
- **教师作用域**：教师的一切数据查询都挂在 `scopeId`（`teaching_scope` 的 id）上，且 `scopeId` 现在是**必填**。
- **不留死代码**：删功能时把 state、常量、文案、mock 数据一并清掉（仓库里有过多次这样的清理，保持一致）。
- **不要造假数据**：界面上的数字必须来自真实载荷；没有数据时给空状态提示，不要显示 0% 或占位小队。

---

## 5. 环境陷阱（踩过的坑，先查这里再怀疑代码）

1. **本机有两份 checkout**：`C:\Users\ASUS\Edunet`（Claude Code 用这份）和 `C:\Users\ASUS\.copilot\repos\edunets`（另一个 agent 的）。跑在 3000/8787 上的 dev server 可能来自**另一份**，改了没生效先确认进程的 `cwd`。
2. **`npm run db:migrate` 不会读 `.env.local`**：必须先 `export DATABASE_URL="…"`（带引号，连接串里有 `&`）。裸跑会 fail fast 且错误被 spinner 冲掉。
3. **Drizzle 迁移记录会和真实库漂移**：出现过迁移已应用但没记进 `__drizzle_migrations`，导致 `migrate` 无限重试。对照 `.sql` 的 sha256 与表里的 hash 再判断。
4. **`NEXT_PUBLIC_*` 用 shell 内联 export 传不进去**（Windows + npx）：写进 `.env.development.local` 让 Next.js 自己加载。
5. **`.next` 缓存会被中断的 dev server 弄坏**：`app/(app)/` 下所有路由服务端 404 时，先 `rm -rf .next` 冷启动，别去查 `AppGate` 逻辑。
6. **回填型迁移会撞上真实脏数据**：出现过 profile 引用了 catalog 里不存在的 `school_id`。用 `WHERE EXISTS` 显式跳过并把受影响账号报给用户，**不要猜值硬塞**。

---

## 6. 当前状态与未完成项

截至 `f4e2ef2`（2026-09-18）：

- **班级名单已从「教师自助」改为「管理员分配」**：新增 `school_class`、`student_class_assignment`（一人一班，主键强制），`teaching_scope.class_id` 必填。
- ⚠️ **但没有任何写入路径**：这两张新表在应用代码里只被读、从不被写，没有管理员端点也没有管理员界面，唯一填充来源是迁移里的一次性回填。**此提交之后新注册的师生会永久卡在「Awaiting admin assignment」** —— 这是目前最优先的缺口。
- ⚠️ **`user.class` 与 `student_class_assignment` 双数据源**：`/me` 优先读分配表、读不到才回退 `user.class`，同一事实两个来源，需要收敛。
- `0021_repair_class_assignments.sql` 是幂等修复迁移，对应一次线上迁移标记错乱事故；换环境时确认它跑过。
- 已删除的端点（调用方需注意）：`PUT /me/teaching-scopes`、`GET /me/students/search`、`POST /me/students`、`DELETE /me/students/:studentId`。
