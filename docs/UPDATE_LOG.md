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

## 2026-09-24 · 工作区未提交 · Spidey 散文回复 + 可点导航

**取消 bullet；起步／下一步给可点跳转；Spidey／团队只讲短故事**

- **做了什么**：回复改为散文；导航类问题附带 `[[go:/path|Label]]` 芯片（前端渲染为按钮并 `navigate`）；「Where do I start」等走固定起步回复；Spidey／团队背景走短故事且不加芯片；范围仍仅限 EduNets／团队／Spidey。
- **为什么**：对齐产品对聊天体验与导航引导的要求。
- **影响面**：`spidey-chat` 服务与聊天 UI；旧 bullet 渲染路径移除。
- **坑**：导航 path 有白名单，模型胡编的 path 会被丢掉。

---

## 2026-09-24 · 工作区未提交 · 顶栏：streak / 通知 / 头像

**把连续学习、通知铃、个人资料挪到主内容区右上角**

- **做了什么**：新增 `AppTopBar`（页标题 + streak 胶囊 + 日期 + 铃铛角标 + 头像）；挂进 `AppShell`；侧栏去掉账号卡与 Notifications／My Profile 入口（桌面与手机底栏一致）；Dashboard 的「N-day streak」胶囊改由顶栏承担。
- **为什么**：对齐 Revamp 稿的顶栏布局。
- **影响面**：`/notifications`、`/profile` 改由顶栏进入；教师顶栏不显示 streak／通知铃。
- **坑**：streak 仍按「今日是否复习过」计 0／1，与原先 Dashboard 逻辑一致。

---

## 2026-09-24 · 工作区未提交 · Spidey 安全层

**登录必填 + 每用户限流 + 注入检测 + 输入消毒 + 学生内容标签隔离**

- **做了什么**：新增 `spidey-security`（20 次／分钟限流、控制字符清理、jailbreak／prompt-injection 检测、history 必须末条为 user、materials 消毒）；prompt 增加 SECURITY 规则并把学生话包进 `<student_message>`；输出 scrub；校验收紧至 8 条／1500 字；429 限流响应。
- **为什么**：防止未授权滥用、绕过人设或套取系统提示。
- **影响面**：`/me/spidey/chat`；Vitest `spidey-security`。
- **坑**：内存限流在多实例部署时不共享，生产若水平扩展需换 Redis。

---

## 2026-09-24 · 工作区未提交 · Spidey 结构化回复

**聊天答案强制 opener + 要点列表 + 下一步；气泡按块渲染；emoji-regex 放大表情**

- **做了什么**：prompt 规定勿写大段；`normaliseSpideyReply` 把散文拆成条列；固定拒答也改成多行；前端解析 bullets／numbered／closer；`emoji-regex` 单独渲染表情。
- **为什么**：用户不要一大段段落式回答。
- **影响面**：`spidey-chat` 前后端；依赖新增 `emoji-regex`。

---

## 2026-09-24 · 工作区未提交 · Spidey 首次／回访欢迎 + 5 分钟激励

**首次进 app 用固定 Spidey 导览；回访短欢迎；点功能仍一句介绍；每 5 分钟一句正向激励**

- **做了什么**：localStorage 记首次欢迎、sessionStorage 记本会话欢迎；路由切换继续弹功能一句话；app 内每 5 分钟轮换 motivation tip（聊天打开时不打断）。
- **为什么**：用户要区分新／老用户，并定期给学习鼓励。
- **影响面**：`global-mascot.tsx`。

---

## 2026-09-24 · 工作区未提交 · Spidey 答常见平台问题

**放宽 EduNets 相关问答：从哪开始、功能介绍、出身背景、下一步；仍拒学科与无关闲聊**

- **做了什么**：FAQ／功能事实写入 guide；导航类短问（Where do I start? 等）进模型；学科题仍固定导向 Smart Quiz／Ask Teacher；要求有用回答以轻柔 next step 收尾。
- **为什么**：用户要 Spidey 能答一切与网站／背景相关的简单问题。
- **影响面**：`spidey-chat` 分类与 prompt；欢迎语。

---

## 2026-09-24 · 工作区未提交 · Spidey 人设与回复边界

**按产品 brief 重写 Spidey：SIM 出身、只谈 EduNets、学科题导向 Smart Quiz／Ask Teacher**

- **做了什么**：更新 `spidey-chat` system prompt（性格、起源、能／不能帮什么、语气）；off-topic 与学科题分两条固定回复；平台关键词加入 memory score／creators；欢迎语同步；测试更新。
- **为什么**：用户提供完整 Spidey 人设文案。
- **影响面**：Spidey 聊天后端与欢迎气泡。产品功能名仍用 Revision Hub／Notes Library（brief 里的 Notes Lab 作别名写进 guide）。

---

## 2026-09-24 · 工作区未提交 · 生成笔记可选子主题

**Generated Notes 与闪卡一样：有 curriculum 子主题时可选 Whole topic 或具体子主题**

- **做了什么**：`generate-topic-notes`／validation／API 增加可选 `focus`；Notes Library 选择器加子主题；检索与 prompt 聚焦该子主题。
- **为什么**：用户要按子主题生成笔记。
- **影响面**：生成笔记前后端；RAG 仍按父 topicId。

---

## 2026-09-24 · 工作区未提交 · 数学教材 RAG 入库

**把 Maths Summary.pdf 按化学同款流程 ingest 进 reference chunks**

- **做了什么**：复制为 `content/textbooks/Math_Text.pdf`；manifest 增加 e-math 三个父 topic；跑 `db:ingest-textbooks`（仅数学，避免重嵌化学）→ 144 chunks，覆盖 Number & Algebra / Geometry / Statistics。
- **为什么**：数学 Revision Hub 评价／闪卡／生成笔记要 grounded 在这本 PDF。
- **影响面**：Supabase `reference_documents`／`reference_chunks`；PDF 仍 gitignore。
- **坑**：第 106 页无可用文本层被跳过；PDF 字体警告可忽略。

---

## 2026-09-24 · 工作区未提交 · Spidey 功能一句话提示

**进入每个功能页时弹出一行用途提示；点击 Spidey 仍开完整聊天**

- **做了什么**：面板分 tip／chat 两种模式；路由切换每次自动 tip（约 5 秒后收起）；文案改为一句「这功能是做什么的」；tip 上可点 Ask Spidey。未新加库（沿用现有 mascot + motion）。
- **为什么**：用户要功能提醒，同时保留聊天。
- **影响面**：`global-mascot.tsx` 行为。

---

## 2026-09-24 · 工作区未提交 · Capture Hub 更名为 Revision Hub

**学生可见名称改为 Revision Hub（路由仍为 `/capture-hub`）**

- **做了什么**：导航／页面标题／Spidey 文案／落地页与学生手册中的 Capture Hub → Revision Hub；中文导航为「复习中心」。
- **为什么**：产品改名。
- **影响面**：仅展示文案；URL 与 API 路径未改。

---

## 2026-09-24 · 工作区未提交 · Spidey 聊天布局灵感自 Ask Andy

**Spidey 面板改为头像标题栏 + 消息区 + 输入栏布局，保留 EduNets 配色与 logo**

- **做了什么**：Ask Spidey 头栏（spidey-icon + 副标题 + 关闭）；助手气泡左侧带头像、用户气泡右侧品牌蓝；底部圆角输入 + 上箭头发送 + AI 脚注；消息区内滚动，外壳不滚。
- **为什么**：用户要参考 Andy 助手布局，但用自家颜色与 Spidey logo。
- **影响面**：`spidey-chat.tsx`、`global-mascot.tsx` 面板壳。

---

## 2026-09-24 · 工作区未提交 · 闪卡 Question/Answer + 换主题返回 + 子主题

**闪卡标签改为 Question/Answer；学习中可返回改 subject/topic；有子主题时可选**

- **做了什么**：卡面 Front/Back → Question/Answer；甲板顶栏加「Change topic」返回选择器（保留当前 subject/topic）；有 curriculum 子主题时多出一道选择（Whole topic 或具体子主题）；API `focus` 把子主题带进检索与生成 prompt（RAG 仍按父 topic）。
- **为什么**：学生中途想换主题，且大 topic 下需要按子主题刷卡。
- **影响面**：`generate-flashcards` / validation / `lib/api/capture` / Capture Hub 闪卡区。
- **坑**：子主题只影响检索 query 与 prompt 聚焦，不另开 RAG topicId。

---

## 2026-09-24 · 工作区未提交 · Spidey 限平台 + 短评价清单

**聊天框随内容伸缩且仅答 EduNets；评价改为可勾选的激励下一步**

- **做了什么**：Spidey 去掉固定大高度，消息区随内容增高并设上限；离题直接回绝平台外问题。评价弹窗去掉长 Covered/missing 列表，改为百分比 + 鼓励句 + 可勾选 next steps（Radix Progress + Checkbox）。
- **为什么**：用户要求非 sticky 聊天、只谈平台，以及短而激励的互动评价。
- **影响面**：Spidey UI／prompt；Capture Hub 评价对话框。
- **坑**：Vitest spidey-chat 已更新。

---

## 2026-09-23 · 工作区未提交 · 闪卡生成后只留学习卡面

**Generate 后整格切到 loading，再只显示翻卡 + Generate again**

- **做了什么**：未生成时仍为科目／课题／Generate；点击后清空并全格 loading；成功后去掉 🃏 标题与选择器，只留翻卡控件与 Generate again。双列 `items-stretch`，两格同高，不拉宽 Upload 侧。
- **为什么**：按用户 1A／2A 确认。
- **影响面**：仅 Capture Hub 闪卡格。
- **坑**：无。

---

## 2026-09-23 · 工作区未提交 · 紧凑单卡翻转闪卡

**闪卡改为单卡 3D 翻转，缩小占位**

- **做了什么**：去掉 `FlashcardArray` 大甲板；用 Motion `rotateY` 做轻量前后翻转；一卡一屏、矮卡片、小 prev/next + Know it 行。卸载未再使用的 `react-quizlet-flashcard`。
- **为什么**：用户只要一张可翻的卡，并希望布局更省空间。
- **影响面**：仅闪卡 UI。
- **坑**：无。

---

## 2026-09-23 · 工作区未提交 · Quizlet 风格闪卡交互

**用 `react-quizlet-flashcard` 替换自制翻卡，并加上 Know it / Still learning**

- **做了什么**：接入 `react-quizlet-flashcard`（`FlashcardArray` + `useFlashcardArray`），新组件 `features/capture/topic-flashcard-deck.tsx`：翻转动画、进度条、循环导航，以及 Know it / Still learning / Restart deck。
- **为什么**：用户要求更接近 Quizlet 的交互，而不是静态前后切换。
- **影响面**：仅 Capture Hub 闪卡 UI；生成 API 未改。
- **坑**：无。

---

## 2026-09-23 · 工作区未提交 · Capture Hub UX 刷新

**落地页改为上传评价／闪卡，Notes Library 分层，并柔化 Spidey 与评价语气**

- **做了什么**：Capture Hub 首页只保留「Upload handwritten notes」与「Generate flashcards」；Notes Library 按钮进入第二层（Generated Notes RAG + Materials Library）。新增 `generate-flashcards` 服务／`POST /me/capture/generate-flashcards`／翻卡 UI。Spidey 语气更口语；评价 prompt 改为短鼓励句与 Keep/Add/Try 步骤。保存按钮改为 Save to Materials Library。
- **为什么**：按产品要求拆开落地操作与资料库，并加入教材 RAG 闪卡。
- **影响面**：Generate Notes 从落地砖块移到 Notes Library；材料列表不再挂在首页底部。
- **坑**：相关 Vitest（spidey / flashcards / note-evaluation / capture-analysis）与 typecheck 已通过。无浏览器端到端验证。

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
