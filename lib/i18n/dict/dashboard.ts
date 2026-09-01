import type { Dictionary } from '../types';

export const dashboardDict = {
  'dashboard.greeting.morning': { en: 'Good morning', zh: '早上好' },
  'dashboard.greeting.afternoon': { en: 'Good afternoon', zh: '下午好' },
  'dashboard.greeting.evening': { en: 'Good evening', zh: '晚上好' },

  'dashboard.pulse': { en: 'EduNets study pulse', zh: 'EduNets 学习脉搏' },
  'dashboard.subtitle': { en: 'Let’s make revision feel lighter.', zh: '让复习变得轻松一些。' },
  'dashboard.memoryHealth': { en: 'Memory Health by Subject', zh: '各科记忆健康度' },
  'dashboard.priorityQueue': { en: 'Today’s Priority Queue', zh: '今日优先复习' },
  'dashboard.priorityQueue.sorted': {
    en: 'Sorted by urgency — most forgotten first',
    zh: '按紧急程度排序 — 遗忘最多的排在前面',
  },
  'dashboard.priorityQueue.empty': {
    en: 'No reviews are due yet. Start any Not Started topic to build your queue.',
    zh: '目前没有到期的复习。开始任何一个未开始的课题，就会生成你的复习队列。',
  },
  'dashboard.streak': { en: 'Your Streak', zh: '连续学习' },

  'dashboard.memoryScore': { en: 'Memory Score', zh: '记忆分数' },
  'dashboard.memoryScoreColon': { en: 'Memory Score:', zh: '记忆分数：' },
  'dashboard.atRisk': { en: 'AT RISK ⚠️', zh: '高风险 ⚠️' },
  'dashboard.needsReview': { en: 'Needs Review', zh: '需要复习' },
  'dashboard.notStarted': { en: 'Not Started', zh: '未开始' },
  'dashboard.reviewNow': { en: 'Review Now', zh: '立即复习' },
  'dashboard.reviewNowArrow': { en: 'Review Now →', zh: '立即复习 →' },
  'dashboard.startTopic': { en: 'Start Topic', zh: '开始学习' },
  'dashboard.startArrow': { en: 'Start →', zh: '开始 →' },

  'dashboard.notStartedCount': {
    en: '{count} topics not started',
    zh: '{count} 个课题未开始',
  },
  'dashboard.couldRecover': {
    en: '{minutes} mins of review could recover this!',
    zh: '{minutes} 分钟的复习就能把它救回来！',
  },
  'dashboard.lastReviewed.none': { en: 'No review date yet', zh: '还没有复习记录' },
  'dashboard.lastReviewed.today': { en: 'Last reviewed today', zh: '今天刚复习过' },
  'dashboard.lastReviewed.yesterday': { en: 'Last reviewed yesterday', zh: '昨天复习过' },
  'dashboard.lastReviewed.days': {
    en: 'Last reviewed {days} days ago',
    zh: '{days} 天前复习过',
  },

  // Mascot insights. Each is one sentence built from live numbers, so the
  // placeholders have to survive translation rather than the sentence being
  // assembled from fragments — Chinese puts the subject and the figure in a
  // different order than English does.
  'dashboard.insight.dropped': {
    en: 'Your {subject} memory score dropped to {score}%. {minutes} mins of review can recover it.',
    zh: '你的{subject}记忆分数降到了 {score}%，{minutes} 分钟的复习就能拉回来。',
  },
  'dashboard.insight.stale': {
    en: 'Your {subject} score is {score}% and hasn’t been reviewed in {days} days. Quick review recommended!',
    zh: '你的{subject}分数是 {score}%，已经 {days} 天没复习了，建议快速过一遍！',
  },
  'dashboard.insight.priority': {
    en: '{topic} in {subject} is at {score}%. A quick {minutes}-min review will strengthen your memory.',
    zh: '{subject}的「{topic}」目前是 {score}%，{minutes} 分钟的快速复习就能加深记忆。',
  },
  'dashboard.insight.firstPath': {
    en: 'Your first learning path is ready. You have started {started} of {total} O-Level topics.',
    zh: '你的第一条学习路径准备好了。{total} 个 O-Level 课题中，你已经开始了 {started} 个。',
  },
  'dashboard.insight.allGood': {
    en: 'All topics are in great shape! Keep up the excellent study habits.',
    zh: '所有课题状态都很好！保持这个学习节奏。',
  },
} satisfies Dictionary;
