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
