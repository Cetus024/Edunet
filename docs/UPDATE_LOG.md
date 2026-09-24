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

## 2026-09-24 · uncommitted · Auto

**去掉 essay results 本地 UI preview 演示**

- **做了什么**：删除 `buildEssayResultsPreview`、`?preview=essay-results|essay-marking` 入口、预览横幅与样例会话数据。结果页只走真实 attempt。
- **为什么**：演示已够用，合并 main 前清掉测试脚手架。
- **影响面**：仅 `quiz.tsx`；B/M/A 阅卷与 ink scheme UI 保留。

---

## 2026-09-24 · uncommitted · Auto

**暂时去掉分数卡「学习焦点」对话框**

- **做了什么**：移除点分数卡打开的 prioritise learning outcomes 弹层、「Your focus next」钉选与相关 helper。
- **为什么**：用户暂时不要这个交互。
- **影响面**：仅 essay results 左栏；mark scheme ink 保留。

---

## 2026-09-24 · uncommitted · Auto

**修 scheme 化学式：KaTeX 渲染而非裸 LaTeX**

- **做了什么**：`liftInlineEquations` 不再在已有 `$…$` 里二次包 `\ce`；物种正则正确认 `(aq)`（之前 `[slgaq]` 只吃一个字母），半反应整句一次包进 mhchem。
- **为什么**：`Cu(s) -> Cu2+(aq) + 2e-` 被拆成嵌套 `\ce{Cu2}`，界面露出裸 LaTeX／破碎下标。
- **影响面**：`exam-katex-text.tsx` 的 `prepareExamKatex`（题干／scheme／反馈共用）。

---

## 2026-09-24 · uncommitted · Auto

**Essay scheme：Rough Notation 墨水高亮 + 点选 B/M/A 步进**

- **做了什么**：去掉仿第一张图的黄底粗阴影卡与 “Didn't follow that?”；接入 `react-rough-notation`，按 mark 点切换时用 highlighter／下划线 ink 出 scheme 句；芯片 + Prev/Next 步进。
- **为什么**：要 engaging 但不能看起来像抄那张 neobrutalist 卡；交互要更有新意。
- **影响面**：根依赖加 `react-rough-notation`；仅 essay part scheme UI。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：黄色「earns it」scheme 卡 + 点分数卡选学习焦点**

- **做了什么**：Reveal mark scheme 展开后按 B/M/A 点显示黄底粗边阴影「The sentence that earns it」卡（对齐阅卷句），下方左边线分析 + “Explain it simply”；点左栏分数卡打开对话，从漏分点／linkedConcept／课标 subtopic 多选自习焦点，确认后钉在左栏 “Your focus next”。
- **为什么**：scheme 要更像 exam highlight；分数卡要变成可交互的下一步规划，而不只是展示。
- **影响面**：`quiz.tsx` essay results；`curriculum` Redox 别名补 `Redox`。
- **坑**：预览用 `/quiz?preview=essay-results`；外圈阴影仍需父级 `overflow-visible`／足够内边距，否则会裁切。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：修裁切、闪亮分数卡、细滚动条、填满左栏空白**

- **做了什么**：Grade+百分比并进同一 badge，避免裁切；compact 分数做成闪亮渐变卡并 `flex-1` 吃掉中间空白；右栏用 `edunets-scrollbar`（4px）；去掉 `mt-auto` 大空洞。
- **为什么**：60%／mark pills 被 overflow 裁掉；空白与粗滚动条显得不精致。
- **影响面**：globals 新增 `.edunets-scrollbar`；essay results UI。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：左栏冻结 + 右栏单独滚动、左卡更有质感**

- **做了什么**：桌面左结果卡固定；仅右栏滚动题目／scheme。左栏做成圆角渐变容器（柔光 blob、分数内嵌玻璃感、三格 mastery），并显示 “Reviewing Qn · n more to go”。
- **为什么**：整页一起滚时左栏跟着走；用户要冻结左栏并略增 engaging 但不乱。
- **影响面**：仅 essay results desktop；手机仍上下滚动。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：加宽铺满 + 极简左右栏**

- **做了什么**：结果页容器放宽到 ~1560px（active 仍 1142）；左栏去掉叠卡片，改 hairline 分隔 + compact 分数环 + ghost 次要按钮；右栏吃剩余宽度做题＋阅卷；legend／题号网格去框。
- **为什么**：两侧留白过多显得挤在中间；要极简又把空间用满。
- **影响面**：仅 essay results 布局。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：左右分栏（分数／动作 | 题目＋阅卷）**

- **做了什么**：桌面两栏——左 sticky：总分、掌握度、提醒、Complete／Capture Hub／New／Concept Web；右：题号网格 + 当前题 + part marking + Prev/Next。手机仍上下堆叠。
- **为什么**：用户标注希望左看结果与出口、右专注题目与 scheme。
- **影响面**：仅 essay 结果布局。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：一页一题 + 题号网格导航**

- **做了什么**：结果页改成一次只看一题；题号网格（按得分着色）可跳转；Previous／Next；题干用 `ExamQuestionStem`（银行图可 Show/Hide figures）；学生草图折叠展开；题头预留 `attachSlot` 给日后 ONE attach。
- **为什么**：整卷堆叠太乱；网格＋翻页更直观，图不占死空间。
- **影响面**：仅 essay 结果 UI。

---

## 2026-09-24 · uncommitted · Auto

**Essay：连续 indeterminate 进度条 + Correct answer**

- **做了什么**：阅卷 overlay 改成线性扫过的 indeterminate bar（不再来回跳宽度）。Reveal 后在 Official mark scheme 下增加 Correct answer（由该 part 的 schemeSentence／银行 guide 组成）。
- **为什么**：旧进度条宽窄回跳看起来像卡死；学生需要「满分该怎么写」的对照。
- **影响面**：仅 UI；预览仍用 `?preview=essay-results`。

---

## 2026-09-24 · uncommitted · Auto

**Essay 复习：按 Part 对照（Your answer → Scheme → Verdict → Explanation）**

- **做了什么**：每题拆成 Part 卡片；默认只看你的答案，Reveal 后显示该 Part 的银行官方 scheme（从 `(a) [n marks] …` 解析）、Verdict（Correct/Partial/… + 分数）与 Explanation。Gemini 要求回 `parts` 与 `markPoints.partLabel`。
- **为什么**：整题混在一起难读；Cambridge／MarkScheme 式复习是按 part 对照 scheme。
- **影响面**：结果页 UI + grading JSON 可选 `partLabel`；旧 attempt 无 parts 时仍可从 marks 推断。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果：按题复习 + Reveal mark scheme**

- **做了什么**：每题卡片默认只看分数／你的答案；点「Reveal mark scheme & marking」才展开银行官方 scheme（`correctAnswer`）与该题 B/M/A 给分。B/M/A 图例提到整页一次，去掉每卡芯片洪水。
- **为什么**：整页一次性摊开 scheme＋legend＋breakdown 太乱，学生要先看自己的答案再主动对 scheme。
- **影响面**：仅结果页 UI；预览 `/quiz?preview=essay-results` 同样行为。

---

## 2026-09-24 · uncommitted · Auto

**Essay 阅卷：B / M / A examiner mark codes**

- **做了什么**：Gemini 按 B（independent）、M（method）、A（accuracy）拆分 markPoints；A 可挂 `dependsOn` 对应 M，未得 M 则强制不给 A；分数总和裁到题目 `maximumMarks`。结果页增加 B/M/A 图例与色码芯片；`?preview=essay-results` 示例含 B+M+A。
- **为什么**：对齐 GCSE／A-Level／O-Level 阅卷字母码，让学生看清「独立分／方法分／准确分」。
- **影响面**：`grading_feedback.markPoints` 新增可选 `code`／`dependsOn`；旧数据仍可按 id 首字母推断。
- **坑**：跑 `npm run api:test` 覆盖 A-depends-on-M 与总分封顶。

---

## 2026-09-24 · uncommitted · Auto

**Essay 结果页：点分结构 + O-Level 等级 + sense credit**

- **做了什么**：Gemini 返回 `markPoints`（scheme sentence + analysis）与最多 2 分的 `senseBonus`（未打中钥匙但答案合理时不直接 Incorrect）；结果页改成 stamp 分数＋A1–F9、可展开 PART 卡片与黄底 “sentence that earns it”；Finish 时显示 marking overlay。
- **为什么**：要对齐更清晰的阅卷反馈；空白／胡扯仍 0 分，有道理的偏题最多 1–2 分。
- **影响面**：需新 Finish 才有 markPoints；旧 attempt 仍可看 scheme 回退。
- **坑**：senseBonus 仅在 scheme 分为 0 时计入。

---

## 2026-09-24 · uncommitted · Auto

**Ozone 题干难读：PDF 硬换行 + Os/Oz OCR + 图文顺序**

- **做了什么**：Questionbank 里该 ozone 题 OCR 把 O₃/O₂ 写成 Os/Oz，并留下 PDF 行末 `\n`；前端还用 `whitespace-pre-wrap` 保留硬换行，且把图全部排到文前，破坏 “diagram below”。现加 `normalizeExamProse`（软换行合并、Os/Oz 修补）、stem 保持题库块顺序、行距略加大；并修正该 bank 题文本。
- **为什么**：用户反馈 wording／spacing 难读。
- **影响面**：新开的 attempt 立刻受益；旧 snapshot 靠前端 normalize。Capture Hub 可复用同一 normalize。
- **坑**：题库资产在 Storage 里是有的；若图仍不显示，查 `QUESTION_BANK_SUPABASE_URL` 是否加载。

---

## 2026-09-24 · uncommitted · Auto

**Question Bank：长题干不再整段塞进 \\ce{}（LaTeX overflow）**

- **做了什么**：查 Questionbank Supabase——约 33 条 APPROVED 长 `text` 块含反应箭头。根因是 `isChemistryExpression` / `formatExamKatexFragment` / 前端 `prepareExamKatex` 把整段英文包成 `$\\ce{…}$`，KaTeX 无法换行溢出。现用 `isMostlyProse` 只对短公式整包；散文只包命令；前端 unwrap 已快照的误包段落。
- **为什么**：Smart Assessment 题干「整段变 LaTeX」横向 overflow。
- **影响面**：新开的 attempt 立刻正确；旧 snapshot 靠前端 unwrap。Capture Hub 以后应共用同一套 prose/formula 规则。
- **坑**：题库里少数 stem 已自带 `$\\textbf{…}$`／`$\\text{W}$` 混排——那是合法 inline math，不要整段 unwrap。Questionbank 项目表均未开 RLS（MCP 告警）；未自动改权限。

---

## 2026-09-24 · uncommitted · Auto

**Essay review：展开看丢分原因 + 答案钥匙**

- **做了什么**：Gemini 评分多返回 `summary` + 各 part 的短反馈；写入 `quiz_attempt_answer.grading_feedback`；结果页可展开每题看「为何丢分」「你的作答」「Answer scheme」。
- **为什么**：学生只看到 Partial/Correct 分，不知道哪一小问错、为什么、标准答案是什么。
- **影响面**：需迁移 `0024_*`（`grading_feedback` jsonb）。旧已完成 attempt 无 AI 分项反馈，但仍可展开看题库答案钥匙；新 Finish 才有 part why。
- **坑**：drizzle generate 曾把旧表塞进 0024，已改成只 `ADD COLUMN`。

---

## 2026-09-24 · uncommitted · Auto

**Essay Finish 503 + KaTeX “latex everywhere” leak**

- **做了什么**：Essay Gemini 评分提高 `maxOutputTokens`、改用 `minimal` thinking、JSON 解析更稳（fence／coerce）、失败时无图重试并打日志；`prepareExamKatex` 不再把整段英文题干包进 `$…$`（只包 `\ce{}` 等命令）；答案框有 `$` 时默认展开公式预览。
- **为什么**：Finish 约 3.4s 返回「Essay marking failed」；插入公式后题干／答案看起来像整段 LaTeX 源码泄漏。
- **影响面**：无。需 API 热重载／重启后重试 Finish。
- **坑**：Gemini thinking 与可见输出共用 token；旧的 400 limit 易 `MAX_TOKENS`。

---

## 2026-09-24 · uncommitted · Auto

**Essay：Gemini 按答案钥匙评分（结束时）**

- **做了什么**：Finish essay 时用 Gemini（含照片／sketch 的 vision）对照题库 mark scheme 给每题分数；`correct`／`partial`／`incorrect` 写入 `isCorrect`＋marks；结果页显示 Correct／Partial／Incorrect。详解留到以后。
- **为什么**：Essay 原先一律 `marksObtained: 0`；用户要 AI 按答案钥匙判对错并计分。
- **影响面**：需配置 `GEMINI_API_KEY`；未配置会 503。Finish 会变慢（逐题调用）。
- **坑**：超大 base64 图会被跳过只评文字；评分是 provisional。

---

- **做了什么**：`quiz_attempt_one_active_topic_idx` 限制每 topic 只能有一份 in_progress。开始另一 mode 时先 abandon 旧会话再开新卷；同 mode 仍 resume。开发环境 500 日志补上 `errorMessage`。
- **为什么**：先前只按 mode 查 resume，插 MCQ 撞上未完成 Essay 的唯一索引 → 500。
- **影响面**：切换 mode 会丢弃同 topic 上未完成的另一 mode 进度。

---

## 2026-09-24 · uncommitted · Auto

**Fix：Smart Assessment 选 MCQ 却拉起 Essay 会话**

- **做了什么**：`createOrResumeAssessmentSession` 恢复进行中会话时加上 `quizMode` 匹配；同 topic 下未完成的 Essay 不再劫持新开的 MCQ。
- **为什么**：原先只按 user+topic+in_progress 恢复，忽略 mode，前端选 MCQ 也会 `setMode(response.mode)` 成 essay。
- **影响面**：同 topic 可同时存在进行中的 MCQ 与 Essay 各一份。

---

## 2026-09-24 · uncommitted · Auto

**Smart Assessment：MCQ 2×2 布局 + session 式骨架加载**

- **做了什么**：MCQ 选项改为 Question 下 A|B / C|D 两列（试卷风字母圆标，无选项卡）。开局／切题用脉冲骨架。**开始测验后**离开 Figma 白卡，改为全页开放舞台（仅 setup 保留白卡）。
- **为什么**：用户要更快的 next 手感、session loading，以及 quiz 中不要卡片。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**Smart Assessment 白卡对齐 Figma 尺寸 + 内文放大**

- **做了什么**：白卡 Figma 1142×814、圆角 86、`#FBF5F5`；setup 适度放大标题／下拉／模式卡／Start（无 zoom）。已回退掉后续 zoom／超大字号两轮。
- **为什么**：用户要回到「scale wording」那一版，不要 zoom 也不要过紧的 font-only 压缩。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**Concept Relay：修好建房 500 + 大厅文案／布局**

- **做了什么**：根因是 `study_relay_*` 表未迁移；已 `db:migrate` + `db:harden:supabase`。创建房间只在房间码冲突时重试，缺表返回清晰错误并引导本地演示。文案去掉 Gartic 类比；大厅加玩法四步、Classic／Icebreaker 场次卡、空位列表与 Invite／Start。
- **为什么**：Create room 报 An unexpected error；用户要更像房间大厅、文案更吸引。
- **影响面**：需已跑迁移的环境才能建正式房间；演示仍可用 `?mock=1`。

---

## 2026-09-24 · uncommitted · Auto

**Concept Relay 嵌回 Study Squad 壳层**

- **做了什么**：主路由改到 `/study-squad/relay`（走 AppGate + AppShell，侧栏 Study Squad 高亮）；旧 `/study-relay` 重定向并保留 query；大厅视觉对齐 Study Squad（card-shadow／面包屑／i18n）；创建房间带上 `squadId`；小队页增加 Concept Relay 活动卡与邀请链接。
- **为什么**：原先挂在 `(app)` 外，没有侧栏，像独立小站。
- **影响面**：书签 `/study-relay` 仍可用（自动跳转）。

---

## 2026-09-23 · uncommitted · Auto

**Study Squad Concept Relay（Chemistry Gartic Phone 原型）**

- **做了什么**：
  - 新增 `edunets.study_relay_*` 表与迁移 `0023_study_relay`（rooms／players／room_prompts／submissions）；Chemistry 提示词硬编码种子。
  - Hono `/api/v1/study-relay/*`：房间码创建／加入（显示名 + player token）、开局、画图 Storage 签名上传、解释提交、hop 超时跳过、整链 reveal 快照。
  - 前端 `/study-relay`（可无登录）：lobby → `react-sketch-canvas` 绘图 → 30s 看图 + 90s 解释 → `motion` 连环揭晓；Study Squad 入口按钮；`?mock=1` 本地 mock。
  - 可选 `@supabase/supabase-js` Realtime Broadcast + Storage；断线回退 5s 轮询。
- **为什么**：冰破／趣味小队玩法，不评分；按规格只动 Study Squad 相关新表。
- **影响面**：需跑迁移；生产要配 Supabase bucket／密钥（见 `.env.example`）。未配置 Storage 时真房间无法交图，请用 mock。
- **坑**：项目原本无 supabase-js、且 Data API 关闭——故意用 Broadcast 而非 postgres_changes。

---

## 2026-09-22 · uncommitted · Auto

**MathLive 公式编辑器 + Question Bank 化学 KaTeX 规范化**

- **做了什么**：
  - 新增 `exam-math-field.tsx`（MathLive）：Insert formula 用 Word 式编辑器（`2^2`、`/`、`_`），插入 `$latex$` 到作答框；附化学快捷 chips。
  - `external-question-bank`：识别 `chemistry`／`list` 内容块；text／math／mixed 选项与方程式自动包 `\ce{}`；纯 `\frac` 仍走普通 KaTeX；新增 `table`／`mixed` 模式映射；客户端 `prepareExamKatex` 作兜底。
- **为什么**：银行里大量 text 选项是 `H2O`／`PbO(s)+…` 明文，且 stem 的 `chemistry` 块被忽略，导致 MCQ 化学式不统一；用户要 Word 式幂次输入。
- **影响面**：新开 assessment 才拿到规范化选项；旧 attempt 快照不变。依赖新增 `mathlive`。
- **坑**：Questionbank 项目 `public` 表目前 **RLS 未开**（Supabase 顾问标 critical）——与本次改动无关，但应尽快加策略。

---

## 2026-09-22 · uncommitted · Auto

**Quiz essay：去掉 Test mark；Question A + 右上角分值；公式符号面板**


- **做了什么**：
  - 去掉 Quiz 页「Test mark」输入；essay 提交时自动 `marksObtained: 0`（API 仍要求该字段）。
  - 结构化小题标题改为 `Question A`／`Question A(i)`，分值右上角显示（如 `1 mark`）。
  - Insert formula 打开 Chemistry／Math／Greek 符号面板，一键插入 KaTeX／mhchem 片段，可 Preview。
- **为什么**：学生不该自填分数；标题更像试卷；公式需要可用的符号库而非只插空 `\\ce{}`。
- **影响面**：Essay 原始结果会显示 0／满分，直到真正批改上线。无 MathType 级插件——用内置面板即可。
- **坑**：无。

---

## 2026-09-22 · uncommitted · Auto

**Structured essay：Inspera 式每小题独立答题卡（公式／附图）**

- **做了什么**：新增 `exam-structured-answer.tsx`——stimulus 在上（图优先），每个可答叶子 part（含 a(i) 嵌套）一张卡：`PART (a) · N MARKS`、图在题目前、Inspera 风格灰底 textarea、Insert formula（插入 `$\\ce{}$`）、Attach photo、公式预览。答案序列化为 JSON 提交。无 `structuredParts` 时仍用单框。
- **为什么**：用户要参考 Inspera／附图参考图，每小题独立作答并能插公式。
- **影响面**：Essay 提交 payload 仍是一个 string，但内容可为 part→answer JSON。
- **坑**：Draw it 暂禁用；附图以 data URL 存进该 part 的答案对象。

---

## 2026-09-22 · uncommitted · Auto

**展开侧栏顶部间距恢复为 pt-5（logo 不再贴顶）**

- **做了什么**：展开态品牌区改回 `px-5 pt-5 pb-3` 正常流式排版；折叠态仍居中 Spidey。双图挂载优化保留。
- **为什么**：绝对定位品牌块把顶部留白挤掉了，展开时整体偏高。
- **影响面**：无。

---

## 2026-09-22 · uncommitted · Auto

**侧栏折叠钮被 contain:paint 裁切：改回贴在轨右缘居中**

- **做了什么**：去掉 `contain: layout paint`（会裁掉伸出轨外的按钮）；折叠钮改为 `left:100%` + `-translate-x-1/2`，始终骑在 aside 右缘中线，收起／展开相对位置一致；`aside` 设 `overflow-visible`。
- **为什么**：性能优化加的 paint containment 把半个折叠钮裁掉了。
- **影响面**：无。

---

## 2026-09-22 · uncommitted · Auto

**侧栏折叠性能：160ms 快切、去掉 blur 透明度动画、延后 localStorage**

- **做了什么**：逻辑不变（icon-only 收起 + width swipe）。`SIDEBAR_DURATION_MS` 280→160；折叠时不再对 `blob-soft`（`filter:blur(28px)`）做 opacity 过渡（展开才挂载）；去掉宽阴影／nav 大阴影；`will-change` + `contain`；`atomWithStorage` 用 `queueMicrotask` 写 localStorage；品牌图双挂载用 CSS 显隐避免反复 decode。
- **为什么**：用户觉得侧栏 toggle 卡；主因是 blur 层跟宽度一起动、同步写盘、动画偏长。
- **影响面**：无。

---

## 2026-09-22 · uncommitted · Auto

**Smart Assessment：KaTeX 渲染题干／选项；Structured 完整呈现 a／b／b(i) 子题与银行分数**

- **做了什么**：
  - 后端 `external-question-bank.ts`：math 块保留为 `stemBlocks.type:'math'`；MCQ latex 选项包成 `$...$`；structured 不再把 parts 压成一段文字，改为递归 `structuredParts`（含 `children` 与每题 `marks`）；`maxMarks` 优先用 Supabase `marksTotal`，否则累加 `parts_answer.marks_max`／parts marks。
  - `question-bank` 快照与 `assessment-quiz` 透传 `structuredParts`；schema jsonb 类型同步。
  - 前端新增 `ExamKatexText`（`react-markdown` + `remark-math` + `rehype-katex` + mhchem）；`ExamQuestionStem` 支持 math 块；`ExamStructuredBody` 教科书式呈现 Stimulus + Questions（a／b／嵌套 i、ii）并标注 marks。
- **为什么**：题库化学／算式需 KaTeX；Structured 一题含多子问与银行分数，原先扁平化丢失结构。
- **影响面**：已开的旧 essay attempt 若无 `structuredParts` 仍只显示 stem 文字（兼容）。新开一套才有完整子题。
- **坑**：父 part 常 `marks:null`（仅段落说明），分数在子题；总分为 `marksTotal`。

---

## 2026-09-22 · uncommitted · Auto

**Smart Assessment：Subject／Topic／Subtopic 全部悬停展开，Motion 平滑动画**

- **做了什么**：`apps/web/features/quiz.tsx` 用共享 `HoverSelect`（`motion/react`）替换 Radix `Select`。Subject、Topic、Subtopic 均悬停／聚焦即开菜单；菜单 fade+scale、选项轻微错开入场、chevron 旋转、Subtopic 列 `AnimatePresence` 滑入。选中项打勾用 spring。
- **为什么**：用户要求所有选择器都悬停打开，并用动画库把开合做得更顺。
- **影响面**：无。

---

## 2026-09-22 · uncommitted · Auto

**Smart Assessment：有 subtopic 的 topic 旁并排出现悬停选择器**

- **做了什么**：`apps/web/features/quiz.tsx` 的 `SetupPanel`——选中含 subtopic 的 topic 后，Subtopic 控件出现在 Topic **右侧**（`sm:grid-cols-2`），没有 subtopic 时不渲染。Subtopic 改为悬停打开的列表（`HoverSubtopicSelect`），不必再点开 Radix Select。
- **为什么**：用户要并排布局，并用 hover 代替点击下拉。
- **影响面**：无。

---

## 2026-09-22 · uncommitted · Auto

**侧栏折叠改为真正的 icon-only 轨（不再裁切半截胶囊）；修好 EduNets logo 被拉宽**

- **做了什么**：
  - `apps/web/components/app-sidebar.tsx`：放弃「内层固定 256px + overflow 裁切」——折叠时账号卡／高亮导航会露半截。改为折叠态真正切到 icon-only：居中 Spidey（`h-6`）、方形头像芯片、`h-11 w-11` 圆角图标按钮；展开态仍是完整 logo＋标签胶囊。宽度继续 CSS swipe；`iconsOnly` 在收起时立刻切、展开时等宽度动画结束再切，避免文字在半宽轨道里被挤扁。
  - Logo：Next/Image 默认常带 `width:100%`，再叠 `h-8` 会把字标横向拉变形——改成显式 `style={{ height: 32, width: 'auto' }}` + `object-contain`。
  - `apps/web/lib/sidebar-state.ts` / `app-shell.tsx`：共享时长与缓动，主内容 margin 锁步（沿用）。
- **为什么**：用户要的是正常「点一下变成纯图标栏」，不是裁出半截展开布局；也不要被拉宽的 EduNets 字标。
- **影响面**：无。
- **坑**：展开中途如果立刻渲染带标签的 pill，文字会在变宽过程中换行——所以 `iconsOnly` 必须比 `collapsed` 晚一拍恢复。改为展开时立刻切到完整布局、内容固定 256px 宽由 overflow 裁切揭示，才不会出现「宽空轨 + 左列图标」的中间帧。

---

## 2026-09-22 · uncommitted · Claude

**Smart Quiz 答题流程改为「先全部作答、最后统一回顾」；修掉 Framer Motion 三关键帧警告；修掉侧栏折叠/展开的抖动与残影**

- **做了什么**：
  - `apps/web/features/quiz.tsx`：`QuestionPanel` 原本是 Submit → 揭晓对错/讲解 → Next 三步，现在合并成一个「Next question / Finish assessment」按钮——选完直接提交并前进，测验过程中不再显示 Correct/Not quite、不再给选项上红绿色。正确与否全部挪到 `ResultsPanel` 新增的「Review your answers」区块：按题号列出，MCQ 只用绿/红底色 + 对勾/叉图标标记（不写"Correct"/"Not quite"文字），Essay 显示得分（没有对错二分，不上色）。`StudentQuizPage` 把原来的 `submit`/`finish`/`next` 三个函数合并成一个 `advance()`。
  - 同文件：MCQ 选项那个 `animate={{ scale: [1, 1.02, 1] }}` 配 `transition={{ type: 'spring' }}` 会在控制台报「Only two keyframes currently supported with spring and inertia animations」——spring 类型不支持三关键帧。把这个脉冲动效的 transition 从组件级 spring 里拆出来，直接写进 `animate` 目标对象自己的 `transition: { duration: 0.25, ease: 'easeOut' }`（tween），跟 whileHover/whileTap 的 spring 互不干扰。
  - `apps/web/components/app-sidebar.tsx`：折叠侧栏时，两个装饰性模糊光斑（给 256px 宽的展开态设计的）挤在 84px 窄轨道里会露出一道很扎眼的斜向色斑——加了 `opacity-0` 的过渡淡出，折叠时直接隐藏。展开时的抖动是因为 `collapsed` 一变，`SidebarContent` 里的文字标签/头像信息立刻用 React 条件渲染切换布局，但外层 `motion.aside` 的宽度还在 spring 动画里慢慢长——内容瞬间切到"展开版"排版，容器却还没长到那么宽，造成文字换行/挤压再回弹的抖动。拆成两个状态：`collapsed`（真实开关，立刻生效）和 `contentCollapsed`（决定要不要显示标签）——折叠时 `contentCollapsed` 跟着立刻变 true（收起来不需要等，本来就该消失得快），展开时则等 `motion.aside` 的 `onAnimationComplete` 触发才把 `contentCollapsed` 设回 false，标签只在轨道已经长到位后才出现。
- **为什么**：用户反馈测验时想要"先答完全部题、最后统一批改回顾"而不是每题即时对错；控制台报的 Framer Motion 警告是真实的 API 误用；侧栏折叠导致的视觉抖动和光斑残影是新功能引入的回归。
- **影响面**：破坏性变更——`QuestionPanel` 的 props 从 `onSubmit`/`onNext`/`onFinish` 三个回调收成一个 `onAdvance`；MCQ 选项在作答阶段不再能看到"这题选完之后对不对"，只能在最后的 Review 区块看到。`SidebarContent` 内部新增 `contentCollapsed` 与 `collapsed` 两层状态，外部 API（`AppSidebar` 本身）不变。
- **坑**：随机出题这件事——`apps/api/src/lib/question-bank.ts` 的 `seededShuffle` 用 `submissionId`（每次 `crypto.randomUUID()` 生成）当种子，理论上每次「Start the quiz」都会重新洗牌，已经是随机的。但 `createOrResumeAssessmentSession` 里有个「同一 topic 有未完成的 in_progress attempt 就直接 resume」的逻辑，不看 mode 也不看 subtopic——如果上次测验中途关掉页面没有点 Finish 也没有点垃圾桶 Abandon，下次点 Start 会一直续到同一份旧题目，感觉像是「题目固定了」。这是既有的 resume-in-progress 设计（防止半途数据丢失），没有动它；真要看到全新随机题目，先用题目面板右上角的垃圾桶图标 Abandon 掉上一次未完成的尝试。

---

## 2026-09-22 · uncommitted · Claude

**Smart Quiz 重做：去掉后端调试面板、单卡片布局、Persona 风格开场动画、侧栏可折叠、颜色改用 EduNets 品牌色、新增 subtopic 筛选**

- **做了什么**：
  - `apps/web/features/quiz.tsx`：删掉暴露 Bayesian 公式/参数的 `FormulaPanel`（"Backend source of truth"）；setup/question/results 三态收进同一张居中卡片（原先是侧栏+主内容两栏）；MCQ/Essay 选择卡加 `motion` 悬停/选中动效（共享 `layoutId` 滑动高光）；新增 Subtopic 下拉（在 Subject/Topic 之后，可选，默认 "All subtopics"）；Start 按钮文案固定为「Start the quiz」，不再随 mode 变化；全部 `#186636`/`#EAA93C` 硬编码色换成 EduNets 品牌色 `#1D3A62`（navy）/`#FFE38F`（gold）。
  - `apps/web/features/quiz-intro.tsx`（新文件）：进入 Smart Quiz 时的一次性开场动画——大标题 + Brain 图标（替代原先的 "Smart Assessment" 文字）+ 三个大幅高斯模糊的品牌色圆斑（navy/light-blue/gold）做"墨水扩散"效果，取代早期版本里生硬的斜切色块；点击/2.4s 后自动过渡到真正的 setup 卡片。deep-link（rescue nudge 等直接跳进行中 session 的场景）跳过这个动画。
  - 后端 subtopic 筛选（真实生效，不是摆设）：`apps/api/src/lib/question-bank.ts` 的 `candidateRows`/`selectQuestionRows`/`selectExternalQuestions`/`getQuizOptions`/`getKeyedQuestions` 都加了可选 `subtopicId` 参数；本地题库按 `row.subtopicId` 过滤，Chemistry 外部题库按已经匹配好的 `question.subtopic.id` 过滤。`validation.ts` 的 `quizOptionsQuerySchema`/`quizSetRequestSchema` 加 `subtopicId?`；路由与 `createOrResumeAssessmentSession` 透传。前端 `lib/api/quiz.ts` 的 `getQuizOptions`/`generateQuizSet` 跟着加参数。
  - `apps/web/components/app-sidebar.tsx` + 新文件 `apps/web/lib/sidebar-state.ts`：桌面侧栏可折叠为 84px 图标栏（`atomWithStorage` 持久化），折叠态用 `spidey-icon.png`（吉祥物）代替文字 Logo；导航列表单独 `overflow-y-auto`（`min-h-0`），避免 8 个导航项在矮屏幕上把底部内容顶出可视区却因为外层 `overflow-hidden`（给装饰性模糊光斑用的）直接消失；语言切换 + 登出从侧栏搬到 `apps/web/features/profile.tsx`（师生两种 profile 视图都加了）；侧栏底部 "Built for O-Level momentum" 提示整块删除。
- **为什么**：Bayesian 参数面板是给开发者看的调试信息，对学生没有意义；两栏布局在 75% 缩放才能看全，100% 时裁切/滚动；配色用的是不在 EduNets 设计令牌里的随意绿/橙，和侧栏、Logo 的 navy/gold 不搭；subtopic 是已有数据（`quiz_questions.subtopic_id`），只是没在 UI 暴露。
- **影响面**：破坏性变更——`AssessmentSessionResponse`/`FormulaTraceStep` 相关的 trace 字段前端不再渲染（后端仍在算、仍在返回，只是不展示）；`SidebarContent` 的 `onLogout` prop 已删除；`LanguageToggle` 组件文档注释更新为"渲染在 My Profile"。`generateQuizSet`/`getQuizOptions` 新增可选参数，向后兼容。
- **坑**：subtopic 筛选是"诚实实现"——大多数 subtopic 单独的题量很可能不够 10 MCQ / 5 Essay 的门槛，届时 Start 按钮会按现有的 mode-availability 机制禁用，不会伪造凑数。`npm run api:test` 有 2 个失败（`database.test.ts` 编码不匹配、`validation.test.ts` 的 `marksObtained` 精度用例）——用 `git stash` 核实过，这两个在我改动之前就已经存在于这份未提交的工作树里，和本次 quiz 改动无关，未修。

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

## 2026-09-22 · quiz submit 校验 · Cursor

**修复 Question Bank 题提交时 `Request validation failed`**

- **做了什么**：`assessmentAnswerSchema`／相关 `questionKey` 正则同时接受 `topic:v2:qNN` 与 `topic:qb:<uuid>`；essay `marksObtained` 上限放宽到 100；Zod 错误回传首个字段说明。
- **为什么**：题库题 key 是 `:qb:` 格式，旧校验只认本地 `:v2:`，提交一律 400。
- **影响面**：教师 review 的 questionKey 同样放宽。重启／热重载 API 后生效；当前 attempt 可直接再点 Submit。

---

## 2026-09-22 · Question Bank 图题 · Cursor

**Smart Quiz 按 ISCA 题干顺序渲染文字＋Storage 图**

- **做了什么**：`asset_id` 解析到 `questions` bucket 公网 URL；题干存为 `stemBlocks`（写入 attempt 的 options jsonb）；前端 `ExamQuestionStem`／`ExamOptionsImage` 对齐 Question Bank 的 asset-frame 样式；支持 `composite_visual` MCQ。
- **为什么**：图已上传到 Supabase，但 API 仍写成 `[Image omitted]`，界面只显示纯文本。
- **影响面**：需 `QUESTION_BANK_SUPABASE_URL` + `QUESTION_BANK_QUESTIONS_BUCKET`（默认 `questions`）。已进行中的旧 attempt 无 stemBlocks，需新开一套题。
- **坑**：路径含空格的文件名会做 encode；图仍走公开 bucket URL（非签名）。

---

## 2026-09-22 · Question Bank 对接 · Cursor

**Chemistry Smart Assessment 改为跨库读 Question Bank（不导入）**

- **做了什么**：新增 `QUESTION_BANK_DATABASE_URL` 与 `apps/api/src/lib/external-question-bank.ts`。按 EDUNETS topic／subtopic **标题**拉取 APPROVED 化学题：`text`/`math` → MCQ，`structured` → Essay；无 subtopic 的 topic 允许 topic 级匹配。题量不足或未配置时回退本地 `quiz_questions`。Placement 仍走本地。
- **为什么**：概念网／Smart Quiz 要用题库真题，且不要把题复制进 EDUNETS。
- **影响面**：需在根 `.env.local` 配置 Question Bank 连接串并重启 API。前端 MCQ／Essay UI 形状不变；essay `maxMarks` 随题库 parts 变化。
- **坑**：图题暂无公网 asset URL，stem 里图片记为 `[Image omitted]`。部分 topic 纯文本 MCQ 可能不足 10 道，会静默回退本地种子。

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
