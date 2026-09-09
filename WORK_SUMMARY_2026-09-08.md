# EduNets 工作总结 — 去除假数据、白板评分与分享流程

整理时间：2026-09-08（新加坡时间）

本次窗口的主线是**把界面上的写死数据换成真实数据**，并围绕 Study Squad 补上白板评分、双榜排行和真正可用的 Story 分享流程。

## 本次完成

### Capture Hub：移除「Add to Concept Web」

- 从「What would you like to do with this material?」的三选项中删掉整张 Concept Web 卡片，栅格由 `sm:grid-cols-3` 改为 `sm:grid-cols-2`。
- 一并清掉 `addToWeb` state、`features` 数组里的 `'web'` 标记和成功提示里的对应文案，不留死代码。
- 此项已提交在 `1a5fbbb`（与 Azure Foundry 相关改动同一个 commit）。

### Study Squad：Memory Score Recap 改用真实数据

原本卡片上的 `#2`、`18d`、`92%`、`86%` 全是旧 mock 小队（Maya）留下的写死数字。

- 新增 `recap` memo，全部数据来自排行榜同一份 `useStudySquad` 载荷：
  - 小队排名 → 自己在 `rankedMembers` 里的名次
  - Best streak → 队内最长个人连续天数（真实 `streakDays`）
  - Top score → 排名第一者的记忆分数
  - 「your squad remembered X%」→ 有科目分数成员的平均分
  - 三条科目进度 → 全队按科目平均后取前三
  - Top learner → 真正的 `rankedMembers[0]`
- 顺手修掉一个 bug：原本「Top learner」显示的是排行榜上被点选的成员，选中弱项成员时会把对方标成第一名。
- 空数据时不再给出 0% 的假成绩，而是提示先去做一次测验。
- `selectedMember` / `selectedMemberId` 因此变成死代码（展开与高亮另有 state），一并移除。

### Concept Web：「Find your friend」改用真实小队

三处入口原本全部读 `lib/squad-data.ts` 里的假名单（Maya Tan、Ben Lee 等）：

- **好友下拉**：改为真实小队成员并排除自己；加载中显示 `Loading squad…`，没有队友时禁用并显示 `No squad friends yet`。
- **选中好友跳转**：改为扫描该成员真实的 `subjects[].topics[]` 找最低分主题，再走原有的 `?subject=&topic=` 深链。
- **节点上的好友头像**：改为真实的单科主题分数低于 40 分者，按每次载荷建一次索引而非逐节点扫描，弱者排前。
- 由于两侧不共享 topic id，匹配采用 `normalizeTopic` 归一化后的名称。

### 清理 `lib/squad-data.ts`

- 上述改动后，mock 数组与其访问函数在全仓库（含测试、文档、seed）已无任何引用，删除约 85 行：`squadMembers`、`squadMemberTopicScores`、`weakTopics`、`getSquadMember`、`getWeakTopicsForMember`、`getWeakestTopicForMember`、`getStrugglingFriendsForTopic`。
- 保留仍在使用的类型与 `getInitials`、`normalizeTopic`、`getAvatarClass`。

### Instagram Story 分享：生成真实图片

- 新增 `lib/recap-story-image.ts`：用 canvas 直接绘制 **1080×1920** PNG。
  - 不走 DOM 截图：主题用的是 `oklch()` 色值，html2canvas 无法解析；且屏幕上的卡片只有 330px 宽。
  - 文件内自带主题色的 hex 副本，并等待 `document.fonts.ready` 以免导出时字体回退。
- `shareRecap` 改为 Web Share API（`navigator.canShare` → `navigator.share`）。
  - PNG 在数据就绪时**提前生成**并存入 state：`navigator.share()` 前若有 `await`，iOS 会判定失去用户手势而拒绝分享。
  - 用户取消（`AbortError`）视为正常流程，不报错。
- 说明：Strava 那种一键直达 IG Stories 用的是原生 `instagram-stories://` scheme + Meta App ID，网页无法调用；网页能做到的上限是系统分享面板，比原生多一步。

### 分享预览弹窗

- 「Post in Story」不再直接下载／分享，而是先打开预览弹窗，显示**实际会被发出去的那张 PNG**。
- 四个入口 + 保存到本机：
  - **手机**：四个按钮都调用系统分享面板并附带真实图片文件——这是唯一能把图片交给 Instagram / Snapchat 的路径，具体选哪个 app 由面板决定。
  - **桌面**：浏览器无法把文件塞进这些 app。WhatsApp / Telegram 会打开网页版并把图片复制到剪贴板供粘贴（`window.open` 保持在点击手势内，避免被拦截；剪贴板失败则回退为下载）；Instagram / Snapchat 没有可接收图片的网页端点，直接保存并说明。
- 依据实际渲染结果修了两个排版 bug：Top learner 区块原本溢出 1920px 被裁掉、左下装饰圆形穿插到科目卡片之间；科目卡片改为在剩余空间垂直居中，1～3 张都不会留大片空白。

### 白板评分系统与双榜排行

- **评分**：新增 `scoreWorkAnalysis()`（`lib/learning-work.ts`），由已存储的 `WorkAnalysis` 推导 0–100 分。
  - `consistent` 满分、`uncertain` 半分（分析未能确认 ≠ 学生做错）、`error` 零分；概念冲突每项扣 8 分，上限 32 分。
  - 依 verdict 设上限（`needs_revision` 最高 65），避免模型自相矛盾时给出满分；没有步骤时退回 verdict 分数。
  - 纯推导、无需迁移，且对数据库中既有提交**追溯生效**。
- **连续天数合并**：白板提交与测验一样计入活动日期，在白板上解题的一天不再被忽略；restore 逻辑不变。
- **双榜**：排行榜加入切换。
  - **Studying**：仍是纯 Memory Score，刻意不稀释，名次永远代表理解程度。
  - **Consistency**：`getConsistencyScore()`，连续天数最高 60 分（30 天满）+ 白板提交量最高 40 分（10 次满）；并列时依次比连续天数、记忆分数。
  - 两榜分开，正是为了让刷连续天数无法压过真正掌握内容的人。
- 展开成员时新增白板平均分与提交次数。
- 新增 `services/edunets-api/tests/work-scoring.test.ts`，10 条测试覆盖半分、verdict 上限、扣分封顶与一致性分数目标值。

### 学校名录移除老师

- 在 SQL 层加 `eq(profiles.role, 'student')`，老师**根本不会进入响应**，而不是在界面上隐藏。
- 客户端类型收窄为 `role: 'student'`，status 联合类型去掉 `'teacher'`；界面上删除毕业帽图标与「Ask Teacher」徽章分支。
- 连带调整：标题改为「Find **classmates** at your school」；搜索改为仅匹配姓名（原本也匹配 role，改动后输入 "student" 会返回全校）；去掉每行重复的「Student」小字。
- **Ask Teacher 未受影响**：该页的老师来自另一个端点 `/api/v1/me/question-recipients`，本次完全没有改动，老师仍只从该页可达。

## 验证情况

- `npm run typecheck`（web + API）通过。
- `npx eslint` 对全部改动文件通过。
- `npm run api:test`：**32 个文件 / 237 条测试全部通过**。
- 在本机 dev server 上以真实登录账号验证：
  - `/api/v1/me/study-squad` 与 `/api/v1/me/school-directory` 均返回 200，新查询在真实数据库上可用。
  - 排行榜双榜切换、Recap 卡片真实数值（排名 #1、27%、Top learner 謝詩濤）、分享弹窗内的 PNG 预览均正常渲染，中文姓名显示正常。
  - 学校名录改动后只剩学生（志佐佳宏 · Member），无老师行。

## 本次整理前的 Git 状态

- 分支 `main`，领先 `origin/main` **1 个 commit**（`1a5fbbb`，尚未 push）。
- 以下改动仍在工作区，**未提交**：

```
M features/concept-web/student-view.tsx
M features/study-squad.tsx
M lib/api/study-squads.ts
M lib/learning-work.ts
M lib/squad-data.ts
M services/edunets-api/src/services/study-squads.ts
?? lib/recap-story-image.ts
?? services/edunets-api/tests/work-scoring.test.ts
```

## 已知取舍与后续可做

- `scribbleCount` 是累计值且不衰减，几个月前的 10 次提交会永久贡献 40 分一致性分数。若希望「一致性」指的是**近期**投入，只需给该统计加一个 30 天窗口的 `where` 条件。`CONSISTENCY_STREAK_TARGET` 与 `CONSISTENCY_WORK_TARGET` 已导出为常量，方便调参。
- `lib/recap-story-image.ts` 是手写复刻卡片版式；若之后改动屏幕上的 Recap 卡片，该文件需同步修改（文件头注释已标注）。
- Story 分享的系统面板只能在真机上验证，且生产环境需 HTTPS（localhost 例外）；桌面端只会走下载分支。
- Strava 还会顺带复制一条链接供贴链接贴纸，本次未做——确定好链接指向（例如小队邀请链接）后，加两行 `navigator.clipboard.writeText()` 即可。
- 概念图的好友标记以归一化名称匹配主题；若两侧命名日后出现偏差，标记会静默消失而不会报错，长远可考虑共用 topic id。

## 本机整合与推送说明

- 已将本机代码同步到 GitHub 原有的 12 个新提交，再叠加本次修改；没有强制覆盖远端历史。
- Capture Hub 修复包括：较小的摘要 token 预算、限流与超时诊断、遵守 Azure 重试间隔的有限重试、重复摘要请求复用、失败后重试按钮，以及移除提前宣称摘要成功的提示。
- 新增 GPT-6 Astra 适配：使用 max_completion_tokens、low reasoning、额外 4,096 个 reasoning token 预算；移除该模型不支持的 temperature 参数，并检测截断响应。
- Astra 真实切换尚未完成：现有 Foundry 资源针对 gpt-6-astra 返回 HTTP 404 DeploymentNotFound。本机 .env.local 仍使用能正常工作的 GPT-4.1 mini；.env.example 已提供 Astra 部署配置。Astra 需要先在 Azure 部署，再修改本机和托管环境配置。
- 本次提交包括上文的小队真实数据、白板评分、双排行榜、Story PNG 分享和学生名录筛选，以及对应测试。
- API 密钥、.env.local、.claude 本机配置、.codex-tmp 临时脚本与截图、artifacts 文档均未包含在提交中。
- 上文真机/登录界面的验证记录由此前编辑窗口提供；本次推送前另行执行 TypeScript、API 测试、改动文件 ESLint 和生产构建检查。


## 2026-09-09 GPT-5 mini switch

- Astra deployment was blocked by insufficient Azure quota. GPT-5 mini was deployed successfully on the existing Japan East resource using Global Standard, 100K TPM.
- Updated the Foundry adapter to use low reasoning and max_completion_tokens for GPT-5 mini, including custom deployment names via AZURE_FOUNDRY_MODEL_ID.
- Local .env.local now selects gpt-5-mini; endpoint and API key are unchanged. Secrets remain untracked. Updated .env.example and prepared artifacts/vercel-gpt-5-mini.env.txt for manual Vercel configuration.
- Verification: 14 adapter tests passed; live adapter and actual summarizeNotes calls returned successfully. Vercel still needs the two model variables updated and a redeployment.
