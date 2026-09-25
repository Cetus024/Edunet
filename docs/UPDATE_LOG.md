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

## 2026-09-26 · uncommitted · Auto

**首页布局优化：学科记忆健康度精简为双栏并排卡片（Side-by-Side），Priority Queue 保持长条列表格式并下移至下方**

- **做了什么**：
  - **Memory Health（记忆健康度）精简并排显示**：
    - 将学科卡片精简为左右并排的网格布局（`grid-cols-1 lg:grid-cols-2`），使用户在桌面端能一屏同时查看两门学科（Chemistry 与 Mathematics）；
    - 紧凑微调字体尺寸与内边距（`text-xs` / `text-sm` / `rounded-xl`），左侧仪表盘缩小至 `76px`，分支线条与右侧课题行无缝贴合；
    - 保留分支结构与「Concept Web & Analysis」直达跳转。
  - **Priority Queue（优先级复习队列）排版与位置调整**：
    - 根据用户截图指示，移回并保留条状行格式 [`PriorityItemRow`](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/features/dashboard.tsx)（左侧数字序号圆圈 `1`、`2`...，中段课题名称 + 学科黄色胶囊，下方 2 位有效数字记忆分数 + 耗时预估 + 下次复习到期提醒，右侧 `Start →` 快捷按钮）；
    - 将该模块**调整至 Memory Health 下方**；
    - 依然保持 Top 5 严格截取与 2 位有效数字精准显示。
  - **验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错；
    - 后端 `npm --prefix apps/api test` 46 个测试套件，333 个测试全量通过。
- **为什么**：满足用户关于将 Priority Queue 保持长条行列表格式并下移至 Memory Health 之后，并将 Memory Health 调整为双栏并排、字体与排版适度紧凑的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**首页布局重构：实现记忆健康度分支树状图（Memory Health by Subject & Topics）与 Top 5 优先级队列（Priority Queue）**

- **做了什么**：
  - **Memory Health（各科与各课题记忆健康度）**：
    - 根据用户手绘草图布局（Picture 1），实现组合分支卡片布局 [`MemoryHealthSubjectBranchCard`](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/features/dashboard.tsx)：
      - **左侧**：环形记忆分数仪表盘（Circular Gauge）呈现该学科平均记忆分数（以 2 位有效数字显示）、最后复习时间记录、一键「Review Weakest Topic」智能测验跳转，以及「Concept Web & Analysis」直达按钮；
      - **中间**：动态 SVG 分支连接曲线（Branching Bezier Curves），从左侧中心环平滑分支延伸至右侧每个具体课题节点；
      - **右侧**：各课题的横条记忆健康度卡片，展示课题名称、细分微课题数量、2 位有效数字记忆分数、彩色进度条、下次复习到期提醒（如 `Review Due: Today ⚠️` / `in 2 days`），以及直达 Smart Quiz 的复习入口；
    - 在学科头部提供「Concept Web & Analysis →」按钮，点击带参直达 `/concept-web?subject=...`，查看完整深度脑图分析与同学进度。
  - **Priority Queue（今日优先复习队列）**：
    - 采用草图 2 问候栏下方的卡片样式 [`PriorityQueueCard`](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/features/dashboard.tsx)；
    - **移除底部 Spidey 图标**；
    - **分数格式化为 2 位有效数字（2 s.f.）**（例如 `2.089275...%` -> `2.1%`，`6.06...%` -> `6.1%`，`17%` -> `17%`）；
    - **严格限制仅展示 Top 5 最具遗忘风险的课题**，避免过多课题让学生感到不知所措；
    - **增加下次复习时间提醒**（如 `📅 Review Due: Today ⚠️`，`📅 Review Due: Tomorrow` 等）；
    - **「Review Now →」按钮**直接进入对应课题的 Smart Quiz。
  - **移除底部连续学习模块（Your Streak）**：
    - 彻底移除首页底部的「Your Streak」段落及内部统计卡片（连续复习天数已常驻显示于顶部导航栏 `AppTopBar`）。
  - **国际化与质量验证**：
    - 在 `apps/web/lib/i18n/dict/dashboard.ts` 中补充新增的翻译键；
    - 执行 `npm --prefix apps/web run typecheck`（0 报错）；
    - 执行 `npm --prefix apps/api test`（46 个测试套件，333 个单元测试全部通过）。
- **为什么**：满足用户关于将记忆健康度重构为根据手绘草图的分支结构（左侧学科平均分，右侧分支到各课题分数，配有 Concept Web 入口）、将优先级队列精简为 Top 5 无 Spidey 的 2 位有效数字复习卡片、并移除底部 Streak 的完整视觉与功能需求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**移除新用户指南中的 Watch Video 按钮，并严格限定仅对新用户展示（已有学习数据的老用户不展示）**

- **做了什么**：
  - **移除 Watch Video / Tour 按钮**：
    - 在 `apps/web/features/dashboard/spidey-welcome-storyboard.tsx` 中，彻底移除展开与收起横幅中的「Watch 1-Min Storyboard Tour」与「Watch Tour」播放按钮；
    - 在 `apps/web/features/dashboard.tsx` 问候栏中移除多余的 `Spidey's Guide` 按钮，保持老用户首页与问候栏整洁纯粹。
  - **严格限定仅对新用户展示（现有用户完全不展示）**：
    - 在 `StudentDashboard` 中增加学习活动判定 `hasStudyActivity`（检查各科目专题是否存在 `memoryScore !== null`、测验记录 `quizAttempts > 0` 或复习时间 `lastReviewedAt !== null`）；
    - 若学生为已有学习活动的老用户，或已标记完成/忽略导览，则 `isNewUser = false`：
      - 首页指引横幅 `<SpideyHomepageGuideBanner>` 完全不渲染；
      - 1x 故事板弹窗 `<SpideyWelcomeStoryboardModal>` 完全不弹出；
    - 仅对 0 学习记录且未曾浏览过的新用户弹出与显示，并在完成或关闭时记录状态。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错；
    - 后端 `npm --prefix apps/api test` 全量通过（333 测试用例全部通过）。
- **为什么**：满足用户关于去除「Watch video」按钮、并将新用户导览严格限制为仅新用户可见（现有用户不展现）的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**为新用户新增首页 Spidey 欢迎故事板导览（1x Storyboard）与醒目四步指引横幅**

- **做了什么**：
  - **新用户 1x 故事板弹窗导览（`SpideyWelcomeStoryboardModal`）**：
    - 在 `apps/web/features/dashboard/spidey-welcome-storyboard.tsx` 中实现交互式多步骤导览：
      1. **欢迎介绍**：Spidey 自我介绍与 EduNets 学习机制；
      2. **从 Smart Quiz 开始测试**：支持按科目、专题甚至细分微专题（sub-topics）展开测验，支持客观题（MCQ）与主观题（Essay）；
      3. **在 Concept Web 查看记忆分数（Memory Score）**：0~100% 动态掌握度与知识网络可视化；
      4. **至关重要的复习日期（Next Review Date）提醒**：郑重警告遗忘曲线与记忆衰减，提醒在下一次复习日期前复习，防止 Memory Score 下降；
      5. **在 Revision Hub 复习错题与快速复习**：粘贴测验 Recap 获取 Spidey 重点指导，并可一键生成核心考点笔记与抽认卡（Flashcards）；
    - 采用 Framer Motion `AnimatePresence` 平滑换页动画、步骤胶囊索引、跳步点、以及多动作快捷按钮；
    - 使用 `localStorage.getItem('edunets_storyboard_seen_v1')` 仅在新用户首次访问时自动弹出，支持勾选「不再开机显示」并随时重新播放。
  - **首页显眼醒目的指引卡片横幅（`SpideyHomepageGuideBanner`）**：
    - 在 `apps/web/features/dashboard.tsx` 顶部问候卡片下方常驻展示醒目的四步图解学习指引横幅，包含动效 Spidey 头像、4 个快捷跳转卡片（Smart Quiz、Concept Web、Next Review Date 衰减警示、Revision Hub）以及「Watch 1-Min Storyboard Tour」回放按钮；
    - 在问候栏顶部增加 `Spidey's Guide` 胶囊入口，随时可一键呼出导览故事板。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错；
    - 后端 `npm --prefix apps/api test` 全量通过。
- **为什么**：满足用户关于新用户首次进入首页时，由 Spidey 介绍 EduNets、指导从测验（含 sub topics）开始、查看 Concept Web 记忆分、强调 Next Review Date 防止记忆分衰减、以及在 Revision Hub 复习错题或快速复习的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**重命名 Recap 为 Spidey's Quiz Recap、去除 Recap 卡片内冗余 Revision Hub 按钮与底部横幅，并移除测验结束页 Recap 弹窗按钮**

- **做了什么**：
  - **去除 Recap 卡片内 Revision Hub 按钮与底部横幅**：
    - 在 `apps/web/components/quiz-recap-card.tsx` 中，依用户第一张图要求移除卡片底部的「Copy and paste to revise on Revision Hub」渐变横幅与 `Revision Hub ->` 按钮；
    - 依用户第二张图要求，移除 Recap 顶部标题栏右侧的 `Revision Hub ->` 按钮；
    - 侧边栏主面板保留唯一的 Revision Hub 导航入口，界面更清爽聚焦。
  - **重命名总结卡片标题为 Spidey's Quiz Recap**：
    - 将 `apps/web/components/quiz-recap-card.tsx` 与 `apps/web/components/quiz-recap-dialog.tsx` 的标题由 `Spidey AI Quiz Recap` 更新为 `Spidey's Quiz Recap`；
    - 副标题同步更新为更简练的“Overall recap summary of what to revise”。
  - **移除 Recap 弹窗按钮与多余弹窗**：
    - 在 `apps/web/features/quiz.tsx` 中，分别从 `EssayResultsPanel` 与 `ResultsPanel` 移除侧边栏的「View Recap Popup」黄色线框按钮；
    - 移除不再需要的 `QuizRecapDialog` 与自动弹窗状态，测验结果页直接自然展示顶部的题目回顾及下方的 Spidey's Quiz Recap。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错；
    - 后端 `npm --prefix apps/api test` 全量通过。
- **为什么**：满足用户关于去除 Recap 底部横幅与顶部 Revision Hub 按钮、将 Recap 标题命名为 Spidey's Quiz Recap、并移除测验结束页 Recap 弹窗按钮的要求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**Smart Quiz 结束页将题目回顾置于总结卡片上方，并在 Focus Guidance 中合并 1 条实用技巧与共情激励语，呈现 3~10 条全局重点反馈**

- **做了什么**：
  - **Smart Quiz 结束页布局调整**：
    - 在 `apps/web/features/quiz.tsx` 中，将 MCQ 模式 `ResultsPanel` 与主观题模式 `EssayResultsPanel` 的题目回顾区域（`Review`、题号指示 `Question X of Y`、题号气泡索引 `Q1..Q10`、题目详情卡片及上/下一题切换按钮）移动至 `<QuizRecapCard>` 上方；
    - 学生完成测验后，最上方首先呈现题目选项回顾与复习面板，下方承接测验分析总结卡片。
  - **Focus Guidance 去除定向分块反馈，转为 3~10 条全局重点反馈清单**：
    - 去除原先单题针对性卡片与优先级（Priority）分类标签；
    - 生成并展示涵盖考点的 3 至 10 条（min 3, max 10）全局重点反馈清单；
    - 保留序号索引、清晰建议描述以及「Mark as done / Understood!」打勾标记与进度追踪条。
  - **Spidey 激励语与实用技巧合二为一**：
    - 在 Spidey 顶部横幅中，将共情激励语与 1 条核心记忆技巧（`Spidey's Quick Tip`）深度结合；
    - 针对 0 分或低分自适应展现温暖引导语（“Don't worry, learning takes time! Everyone starts somewhere, and mistakes are simply how we learn.”）；
    - 在 `apps/api/src/services/quiz-recap.ts` 与 `apps/web/lib/api/capture.ts` 中同步拓展 `quickTip` 与 `feedbacks` 字段支持。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错；
    - 后端 `npm --prefix apps/api test` 全量测试通过。
- **为什么**：满足用户关于 Smart Quiz 结束页将题目回顾置于 Recap 卡片上方、Focus Guidance 无需 targeted feedback 而是提供 3~10 条总体反馈、以及将 1 条 Quick Tip 与共情支持语合并的要求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**移除 Add to Notes 按钮、去除 Focus Guidance 优先级标签并重构结构化反馈，以及根据测验成绩自适应 Spidey 鼓励语（0 分关怀式引导）**

- **做了什么**：
  - **彻底移除「Add to Notes」按钮**：
    - 从 `apps/web/features/capture-hub.tsx` 的 Typed Notes 区域彻底移除「Add to Notes」按钮，并将 textarea 输入即时双向同步至 `extractedContent`；
    - 学生在粘贴测验回顾或输入笔记后直接点击「Get focus guidance」，省去冗余添加步骤，界面更纯净。
  - **Focus Guidance 移除优先级提及并重构清晰结构**：
    - 依用户要求彻底去除了「Focus on this first / High Priority / Medium Priority」等优先级徽章与文本，不再提及 Priority；
    - 将反馈统一重构为规整有序的两层结构：
      1. **序号与考点标题**（如 `1. Linear Graphs`）；
      2. **How to improve**：短小清晰、适合中学生的具体提升建议；
      3. **Quick Tip**：易记的做题技巧或公式提醒；
    - 保留「Mark as done / Understood!」打勾标记与进度追踪条。
  - **Spidey 鼓励语自适应测验成绩（0 分低分温暖关怀）**：
    - 针对测验得 0 分或低分场景，彻底杜绝出现违和的「Good job」或「Awesome effort」；
    - 在后端 `apps/api/src/services/quiz-recap.ts` 与前端 `apps/web/features/capture/quiz-revision-guidance.tsx` 增加成绩自适应评级：
      - 得 0 分或低分（<=35%）：替换为温和且极具共情力的关怀引导语：“Don't worry, learning takes time! Everyone starts somewhere, and mistakes are simply how we learn. Here are clear tips on what to focus on:”，鼓励语调整为循序渐进的“Take it step by step! Review these tips, practice, and you'll definitely see improvement on your next quiz.”；
      - 中等分数（40%-75%）：给出进阶鼓励（“You're on the right track! A few tricky spots tripped you up... ”）；
      - 高分（>=80%）：给出冲刺满分建议（“Great work on your quiz! Here are quick tips to polish up to full marks”）。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过；
    - 后端 `npm --prefix apps/api test` 全量 46 个测试套件（333 个用例全部通过，包含新增的 0 分关怀鼓励语测试）。
- **为什么**：满足用户移除「Add to Notes」按钮、在 Focus Guidance 中移除优先级标签并重构结构化反馈、以及在学生得 0 分时以“Don't worry, learning takes time...”给予温暖鼓励的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**精简 Focus Guidance 为简短易懂的复习与改进提示，并支持 Smart Quiz 与各功能间页面切换进度持久化**

- **做了什么**：
  - **Focus Guidance 轻量化与易读性优化**：
    - **API 提示词与响应模型适配**：在 `apps/api/src/services/quiz-recap.ts` 与 `apps/web/lib/api/capture.ts` 中新增短小精悍的 `howToImprove`（1-2 句通俗易懂的提分与改进要点）与 `tip`（1 句好记的记忆口诀或规则技巧），并简化兜底解析；
    - **卡片展示界面精炼**：重构 `apps/web/features/capture/quiz-revision-guidance.tsx`，彻底移除原先冗长的大段题目错因解析（"How to look at this concept"），专一呈现三大关键要点：
      1. 🎯 **What to focus on**：考点名称与优先级徽章（Focus on this first / Medium Priority / Good Progress）；
      2. 🚀 **How to improve**：短小清晰、适合中学生的具体提升建议；
      3. 💡 **Quick Tip**：好记的记忆技巧与做题口诀；
    - 语言更轻快，卡片视觉更紧凑，保留已复习（Understood!）一键打勾与进度条。
  - **跨功能切换进度保存（Smart Quiz & Multi-Feature Progress Retention）**：
    - **Smart Quiz 进度保留**：在 `apps/web/features/quiz.tsx` 中引入 `sessionStorage` 状态持久化机制。
      - 当学生在测验过程中切换至 Revision Hub、Study Squad 或其它功能时，当前题号 `index`、已选/草稿答案 `answerDrafts`、输入草稿 `answerText`、题目数据集 `session`、模式与学科考点均自动保存；
      - 当学生切回 Smart Quiz 时自动恢复答题状态，不丢失进度；
      - 仅在学生明确点击「Abandon」（放弃）、「Retake」（重新开始）、「Complete Corrections」（完成订正）或关闭浏览器标签页时才重置；
      - 优化查询参数监听，避免带参返回时误触发重开测验覆盖已答进度。
    - **Revision Hub 进度保留**：在 `apps/web/features/capture-hub.tsx` 中引入 `sessionStorage` 状态持久化机制。
      - 保存学生的粘贴/输入笔记、Focus Guidance 分析结果、Quiz Recap 错题数据、评估建议及选中的科目考点；
      - 切换至 Smart Quiz 或其它页面再返回 Revision Hub 时，笔记与指导数据依然完整保留；
      - 仅在学生主动点击「Clear」或关闭浏览器标签页时清空。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过；
    - 后端 `npm --prefix apps/api test` 全量 46 个测试套件（332 个用例）全部通过。
- **为什么**：满足用户对 Focus Guidance 仅展示简短易懂的复习重点、改进方法与技巧的要求，同时彻底解决在 Smart Quiz 与 Revision Hub 等功能间切换时作答进度与笔记反馈被重置丢失的问题。
- **影响面**：无破坏性变更。

---

## 2026-09-26 · uncommitted · Auto

**修复测验总结弹窗（Quiz Recap Popup）：直接从测验答题结果中实时提取所有错题与错因，杜绝“无数据”空状态**

- **做了什么**：
  - **即时错题提取器（`extractRecapFromSession`）**：
    - 在 [quiz.ts](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/lib/api/quiz.ts) 中实现并导出了客户端纯函数 `extractRecapFromSession`，直接根据 `AssessmentSessionResponse` 中的答题数据（`session.questions` 和 `session.answers`）分析出学生答错的每一道题：
      - MCQ 模式：自动过滤出 `isCorrect === false` 的题目，提取学生所选选项（选项字母与文本内容）、正确选项、题目所属概念与知识点（subtopic / concept）、具体错因分析，以及基于解析的重点提示（`takeNoteOf`）；
      - Essay 模式：自动过滤出未获满分的题目（`marksObtained < maximumMarks`），提取失分部位、阅卷反馈建议以及核心作答要点；
      - 自动组装标准 Spidey 总结话术：`"You scored X/Y. You mistakenly answered questions regarding [topics]."`；
      - 生成一键复制用的完整复习文本与 Revision Hub 积极引导参数。
  - **弹窗与卡片双重容灾联动**：
    - 更新 [quiz-recap-dialog.tsx](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/components/quiz-recap-dialog.tsx) 与 [quiz-recap-card.tsx](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/components/quiz-recap-card.tsx)，接收 `session` 参数并在无远端 recap 数据时自动执行 `extractRecapFromSession(session)`；
    - 彻底消除了原先出现 `"No recap data is available for this assessment session."` 的空白等待状态，测验一结束弹窗立即展示完整的错题分析与复习指导；
    - 在 [quiz.tsx](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/web/features/quiz.tsx) 的 `ResultsPanel` 与 `EssayResultsPanel` 中将 `session` 传递给弹窗与卡片。
  - **后端查询容错增强**：
    - 在 [assessment-quiz.ts](file:///c:/Users/beatrice/OneDrive/Documents/GitHub/Edunet/apps/api/src/services/assessment-quiz.ts) 中使 `generateAndSaveAttemptRecap` 支持同时匹配 `submissionId` 与 `id`，防止由于主键与提交标识不匹配导致的 404 错误。
  - **质量验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过；
    - 后端 `npm --prefix apps/api test` 全量 46 个套件 332 个单元与集成测试全部通过。
- **为什么**：解决用户在完成测验后，Recap 弹窗显示“No recap data is available for this assessment session”的问题，确保弹窗无论在任何网络或接口状态下，都能 100% 可靠地实时提取并展示学生答错的所有题目与核心注意点。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**测验结束自动弹出错题 Recap 弹窗图层（Quiz Recap Dialog），支持一键复制与直达 Revision Hub**

- **做了什么**：
  - **测验结束弹窗图层（Popup Layer）**：
    - 新增 `apps/web/components/quiz-recap-dialog.tsx` 独立弹窗组件：
      - 当学生完成测验到达结果页时，自动弹出浮层展示 Spidey 的错题表现点评与失分题目清单；
      - 结构化显示学生答错的每一题、具体错因/误区以及“📌 Take note: What to take note of”；
      - 弹窗顶部设有 **"Copy Recap Summary"** 复制按钮，一键将整理好的错题总结直接复制到剪贴板；
      - 弹窗底部提供 **"Revise at Revision Hub"** 快捷按钮（点击自动复制总结到剪贴板、写入 sessionStorage 并跳转至 Revision Hub 打字笔记区）；
      - 提供 **"Review Questions"** 按钮，便于学生随时关闭弹窗查看原题答题卡。
  - **在 MCQ 与 Essay 结算页联动**：
    - 在 `apps/web/features/quiz.tsx` 的 `ResultsPanel`（MCQ）与 `EssayResultsPanel`（Essay）中集成 `QuizRecapDialog`；
    - 侧边栏新增 **"View Recap Popup"** 按钮，允许学生在关闭弹窗后随时再次唤起弹窗复查总结。
  - **全量测试与验证**：
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过；
    - 后端 `npm --prefix apps/api test` 全量 46 个测试套件（332 个用例全部通过）。
- **为什么**：满足用户需求：在测验结束时添加弹窗图层（pop up layer），展示学生答错题目的 Recap 总结，便于学生一键复制并直接带到 Revision Hub（Capture Hub）复习改进。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**测验错题全局可复制 Recap 总结、移除逐题解释、替换完成订正按钮为 Revision Hub 及打字笔记积极重点指引**

- **做了什么**：
  - **移除逐题解释与生成整体错题 Recap**：
    - 在 `apps/web/features/quiz.tsx` 的 `McqReviewCard` 中移除了每题的“Reveal explanation / 展开解释”折叠与逐题解释文案；在 `EssayPartReview` 中移除了逐题的 `part.explanation`；
    - 在 `apps/web/components/quiz-recap-card.tsx` 中移除逐题明细卡片（`RecapItemCard`），改为**整体错题总结（Overall Recap Summary）**：直观汇总整套测验失分的知识点、错因剖析与核心注意点（Take note of）；
    - 新增 **"Copy Recap Summary"**（复制总结）一键复制按钮与反馈提示，方便学生随时复制到剪贴板。
  - **侧边栏按钮调整**：
    - 移除 MCQ 与 Essay 结算侧边栏的 `Complete corrections`（完成订正）按钮；
    - 新增文案提示：`"Copy and paste to revise on Revision Hub"`；
    - 替换为主操作按钮 **"Revision Hub"**，点击自动携带当前科目与课题导航至 Revision Hub。
  - **Revision Hub 打字笔记专属积极重点指引（Focus Guidance）**：
    - 在 `apps/api/src/services/quiz-recap.ts` 中新增 `generateFocusGuidance`，并在 `apps/api/src/routes/api-v1.ts` 暴露 `POST /api/v1/me/capture/focus-guidance` 接口；
    - 当学生在 Revision Hub 的打字笔记区粘贴错题总结或点击 **"Get focus guidance"** 时，Spidey 以非常**积极、鼓舞人心**的语气进行点评，肯定学生的付出与复习意识；
    - 智能分析并按优先级明确告诉学生**需要优先主攻哪个知识点**（`Focus On This First` / `Medium Priority`），对错处进行积极正向的剖析，并提供核心规则与记忆口诀（Memory Tip）；
    - 提供交互式复习打勾清单与 **"Back to Smart Quiz to Re-test"** 快速重测通道；
    - 彻底区分了拍照上传笔记的教材引用大纲评测与打字错题复习的积极重点指引。
  - **全量测试与验证**：
    - `apps/api/tests/quiz-recap.test.ts` 包含生成正向重点指引单元测试，全部 3 个测试用例通过；
    - 后端 46 个测试套件全量通过；
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过。
- **为什么**：满足用户需求：不再需要逐题解释，而是为错题生成整体的、可一键复制的 Recap 总结；移除 Complete corrections 按钮并添加 `"copy and paste to revise on Revision Hub"` 提示与 Revision Hub 按钮；在 Revision Hub 粘贴后获取积极正向、聚焦攻克重难点的反馈指导。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**测验结算 Recap 一键前往 Revision Hub 复习与打字笔记专用简明指引（Take Note Of）**

- **做了什么**：
  - **测验 Recap 格式优化**：
    - 在 `apps/api/src/services/quiz-recap.ts` 中根据用户要求规范 Spidey 总结发言格式为：“You scored X/Y. You mistakenly answered questions regarding [所有失分考点]”（若满分则为满分鼓励与核心要点）；
    - 结构化返回 `takeNoteOf`（学生需要注意的事项列表）、`wrongConcepts`、`guidance` 及可以直接带入打字笔记的 Markdown 内容 `typedNotesText`。
  - **一键导入 Revision Hub 打字笔记区**：
    - 在测验结算页 `apps/web/components/quiz-recap-card.tsx` 中新增 **"Revise at Revision Hub"（前往复习中心）** 按钮；
    - 点击后自动将结构化 Recap 存入 `sessionStorage`，并导航至 `/capture-hub?subject=...&topic=...&recap=true`；
    - 在 `apps/web/features/capture-hub.tsx` 中自动识别测验 Recap，预填充到打字笔记（Typed Notes）区域，并自动选中对应的科目与课题，同时展示 `Quiz Recap Loaded` 状态徽章与快捷操作按钮。
  - **打字笔记专属简明指引（区别于拍照上传讲义评估）**：
    - 新增 `apps/web/features/capture/quiz-revision-guidance.tsx` 独立组件：
      - 呈现 Spidey 的总结与针对本次错题的简明指引（"What you need to take note of"）；
      - 提供可交互勾选的复习清单（"Mark as noted" / "Noted"）；
      - 底部提供 **"Back to Smart Quiz to Re-test"** 按钮，方便学生在牢记注意事项后立刻回测验重测。
    - 在 `apps/web/features/capture-hub.tsx` 的评估弹窗中，当检测到是测验带入的打字笔记时，主按钮切换为 **"Get guidance on what to take note of"**，弹窗内展示简明针对性复习指引，而非针对拍照讲义的大纲引用评分。
  - **全量测试与类型检查验证**：
    - `npm --prefix apps/web run typecheck` 0 报错通过；
    - `npm --prefix apps/api test` 全量 46 个测试套件（331 个测试用例全部通过）。
- **为什么**：满足用户需求：无论 MCQ 还是 Essay，测验结束时 Spidey 都给出清晰的表现总结（如得分及失分知识点），并提供按钮一键将总结带入 Revision Hub 的打字笔记部分获取改进指引；该指引区别于手写笔记评估，专为错题要点提供简明清晰的注意事项指导。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**集成 Gemini API 为学生每次完成测验（MCQ 与 Essay）生成智能智能 Recap 总结**

- **做了什么**：
  - **后端智能 Recap 服务与生成逻辑**：
    - 新增 `apps/api/src/services/quiz-recap.ts`，集成 Gemini API 对学生完成的测验生成定制化总结；
    - **MCQ 模式**：精准针对学生回答错误的题目，详细分析学生「错在哪里」（所选干扰项的认知陷阱或概念混淆），并给出针对性的科学概念订正与记忆法则；若满分则表扬并提炼核心概念；
    - **Essay 问答模式**：深入剖析失分题目中的「具体误区（Misconception）」或回答欠缺之处（如混淆概念、遗漏得分关键术语、未满足标准答案得分点），并给出符合大纲规范的标准解答与修正技巧；
    - 配备健壮的离线/备用解析回退机制，确保在任何网络环境下均稳定返回高质量结构化总结。
  - **测验完成时自动生成与存储**：
    - 在 `apps/api/src/services/assessment-quiz.ts` 中的 `finishAssessmentSession` 完成流程中，测验提交后自动触发 `generateAndSaveAttemptRecap` 生成 Recap 并存入 `quizAttempts.calculationTrace` 中；
    - `loadAssessmentSession` 自动附加 `recap` 返回给前端；
    - 在 `apps/api/src/routes/api-v1.ts` 中新增 `GET` 及 `POST /api/v1/me/quiz-attempts/:submissionId/recap` 端点供前端独立读取或按需重试。
  - **前端交互呈现与组件**：
    - 新增 `apps/web/components/quiz-recap-card.tsx` 吉祥物 Spidey AI 总结卡片：
      - 显示 Spidey 对整套测验的点评，附带 Gemini 标识与表现徽章；
      - **MCQ 错题复盘**：清晰列出选择答案与标准答案比对、错因剖析与核心订正，并提供「Review QX」快速跳转按钮，直达对应的题目详情；
      - **Essay 误区剖析**：分题呈现误区诊断、失分原因与满分答题示范，支持一键定位题目；
      - 底部提供 Spidey 提炼的关键要点（Key Takeaways）与下一步行动建议；
    - 在 `apps/web/features/quiz.tsx` 的 `ResultsPanel`（MCQ 结果页）与 `EssayResultsPanel`（Essay 结果页）中同时嵌入 `QuizRecapCard`，支持实时加载状态和即时题号联动。
  - **全量测试与验证**：
    - 新增 `apps/api/tests/quiz-recap.test.ts`，全量 46 个后端测试套件（331 个用例）全部通过（包含真实 Gemini API 调用）；
    - 前端 `npm --prefix apps/web run typecheck` 0 报错通过。
- **为什么**：满足用户需求：学生每次完成测验（MCQ 和 Essay）时，调用 Gemini API 给出 Recap；MCQ 指出学生错在哪里，Essay 指出误区或回答错误之处。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**将侧边栏收起/展开按钮样式改为扁平小矩形并居中移至侧边栏中段**

- **做了什么**：
  - 在 `apps/web/components/app-sidebar.tsx` 中，将侧边栏边缘收起/展开触发器从顶部的圆形按钮（`top-5`、`rounded-full`、`h-8 w-8`）修改为侧边栏垂直中段位置（`top-1/2 -translate-y-1/2`）的小扁平矩形（`h-10 w-5`、`rounded-md`、`border border-sidebar-border bg-card`、`shadow-sm`）；
  - 内部保留清晰的方向箭头（展开时显示向左箭头 `ChevronLeft`，收起时显示向右箭头 `ChevronRight`），带平滑旋转与缩放交互；
  - 运行 `npm --prefix apps/web run typecheck` 验证通过（0 报错）。
- **为什么**：根据用户设计要求，将侧边栏关闭按钮移至中段，并由圆球造型改为精巧扁平的矩形箭头手柄。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**修复点击 Back to Smart Quiz 跳转 404 问题并支持双路由兼容**

- **做了什么**：
  - 将 `apps/web/features/capture-hub.tsx` 中的跳转路由由未注册的 `/smart-quiz` 修正为系统的真实 Smart Quiz 路由 `/quiz`（支持携带 `?subject=...&topic=...` 参数）；
  - 新增 `apps/web/app/(app)/smart-quiz/page.tsx` 路由别名直连 `QuizPage`，使得无论通过 `/quiz` 还是 `/smart-quiz` 访问均能 100% 正确加载 Smart Quiz 界面，彻底杜绝 404；
  - 经自动化网络探测验证 `http://localhost:3000/quiz` 和 `http://localhost:3000/smart-quiz` 均返回 HTTP 200，TypeScript 检查 0 报错。
- **为什么**：此前导航硬编码了 `/smart-quiz`，而系统原注册路由为 `/quiz`，导致学生点击跳转后命中 Next.js「404 Page Not Found」错误。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**Revision Hub 移除复选框与底部按钮，并在反馈后由 Spidey 建议学生前往 Smart Quiz 检验记忆**

- **做了什么**：
  - **移除复选框与底部按钮**：从 `apps/web/features/capture-hub.tsx` 中彻底移除「Generate Quiz」和「Summarise into Key Points」两个卡片复选框，以及底部的处理按钮（「Generate Quiz & Summarise」）；
  - **精简笔记上传表单**：将「Get feedback」提升为表单唯一的原色主操作按钮，在选择科目与添加内容后直接一键发起大纲比对与建议评估；
  - **反馈后 Spidey 推荐与 Smart Quiz 跳转**：
    - 在 `apps/web/features/capture/evaluation-next-steps.tsx` 的反馈弹窗底部加入 Spidey 推荐卡片（Spidey 头像 + 建议气泡），鼓励学生在查看笔记短板后立即检验知识掌握情况；
    - 提供高亮操作按钮「Back to Smart Quiz」，点击后自动携带当前科目与考点参数（`?subject=...&topic=...`）一键直达 Smart Quiz，即时加载对应考题；
    - 在 Revision Hub 页面上方放置完成反馈后的 Spidey 提醒条，方便学生关闭弹窗后随时前往测验。
- **为什么**：满足用户简化 Revision Hub 操作流程（移除冗余复选框与底部按钮），并在反馈后由吉祥物 Spidey 建议学生回到 Smart Quiz 再次测试知识的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**移除 Materials Library 并在 Get feedback 中精准定位学生上传笔记的改进位置**

- **做了什么**：
  - **精准定位笔记改进位置**：
    - 在后端 `apps/api/src/services/note-evaluation.ts` 的评分提示词中，指导考官严格针对学生上传文本摘取原文引用（`quote`），指出错误或不严谨之处并给出具体修改方案（`correction`）；在解析器中将含引用的 `partial` 评价同样收集到 `incorrect`（待改进项）中，保留真实引用；
    - 在前端 `apps/web/features/capture/evaluation-next-steps.tsx` 中新增「Where your notes can be improved」区块，以 blockquote 形式呈现学生笔记中的原句（`"In your notes: ..."`）及具体指导建议（`"How to improve: ..."`）；同时呈现缺失考点（`Key concepts to add to notes`）与准确要点（`What your notes got right`）；
    - 在 `apps/web/features/capture-hub.tsx` 中向 `<EvaluationNextSteps>` 完整传递 `incorrect`、`correct` 和 `missing` 属性。
  - **彻底移除 Materials Library**：
    - 移除 `NotesLibraryLayer` 中的 Materials Library 标签页、`DisplayCards` 堆叠卡片、学科筛选器及保存资料卡片网格，仅保留「Textbook Notes (Provided by EduNets)」课本笔记生成与阅读功能；
    - 顶部导航按钮由「Notes Library」更名为「Textbook Notes」；
    - 移除笔记上传底部的「Save to Materials Library」按钮，替换为即时行动按钮（「Continue to Smart Quiz」/「Summarise into Key Points」/「Generate Quiz & Summarise」/「Process Notes」）；
    - 移除已废弃的 materials library 状态（`materials`、`libraryFilter`、`libraryCards`、`noteMaterial` 及 Read note 弹窗），总结弹窗改由纯净数据驱动；
    - 解决 Next.js 页面与 TypeScript 编译 0 报错，全量 45 个后端测试套件（329 个用例）全部通过。
- **为什么**：满足用户彻底移除 Materials Library，并在反馈（Get feedback）中向学生明确指出其上传的笔记中具体哪句话/哪个位置存在不足以及如何改进的需求。
- **影响面**：Revision Hub 不再渲染 Materials Library 列表，改用即时生成与直接跳转；无破坏性 API 变更。

---

## 2026-09-25 · uncommitted · Auto

**Revision Hub 移除 Evaluation 百分比并更名为 Get feedback**

- **做了什么**：
  - 修改 `apps/web/features/capture/evaluation-next-steps.tsx`：移除百分比（`percentage`）圆环展示与计算，改为鼓励式「Feedback」卡片，保留下一步改进清单与打勾完成进度；
  - 修改 `apps/web/features/capture-hub.tsx`：
    - 将「📊 Evaluate summary against the syllabus」操作按钮替换为「✨ Get feedback」；
    - 将资料库卡片与下拉菜单中的「Evaluation summary」替换为「Get feedback」；
    - 将弹窗标题与说明从分数导向转为「Get feedback」与改进建议提示；
    - 相应更新相关 toast、debug 日志与提示文案中的 evaluation 用词为 feedback。
- **为什么**：满足用户移除评估百分比计算/显示并将 evaluation 统一更名为「Get feedback」的需求。
- **影响面**：无破坏性变更。

## 2026-09-25 · uncommitted · Auto

**导航栏重命名与功能栏顺序调整：Homepage 及六项功能排序**

- **做了什么**：
  - 修改 `apps/web/lib/i18n/dict/nav.ts`：将 `nav.dashboard` 与 `nav.dashboard.short` 显示文案由「Dashboard」更新为「Homepage / 首页」，短标题为「Home / 首页」；
  - 修改 `apps/web/components/app-sidebar.tsx`：重排侧边栏与移动端底栏的功能项顺序为：`homepage` (`/dashboard`) -> `smart quiz` (`/quiz`) -> `concept web` (`/concept-web`) -> `revision hub` (`/capture-hub`) -> `study squad` (`/study-squad`) -> `ask teacher` (`/ask-teacher`)；并将首页图标替换为直观贴切的 `Home` 图标；
  - 修改 `apps/web/components/app-top-bar.tsx`：同步对齐 `TITLE_RULES` 路由映射规则顺序；
  - 修改 `apps/web/features/mascot/global-mascot.tsx`：将吉祥物对主页的提示语更新为「Homepage is your hub」。
- **为什么**：满足用户将 Dashboard 重命名为 Homepage 以及对功能导航栏顺序定制的需求。
- **影响面**：无破坏性变更。

## 2026-09-25 · uncommitted · Auto

**Study Squad 页面紧凑化重构：一屏尽览 Concept Relay 与 Your squad**

- **做了什么**：修改 `apps/web/features/study-squad.tsx`：
  - 精简页面外层与卡片间距（`p-3 sm:p-4 lg:p-5`，`space-y-3.5`）；
  - 压缩「Your squad」卡片头部排版、图标尺寸与内边距，小队信息与同学搜索目录调整为紧凑排版（目录最大高度收敛至 `max-h-36` 并适配小行高紧凑条目）；
  - 将「Group streak」打卡数据与 5 次月度恢复指示条合一并列，精简高度；
  - 紧凑化「Concept Relay」卡片头部与「What to expect」4 步卡片尺寸，使双卡片总高度收敛在约 570px 左右。
- **为什么**：满足用户无需大幅向下滚动即可在同一页面视野中同时看到 Concept Relay 与 Keep your squad learning 的设计需求。
- **影响面**：无破坏性变更。

## 2026-09-25 · uncommitted · Auto

**Study Squad 页面布局重构：合并卡片消除重复并置顶 Your squad**

- **做了什么**：修改 `apps/web/features/study-squad.tsx`：
  - 将「Your squad」卡片移动到页面顶部，卡片头部融合「Keep your squad learning together」标题与描述副文案；卡片内部左侧为小队成员与同校邀请，右侧为「Group streak」连续打卡与 5 次恢复额度；
  - 将原来的第 2 张卡片（CTA 引导卡片）与第 3 张卡片（Concept Relay 概念接力卡片）合并为单一卡片，置于「Your squad」下方；在头部整合「Start Concept Relay」与「Join with code」操作按钮，下方展示「What to expect」4 步玩法，彻底消除视觉与文案重复。
- **为什么**：满足用户对去除冗余重复卡片、提升页面层级与信息紧凑度的设计需求。
- **影响面**：无破坏性变更。

## 2026-09-25 · uncommitted · Auto

**Study Squad 合并 Group Streak 至 Your squad 卡片**

- **做了什么**：修改 `apps/web/features/study-squad.tsx`：
  - 将原「Your real squad」卡片重命名为「Your squad」；
  - 将「小队连续打卡（Group streak）」模块整合至「Your squad」卡片内部，桌面端采用左侧小队成员/同学邀请、右侧连续打卡与 5 次恢复额度双栏并列排版；
  - 顶部「Keep your squad learning together」卡片恢复为独立首屏横幅，仅在此横幅保留「Start Concept Relay」与「Join with code」操作按钮。
- **为什么**：满足用户对小队卡片命名的规范以及将连续打卡与小队信息紧密整合的需求。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**Study Squad 头部排版调整与按钮去重**

- **做了什么**：修改 `apps/web/features/study-squad.tsx`：
  - 将「小队连续打卡（Group streak）」卡片移至头部「Keep your squad learning together」卡片右侧，桌面端采用并列双栏栅格布局（`lg:grid-cols-[1.2fr_0.8fr]`）；
  - 移除了「概念接力（Concept Relay）」玩法介绍卡片中多余重复的「Start Concept Relay」和「Join with code」操作按钮，所有按钮仅保留在「Keep your squad learning together」卡片中；
  - 「你的小队（Your real squad）」卡片独立置于下方区域，保持布局清爽舒展。
- **为什么**：响应用户排版调整需求，将打卡数据收纳进头部并列展示，并消除概念接力按钮在页面上的重复冗余。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**Study Squad 页面精简与结构优化**

- **做了什么**：修改 `apps/web/features/study-squad.tsx`：
  - 保留「概念接力（Concept Relay）」游戏入口与专有玩法介绍卡片（包含画、传、讲、揭晓 4 步玩法一览与开始/加入按钮）；
  - 保留「你的小队（Your real squad）」卡片：支持创建小队、查看成员名单与身份、同校同学检索与发送邀请、以及待处理邀请列表；
  - 保留「小队连续打卡（Group streak）」卡片：清晰展示当前连续天数、今日打卡状态、每月 5 次恢复次数上限进度（5 段指示条与使用统计）及恢复打卡操作；
  - 移除了排行榜（Leaderboard）、记忆回顾总结卡片及故事分享对话框（Memory recap / Wrapped）、薄弱概念救援板块及弹窗（Where your squad struggle / Rescue Nudge）、以及所有通往 Concept Web 和 Revision Room 的跳转入口。
- **为什么**：根据用户需求聚焦 Study Squad 核心互动与协作玩法（概念接力游戏、真实小队组队、以及每月 5 次恢复额度的小队连续打卡），去除多余冗杂模块。
- **影响面**：无破坏性变更。

---

## 2026-09-25 · uncommitted · Auto

**Smart Quiz 页面右侧滚动条全页滚动支持**

- **做了什么**：修改 `apps/web/features/quiz.tsx`：
  - 移除了 Setup 阶段固定视口高度限制（`h-[min(690px,...)]`、`max-h-[calc(100dvh-4.5rem)]`）及外层容器的 `overflow-hidden`，保证配置面板在不同分辨率或缩放时均可顺畅纵向滚动；
  - 移除了答题中（Active Question）主容器的高度锁定与 Essay 结构化题目卡片的 `overflow-y-auto`，消除内嵌局部滚动条，题目和选项按自然高度撑开，交由页面右侧滚动条整体滚动；
  - 答题题号导航（`AvailableQuestionsNav`）与结果页总览侧边栏（Summary rail）桌面端改为 `sticky top-20` 吸顶，整体页面向下滚动时依然保持常驻视口；
  - 结果页（ResultsPanel / EssayResultsPanel）移除双栏内嵌独立滚动条（`edunets-scrollbar lg:overflow-y-auto`），全面统一使用右侧页面滚动条。
- **为什么**：用户需要能够使用页面右侧滚动条统一滚动 Smart Quiz，此前的固定视口高度与内嵌滚动条限制阻碍了整页的顺畅浏览体验。
- **影响面**：无破坏性变更。
- **坑**：吸顶元素需配置 `top-20` 以保证处于 sticky `AppTopBar` 下方，避免互相覆盖。

---

## 2026-09-25 · uncommitted · Auto

**配置 Question Bank 题库环境变量**

- **做了什么**：将外部 Question Bank 数据库连接 `QUESTION_BANK_DATABASE_URL`、Supabase 存储 URL `QUESTION_BANK_SUPABASE_URL`、密钥 `QUESTION_BANK_SUPABASE_KEY` 及题干资源桶 `QUESTION_BANK_QUESTIONS_BUCKET=questions` 写入根目录 `.env.local`。
- **为什么**：Chemistry Smart Assessment 需要直连外部题库项目拉取已审核（APPROVED）真实考题和题干图资源。
- **影响面**：无破坏性变更。未配置或题量不足时会自动回退本地 `quiz_questions` 种子题库。

---

## 2026-09-25 · uncommitted · Auto

**修复前端本地开发请求 404 导致 Account service unavailable 弹窗**

- **做了什么**：
  - 修复 `apps/web/lib/api/client.ts` 中的 `resolveDefaultApiBaseUrl` 兜底逻辑：在浏览器本地环境（`localhost` / `127.0.0.1`）下默认指向 API 端口 `http://localhost:8787`，而非错误的 `window.location.origin`（Next.js 端口 3000）。
  - 创建 `apps/web/.env.local` 配置 `NEXT_PUBLIC_EDUNETS_API_URL=http://localhost:8787`，确保 `cd apps/web && npm run dev` 能够读取环境变量。
  - 在 `scripts/run-web.mjs` 中添加根目录 `.env.local` 加载逻辑，保证经由根目录脚本启动也能透传环境变量。
- **为什么**：当前端未注入 `NEXT_PUBLIC_EDUNETS_API_URL` 且在本地运行在 `:3000` 时，旧代码 `DEFAULT_API_BASE_URL` 会在浏览器端落回 `window.location.origin`（即 `http://localhost:3000`）。所有 `/api/v1/me` 请求都被打给了 Next.js 静态/前端服务返回 404，触发 `AuthFailure` 提示「Account service unavailable EduNets could not complete this request (404)」。
- **影响面**：无破坏性变更。线上生产环境（Vercel）维持走同源 rewrite 规则。

---

## 2026-09-25 · uncommitted · Auto

**修复 API 启动缺失 @supabase/supabase-js 与单测路径失效**

- **做了什么**：
  - 在 `apps/api/package.json` 添加缺失的 `@supabase/supabase-js` 依赖，并执行根目录 `npm install` 补齐安装。
  - 修复 `apps/api/tests/concept-web-layout.test.ts` 与 `apps/api/tests/embeddings.test.ts` 中指向旧移动前路径的相对引用（分别指回 `apps/web/features` 与 `packages/database`）。
  - 修复 `apps/api/tests/database.test.ts` 中编码混乱的 emoji（恢复为 `📐` 与 `⚗️`）。
  - 修复 `apps/api/src/routes/api-v1.ts`、`apps/api/src/lib/external-question-bank.ts` 与 `api/serverless.ts` 中的 eslint 告警与类型标注。
- **为什么**：Study Relay 引入了 `@supabase/supabase-js`，但未在 `apps/api/package.json` 声明且本地未执行 `npm install`，导致 `npm run dev` 启动 API 时报 `ERR_MODULE_NOT_FOUND` 闪退；同时部分单测引用路径过时导致测试失败。
- **影响面**：无破坏性变更。`apps/api` 本地启动与测试 45 个 suite 全部通过。

---

## 2026-09-25 · uncommitted · Auto

**Smart Quiz 答题页去掉多余滚动条**

- **做了什么**：答题／加载态改成锁在 `100dvh − 顶栏`（移动端再减底栏），外层 `overflow-hidden`；去掉题干 `max-h`＋内层 `overflow-y-auto`，内容刚好时不再出滚动条。
- **为什么**：`min-h-screen` 叠在顶栏下会把整页撑出一条无用滚动条。
- **影响面**：无。

---

## 2026-09-25 · uncommitted · Auto

**Smart Quiz session loader 对齐当前答题布局**

- **做了什么**：`QuestionSessionSkeleton` 跟进现卡：宽题干 +50px padding、大选项格、Previous／Next 占位、侧栏／移动端 Available questions 栅格。
- **为什么**：加载态还停在旧窄卡／顶栏 Next，和现界面跳变。
- **影响面**：无。

---

## 2026-09-25 · uncommitted · Auto

**Smart Quiz：短题干居中／长题干两端对齐；任意跳题保留答案；加 Previous**

- **做了什么**：题干按长度／是否有图自适应 `center` vs `start`+`text-justify`；选 MCQ 或离开当前题时静默 `submitAssessmentAnswer`，草稿 + 服务端答案一起标黄；导航条加 Previous，与 Next／Finish 并排。
- **为什么**：用户要短句居中、长文拉开，并能 1→9→10→2 乱序答题且不丢选择。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**侧栏加宽去 Notifications；Smart Assessment 卡加宽且不滚动**

- **做了什么**：展开宽度 256→280；侧栏／底栏去掉 Notifications（顶栏铃铛保留）；setup 白卡加宽到 ~1180px，高度锁在视口内、`overflow-hidden` 防滚动。
- **为什么**：用户要对齐 Quizlet 侧栏体量、去掉通知入口、卡片左右展开。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**侧栏恢复 blob 渐变；折叠钮移到轨缘；Quiz 卡居中**

- **做了什么**：侧栏恢复 `blob-soft` 黄／蓝渐变；折叠钮改到侧栏右缘半露（不再挤在 logo 旁）；Smart Assessment 按顶栏高度居中，保留 `pattern-overlay`。
- **为什么**：用户要保留酷渐变、折叠钮好够、卡片更居中。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**侧栏设计统一：桌面轨 + 移动底栏同一套组件**

- **做了什么**：抽出 `SidebarNavItem`；桌面／移动共用圆角／`sidebar-accent` 激活面／hover／徽章；去掉移动端单独的 `primary` 激活色；保留 layoutId 滑动与折叠动效。
- **为什么**：用户要更专业且两端侧栏视觉一致。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**侧栏：Framer Motion 专业导航动效（保留设计系统）**

- **做了什么**：`layoutId` 活动胶囊在条目间滑动；折叠／展开用 motion 宽度 + logo／文案 AnimatePresence；图标与折叠钮轻微 spring；尊重 `prefers-reduced-motion`。颜色／圆角／路由逻辑不变。
- **为什么**：用户要在现有设计系统上探索更专业的 sidenav 动效。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**Smart Quiz 布局：题号靠右、内容上移、Next 上栏**

- **做了什么**：Available questions 钉在右缘；题干／选项顶对齐；Next 收成标准按钮放进顶栏，方便够到。
- **为什么**：用户标注要右移网格、上移内容、Next 可触达。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**Smart Quiz：Kahoot 题卡 + 自由跳题「Available questions」**

- **做了什么**：顶栏只留 topic／subtopic；题干卡内写「Multiple Choice Question · Question N of M」，尺寸随内容（Kahoot 弹出感）；侧栏改为方形「Available questions」，加载后可点任意题号。
- **为什么**：用户要去重头信息、题卡不留空、自由跳题。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**侧栏 hover 更顺；Concept Web 顶栏去重**

- **做了什么**：侧栏导航加 300ms ease-out 过渡；Concept Web 去掉重复的「Concept Web」徽章，保留科目／小队好友／Weak only 三个控件并收成更紧凑的工具条。
- **为什么**：用户觉得顶栏重复、侧栏 hover 生硬。
- **影响面**：无。

---

## 2026-09-24 · uncommitted · Auto

**Smart Quiz：session shimmer + 题号网格；侧栏去账号卡；setup 卡略缩**

- **做了什么**：开局／「Quiz me on this」／切题用与 QuestionPanel 同构的 YouTube 式 shimmer（含右侧 Grid 占位）；题头加题号徽章；右侧可跳题网格（已答／当前／未解锁）；侧栏去掉账号卡与 My Profile，折叠钮在右上；setup 白卡略缩小避免滚动。
- **为什么**：用户要加载跟布局一致、可跳题、侧栏更干净、选测验不用下滑。
- **影响面**：无。

---
## 2026-09-24 · merge · Auto

**合并 origin/main 进 alex-AI：保留 monorepo 结构**

- **做了什么**：收下 main 的 Capture Hub／Spidey／AppTopBar（streak／通知／头像）；Smart Quiz 与 Study Squad 保留 alex-AI；把误落在仓库根的 app-top-bar／features/capture 挪到 apps/web。
- **为什么**：两边并行开发，合并时以 alex-AI 目录结构为准。
- **影响面**：app-shell、app-sidebar、app-top-bar、capture flashcards、spidey-security。

---

## 2026-09-24 · 工作区未提交 · Spidey 校验修复 + 动机回复

**修复「Request validation failed」；测验求助只给鼓励；偏题礼貌拒绝；短段落**

- **做了什么**：放宽 materials／消息长度校验，前端过滤空字段；测验／学科求助改动机文案且不给答案；偏题礼貌引导；回复拆成短段落。
- **为什么**：空 topic 的旧材料会触发 Zod 400；产品要导航向导而非答题助手。
- **影响面**：`spideyChatSchema`、聊天 UI 载荷、`spidey-chat` 文案与 normalise。

---

## 2026-09-24 · 工作区未提交 · Spidey 推荐顺序 + 顶栏恢复

**起步先推 Smart Quiz／Revision Hub；顶栏放 streak／日期／铃铛／头像**

- **做了什么**：Spidey 起步与下一步回复改为先 Smart Quiz（测知识）再 Revision Hub（复习笔记），芯片同序；恢复 `AppTopBar`（页标题 + streak 胶囊 + 日期 + 通知铃 + 头像），侧栏去掉账号卡与 Notifications／Profile。
- **为什么**：推荐顺序与导航稿对齐；顶栏改动曾被回退。
- **影响面**：`spidey-chat`、`app-top-bar`、`app-shell`、`app-sidebar`、Dashboard streak 胶囊。

---

## 2026-09-24 · 工作区未提交 · Spidey 散文回复 + 可点导航

**取消 bullet；起步／下一步给可点跳转；Spidey／团队只讲短故事**

- **做了什么**：回复改为散文；「Where do I start / How to start / Where next」走固定起步或下一步回复并附 `[[go:/path|Label]]` 芯片（前端渲染为按钮并 navigate）；Spidey／团队背景走短故事且不加芯片；范围仅限 EduNets／团队／Spidey；顺带恢复限流与输入硬化。
- **为什么**：对齐聊天体验与导航引导要求。
- **影响面**：`spidey-chat` 服务与聊天 UI；旧 bullet 渲染路径移除。
- **坑**：导航 path 有白名单，模型胡编的 path 会被丢掉。

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
