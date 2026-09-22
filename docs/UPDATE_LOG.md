# EduNets 更新日志

每次验证通过的改动都在**本文件顶部**追加一条。最新在上。
本文件不会自动载入 session，需要历史背景时再读。常驻上下文在根目录 [`CLAUDE.md`](../CLAUDE.md)。

<details>
<summary>条目模板（点开复制）</summary>

```markdown
## YYYY-MM-DD · `<commit 短 hash>` · <作者>

**<一句话标题：改了什么>**

- **做了什么**：改动要点，按模块分条。不要贴 diff。
- **为什么**：动机或要解决的问题。
- **影响面**：破坏性变更、被删的端点／组件、需要跟着改的调用方。留空写「无」。
- **坑**：踩到的陷阱、验证方式、遗留问题。没有就整条省略。
```

规则：
- 一次「有意义的改动」一条，不是一个文件一条。
- 破坏性变更必须写进「影响面」。
- 如果改动推翻了 `CLAUDE.md` 里的描述，同步改那份。

</details>

---

## 2026-09-22 · merge main · Cursor

**把 `origin/main` 合进 `alex-AI`，接入 Spidey 聊天 UI 与 Capture Hub 更新**

- **做了什么**：merge `f4f0c56`。前端拿到 `apps/web/features/mascot/spidey-chat.tsx` 与 `lib/api/spidey.ts`（已挂在 GlobalMascot）；后端保留／对齐 Gemini、embeddings、generate-topic-notes、reference retrieval、note-evaluation；补 `db:ingest-textbooks`；旧路径导入改到 `packages/database`／`apps/web/lib`／`apps/api`。
- **为什么**：Spidey 聊天 UI 在 `main` 而不在 `Testing`；需要合进来才能在 mascot 上对话。
- **影响面**：登录后 mascot 在应用路由打开 Spidey 聊天。教材 ingest 走 `packages/database/ingest-textbooks.ts`。
- **坑**：main 仍是扁平布局，冲突对功能文件取 theirs 后再改 monorepo 导入。

---

## 2026-09-22 · merge Testing · Cursor

**把 `origin/Testing` 合进 `alex-AI`，并保持 monorepo 目录**

- **做了什么**：`git fetch` + merge `origin/Testing`（约 52 个提交）。冲突按「保留 `apps/web`／`apps/api`／`packages/database`」解决；删掉合并带进来的旧布局重复物（根目录 `app/`、`language-toggle.tsx`、`CAPTURE_HUB_*`、`WORK_SUMMARY_*`、`services/edunets-api`、根 `database/`／`features/`／`lib/`）。对照 Testing 的 API／DB 文件，monorepo 路径下零缺失。删掉无人引用且依赖不存在 API 的 `teacher-add-student-dialog.tsx`。`npm run typecheck` 通过。
- **为什么**：要把 Testing 上的功能历史并入当前分支，同时不毁掉已整理好的目录结构。
- **影响面**：无新破坏性路径变更；根目录仍只保留 monorepo 约定布局。
- **坑**：Testing 仍是扁平布局，直接 merge 会产生大量 rename／add 冲突；对 `apps/`／`packages/` 取 ours（本分支已含同内容并改过导入），旧路径一律丢掉。

---

## 2026-09-22 · monorepo 收尾 · Cursor

**完成 API 对齐并删掉根目录多余残留**

- **做了什么**：从 `main` 对齐 `apps/api`（路径改到 `packages/database` 与 `apps/web/lib`），去掉与 main 不一致的遗留文件；删根目录重复的 `landing/`（已在 `apps/web/components/landing`）和空壳 `src/`。全仓 `npm run typecheck` 通过。
- **为什么**：Option A monorepo 迁完后 API 与前端路径曾错位；根上还留着迁走后的重复目录。
- **影响面**：根目录不再有 `landing/`、`src/`。落地页只从 `@/components/landing` 引用。保留 `api/`、`services/huawei-sis-gateway/`、`app-gen-sdk/`、`generated/`。
- **坑**：根 `landing/` 与 `apps/web/components/landing` 内容重复，删前已对照文件名；IDE 里若仍打开旧路径文件属于已删副本。

---

## 2026-09-22 · 冲突解决 · Cursor

**解开把 main 上的 stash 应用到 `alex-AI` 时的合并冲突**

- **做了什么**：157 个未合并路径已全部解决，工作区不再含冲突标记。保留 monorepo 布局（`apps/web`、`apps/api`、`packages/database`）和 Google 登录。数据库 schema 用带班级分配、subtopic 和 Phase 1 双记忆的版本。导入改到 `packages/database` 和 `apps/web/lib`。补回 `api/serverless.ts`、`api/runtime-environment.ts`、`scripts/check-vercel-env.mjs`。
- **为什么**：stash 基于更新的 `57fd38f`，弹到更早的 `alex-AI` 后，重命名和双方改动叠在一起。
- **影响面**：相对 `alex-AI` 的未提交迁移，尚未提交。`packages/database/ingest-textbooks.ts` 仍引用不存在的 embeddings/gemini 模块，已从 API typecheck 排除。
- **坑**：部分文件曾按 OEM 代码页重存成乱码，已从 `57fd38f` 回填干净副本。`apps/api` 相关测试 60 项通过（database、enquiries、scoring、serverless、runtime-curriculum、concept-web-layout）。

---

## 2026-09-22 · 仓库结构 · Cursor

**归一化为 apps/web + apps/api + packages/database**

- **做了什么**：前端迁入 `apps/web`；原 `services/edunets-api` 迁入 `apps/api`；原 `database/` 迁入 `packages/database`。根 `package.json` 脚本、`drizzle.config.ts`、Vercel `api/index.ts`、Dockerfile、Power Apps `buildPath`、`scripts/preview.mjs`／`run-web.mjs`、文档全部改路径。API 内对 database 的相对导入改为 `packages/database`。
- **为什么**：根目录混着前后端，不符合常见 monorepo 导航习惯，新人难定位。
- **影响面**：本地／CI／Docker／Power Apps 构建路径变更；`.env.local` 仍放仓库根。旧路径 `services/edunets-api`、`database/` 不再存在。
- **坑**：Next 通过 `scripts/run-web.mjs` 以 `apps/web` 为 cwd 启动，依赖仍装在仓库根 `node_modules`。改完后请在根目录 `npm install` 再跑 `npm run typecheck`／`npm run check`。

---

## 2026-09-22 · 仓库整理 · Cursor

**清理根目录杂物，并把前端组件收到 `components/`**

- **做了什么**：删除根目录临时产物（`tsc-*.txt`、`tsconfig-debug.json`、过期 `WORK_SUMMARY_*`、`CAPTURE_HUB_2.0_HANDOFF.md`）；把 `app-shell`／侧栏／language toggle／teacher quiz review 等从根目录挪到 `components/`；把原 `ui/` 挪到 `components/ui/`；简化 `tsconfig` 路径别名；`.gitignore` 忽略本地 pytest／venv／tsc 诊断文件；更新 `CLAUDE.md` 仓库地图。
- **为什么**：根目录堆满调试输出和历史交接文档，组件又散落在根上，新同学很难一眼看懂前后端边界。
- **影响面**：`@/components/*` 仍可用，现指向 `components/`；历史工作摘要只保留在本更新日志与 git 历史中。本地若仍有无法删除的 `.pytest-questionbank-*` 目录，已被 gitignore。
- **坑**：Windows 下某些 pytest 目录可能因权限删不掉，忽略即可，勿提交。

---

## 2026-09-21 · 工作区未提交 · 评价准确率改为按 LO 比例给分

**评价百分比从「整项全对才给分」改为每条学习目标按完成比例给分**

- **做了什么**：`scoreFromObjectiveVerdicts` 对每条 syllabus LO 计 `credit = (accurate + 0.5×partial) / 该 LO 的证据点数`，再 `percentage = Σcredit / 总 LO × 100`。错误和未写仍为 0。分母仍是 unique LO，教材句子不再当额外满分。
- **为什么**：原先一项里有一句不全整项归零，分数偏低；按句计满分又容易刷分。半对半分是两者之间。
- **影响面**：Capture Hub 评价百分比会比全有或全无更高，仍不能靠重复同一技能抬分。UI 未改。
- **坑**：Vitest `note-evaluation` / `capture-analysis` 已通过。无浏览器端到端验证。

---

## 2026-09-21 · 工作区未提交 · Capture Hub 评价面板还原

**把 Capture Hub 评价摘要还原成原先的 Covered well / missing / How to improve 布局**

- **做了什么**：评价对话框去掉 KaTeX 公式卡、「Needs correction」和教材引用列表；百分比、Covered well、Not in your notes、How to improve 保持原样。`evaluationFormulaMarkdown` 从前端 `lib/study-notes.ts` 移除。后端仍按准确 LO / 总 LO × 100 计分。
- **为什么**：评价面板外观要回到首次给出准确率公式时的样子，计分逻辑保留。
- **影响面**：仅 Capture Hub 评价 UI；Generate Notes、KaTeX 笔记、Spidey 未改。
- **坑**：无浏览器工具做端到端点击验证；相关 Vitest（note-evaluation / capture-analysis / study-notes）已通过。

---

## 2026-09-19 · 汇总与复核 · Cetus024 + Codex

**汇总 Claude 本轮改动并完成提交前验证**

- **做了什么**：学生 dashboard 新增 Capture Hub 快捷入口及中英文副标题；Smart Quiz 计算追踪支持折叠／展开并保留步骤数与 posterior 摘要；新增 `CLAUDE.md` 和本更新日志，README 增加文档入口。
- **为什么**：让笔记捕捉更易进入、减少长测验的面板占用，并保留可持续维护的项目上下文。
- **影响面**：仅学生端 UI 与项目文档，无后端接口或数据库变更。
- **验证**：本次重新执行 `npm run check` 全部通过：前后端类型检查、ESLint（0 错误；本地临时脚本有 1 个未使用变量警告）、33 个测试文件 / 241 个 API 测试、前后端生产构建。未进行学生账号下的浏览器交互验证。本地工具状态、临时产物及自动生成的 `next-env.d.ts` 路径变化不纳入本次提交。

---

## 2026-09-19 · 随本次汇总提交 · Cetus024 + Claude

**Smart Quiz 计算追踪日志加折叠按钮**

- **做了什么**：`features/quiz.tsx` 的 `FormulaPanel` 里，「Provisional / Committed calculation」标题行右侧新增 Minimize / Expand 按钮。折叠时隐藏全部 `FormulaCard`，改显示一行摘要「N steps hidden · posterior X%」；展开时恢复原样。
- **为什么**：trace 每多一步证据就多一张卡片，长测验时会把面板里其他内容全部挤出视野。
- **影响面**：仅 Smart Quiz 右侧模型面板，纯前端 UI 状态，无接口改动。
- **坑**：折叠时要同时去掉容器的 `flex-1 overflow-auto`，否则收起来了还是会把父级 flex 的剩余高度全占满。用 `hidden` 属性而非条件渲染，配合 `aria-expanded` / `aria-controls` 保留无障碍语义。已验证 `tsc`、`eslint`、`next build`（`/quiz` 正常预渲染）；**未浏览器实机验证**，该面板只在进行中的测验里出现，需要学生账号。

---

## 2026-09-19 · 随本次汇总提交 · Cetus024 + Claude

**学生 dashboard hero 右上角加 Capture Hub 入口**

- **做了什么**：`features/dashboard.tsx` 的 hero 区从 `max-w-4xl` 单列改为 `lg:flex-row` 两列，右上角新增按钮（`Inbox` 图标 + `nav.captureHub` 标题 + 副标题 + `ChevronRight`），点击 `navigate('/capture-hub')`。`lib/i18n/dict/dashboard.ts` 新增 `dashboard.captureCta`（en/zh 双语）。
- **为什么**：Capture Hub 原本只能从侧边栏进入，而它是手机优先的流程，需要一个在 dashboard 上始终可见的入口。
- **影响面**：仅学生 dashboard；教师走 `TeacherDashboardPage` 分支，不受影响。
- **坑**：小屏堆叠在文案下方、`lg` 及以上才浮到右上角；文案容器加了 `min-w-0` 以便在 flex 行里正常收缩。已验证 `tsc --noEmit`、`eslint`、`next build`（`/dashboard` 正常预渲染）全通过；**尚未浏览器实机验证**，因为本地只有教师测试账号，学生 dashboard 需要学生账号。

---

## 2026-09-19 · 文档 · Cetus024 + Claude

**建立 agent 常驻上下文与本更新日志**

- **做了什么**：新增根目录 `CLAUDE.md`（仓库地图、命令、前后端边界约定、环境陷阱、当前未完成项），新增本文件作为滚动更新日志。
- **为什么**：此前每个 session 都要重新摸一遍仓库结构、重新踩一遍同样的环境坑，token 和时间都浪费在重复探索上。把稳定事实固化到自动载入的 `CLAUDE.md`，把易变的历史放进按需读取的日志。
- **影响面**：无代码改动。根目录原有的 `WORK_SUMMARY_2026-09-05.md` / `WORK_SUMMARY_2026-09-08.md` 保留不动，新的进展一律记到本文件，不再新增 `WORK_SUMMARY_*` 文件。

---

## 2026-09-18 · `f4e2ef2` · Shisa2025

**班级名单改为管理员分配，概念图新增整校视图**

- **做了什么**
  - **数据模型**：新增 `school_class`（`(school_id, lower(name))` 唯一）与 `student_class_assignment`（主键即 `student_user_id`，结构上强制一人一班）；`teaching_scope.class_id` 新增且 `NOT NULL`，`(user_id, class_id, subject_id)` 唯一；`user.class` 新增 text 字段；`onboarding_profile.subject_id` 放宽为可空；`classroom_enrollment` 降级为「遗留表，仅作迁移输入」。
  - **迁移**：`0019` 加字段；`0020` 建表 + 从 `teaching_scope.classroom_name` 回填班级，再按三级优先顺序分配学生（每级只认领唯一匹配者）；`0021` 幂等修复迁移。
  - **后端**：教师 onboarding 不再接受 `teachingScopes`；`/me` 返回 `user.class`；`PUT /me/school` 在已被分配到别校班级时返回 `409 CLASS_ASSIGNMENT_MANAGED_BY_ADMIN`；`/me/class-concept-web` 改为可辨识联合查询（`view=school&subjectId` 或 `view=class&scopeId`）；`scopeId` 在 `/me/students`、`/me/quiz-review`、单学生概念图上改为 Zod 校验且必填。
  - **前端**：教师 onboarding 砍成两步（角色 → 学校），完成后跳 `/dashboard`，草稿 key 升到 `v3`；删除 `features/teacher-add-student-dialog.tsx`，按钮改为只读徽章；个人资料页移除教室增删改编辑器，改为只读 + 「Awaiting admin assignment」；概念图新增「整校 / 单班」受众选择器、弹窗可拖动、显示「N of M 学生有进度」。
  - **测试**：新增 `class-assignments.test.ts`，断言 schema 不变量，并断言迁移 SQL 含预期回填语句、且不含 `TRUNCATE` / `DROP TABLE` / `DELETE FROM`。
- **为什么**：班级归属应由学校管理，而不是老师自己随手建教室、手动加学生 —— 后者会导致同一个班在不同老师那里名字不一、学生重复归属。
- **影响面**：**破坏性**。删除端点 `PUT /me/teaching-scopes`、`GET /me/students/search`、`POST /me/students`、`DELETE /me/students/:studentId`；教师 onboarding 请求体变更；`/me/class-concept-web` 查询契约变更；三个端点的 `scopeId` 从可选变必填。未经 PR 直接进 `main`。
- **坑**
  - ⚠️ **替代路径还不存在**：新表在应用代码里只被读、从不被写，没有管理员端点或界面，唯一填充来源是 `0020` 的一次性回填。此提交之后新注册的师生会永久卡在「Awaiting admin assignment」。
  - ⚠️ **双数据源**：`/me` 优先读 `student_class_assignment`，读不到才回退 `user.class`，同一事实两个来源。
  - `0021` 的注释说明：部分已部署数据库存在更新的 migration 标记，导致 `0019`/`0020` 被跳过 —— 对应一次线上事故，换环境时确认它跑过。
  - 验证：`npm run api:test` 33 文件 / 241 测试全通过；已 grep 确认无残留引用。

---

## 2026-09-09 · `8d71b8a` · Cetus024

**配置 GPT-5 mini Foundry 推理**

---

## 2026-09-08 · `e0db135` `1a5fbbb` · Cetus024

**去除假数据、白板评分与 Story 分享流程**

- Study Squad 的 Memory Score Recap、概念图「Find your friend」全部改用真实小队载荷；顺手修掉 Top learner 错显被选中成员的 bug。
- 删除 `lib/squad-data.ts` 里已无引用的 mock 数组与访问函数（约 85 行）。
- Capture Hub 移除「Add to Concept Web」整张卡片；提升摘要可靠性并支持 GPT-6 Astra。
- 新增 `lib/recap-story-image.ts`，用 canvas 直接绘制 1080×1920 PNG（主题用 `oklch()`，html2canvas 解析不了）；分享走 Web Share API，PNG 需**提前生成**，否则 iOS 会判定失去用户手势而拒绝。
- 详细记录见根目录 `WORK_SUMMARY_2026-09-08.md`。

---

## 2026-09-04 ～ 09-07 · Shisa2025

**概念图重做与 Vercel 部署抢修**

- `renewed concept web` / `improved conceptual web`：概念模型与缩放重做。
- Vercel 上一串抢修：`vercel api recovery` → 加固 serverless 启动与健康检查 → 暴露初始化诊断 → 追踪模块加载 → 修 ESM curriculum import（随后回滚）→ 最终以「把服务端分析保持在 curriculum 边界内」收尾。
- `textfield-based login/register added`：登录／注册改为文本框式。

---

## 2026-09-02 ～ 09-05 · Cetus024

**Capture Hub 2.0、多人房间与讨论室**

- Capture Hub：接入 Azure OCR + Foundry，真实 OCR／摘要／评估打通，支持拖拽与多图上传，主题选择器改由真实 catalog 驱动，新增无障碍笔记朗读。
- 多人：Study Squad 房间与通知、Rescue Room 重写并本地化、Revision Room 加「End session」、手写救援与复习流程打通。
- 讨论室：从 rescue 弹窗进入，加入控制节奏的 mediator，转写实时显示，评分在接模型前就可检查；未配置模型时保持静默。
- 概念图：学生端加 3D 物理，修掉气泡点击偏移，并与 Study Squad 打通。
- 详细记录见根目录 `WORK_SUMMARY_2026-09-05.md`、`CAPTURE_HUB_2.0_HANDOFF.md`。
