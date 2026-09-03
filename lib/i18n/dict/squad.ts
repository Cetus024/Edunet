import type { Dictionary } from '../types';

export const squadDict = {
  'squad.title': { en: 'Study Squad', zh: '学习小队' },
  'squad.heading': { en: 'Keep your squad learning together', zh: '让你的小队一起坚持下去' },
  'squad.subheading': {
    en: 'Invite friends, compare memory scores, and send 10-minute rescues before streaks break.',
    zh: '邀请朋友、比较记忆分数，在连续记录中断前发出 10 分钟的救援。',
  },

  'squad.invite.section': { en: 'Invite + referral', zh: '邀请与推荐' },
  'squad.invite.referralCode': { en: 'Referral code', zh: '推荐码' },
  'squad.invite.emailPlaceholder': { en: 'friend@gmail.com', zh: 'friend@gmail.com' },
  'squad.invite.ready': { en: 'Invite ready to send', zh: '邀请已准备好' },
  'squad.invite.codeCopied': { en: 'Referral code copied', zh: '推荐码已复制' },
  'squad.invite.note': {
    en: 'Invite opens a join screen first; sender can enter question 1 now.',
    zh: '邀请会先打开加入页面；发送者现在就可以进入第 1 题。',
  },

  'squad.leaderboard': { en: 'Leaderboard', zh: '排行榜' },
  'squad.top5': { en: 'Top 5', zh: '前 5 名' },
  'squad.you': { en: 'You', zh: '你' },

  'squad.struggles': { en: 'Where your squad struggles', zh: '小队的薄弱环节' },
  'squad.atRisk': { en: 'At risk', zh: '高风险' },
  'squad.rescueSent': { en: 'Rescue sent ⏳', zh: '救援已发出 ⏳' },
  'squad.rescued': { en: 'Rescued! ✓', zh: '已救援！✓' },
  'squad.openRescueRoom': { en: 'Open Rescue Room', zh: '打开救援室' },
  'squad.rescueRoomStarted': { en: 'Rescue room started', zh: '救援室已开启' },

  'squad.groupStreak': { en: 'Group streak', zh: '小队连续记录' },
  'squad.restoreStreak': { en: 'Restore Streak', zh: '恢复连续记录' },
  'squad.streakRestored': { en: 'Streak restored', zh: '连续记录已恢复' },
  'squad.day': { en: 'Day {day}', zh: '第 {day} 天' },
  'squad.oneRescueAway': { en: '1 rescue away from Day {day}', zh: '再一次救援就到第 {day} 天' },
  'squad.protectStreak': {
    en: 'Help your squad protect today’s streak with one tiny, targeted sprint.',
    zh: '用一次小而精准的冲刺，帮小队守住今天的连续记录。',
  },

  'squad.story.ready': { en: 'Story ready', zh: '快拍已就绪' },
  'squad.story.recapReady': { en: 'Story recap ready', zh: '快拍回顾已就绪' },
  'squad.story.title': { en: 'Memory Score Recap', zh: '记忆分数回顾' },
  'squad.story.description': {
    en: 'A vertical, share-ready recap styled like a learning Wrapped card for Instagram Stories.',
    zh: '竖版、可直接分享的回顾卡，做成 Instagram Stories 的学习总结样式。',
  },
  'squad.story.rank': { en: 'Squad rank', zh: '小队排名' },
  'squad.story.bestStreak': { en: 'Best streak', zh: '最长连续' },
  'squad.story.topScore': { en: 'Top score', zh: '最高分' },
  'squad.story.post': { en: 'Post in Story', zh: '发到快拍' },
  'squad.story.wrapped': { en: 'EduNets Wrapped', zh: 'EduNets 年度回顾' },
  'squad.story.thisWeek': { en: 'This week, your squad remembered', zh: '本周，你的小队记住了' },
  'squad.story.topLearner': { en: 'Top learner', zh: '最佳学员' },

  'squad.nudge.send': { en: 'Send Nudge', zh: '发送提醒' },
  'squad.nudge.sendRescue': { en: 'Send Rescue Nudge', zh: '发送救援提醒' },
  'squad.nudge.sent': { en: 'Nudge sent', zh: '提醒已发送' },
  'squad.nudge.failed': {
    en: 'Couldn’t send this nudge. Try again.',
    zh: '这条提醒没发出去，请重试。',
  },
  'squad.nudge.attachRoom': { en: 'Attach rescue room', zh: '附带救援室' },
  'squad.nudge.notePlaceholder': { en: 'Add a quick note...', zh: '写一句留言…' },

  // Preset nudge messages. These are sent to another student, so the text that
  // leaves the sender is the translated one -- not a key resolved on the
  // recipient's side, which would silently rewrite what someone chose to say.
  'squad.preset.reviewTogether': { en: 'Wanna review this together?', zh: '要不要一起复习这个？' },
  'squad.preset.youGotThis': { en: 'You’ve got this — need a hand?', zh: '你可以的——需要搭把手吗？' },
  'squad.preset.teamUp': { en: 'Let’s team up on this one', zh: '这个我们一起搞定' },
} satisfies Dictionary;
