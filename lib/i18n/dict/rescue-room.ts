import type { Dictionary } from '../types';

export const rescueRoomDict = {
  'rescue.missingLink': { en: 'Missing room link', zh: '缺少房间链接' },
  'rescue.openFromNotifications': {
    en: 'Open a Rescue invitation from Notifications.',
    zh: '请从通知里打开一个救援邀请。',
  },
  'rescue.loadingRoom': { en: 'Loading live room…', zh: '正在加载实时房间…' },
  'rescue.syncing': { en: 'Syncing the quiz and participants.', zh: '正在同步测验和参与者。' },
  'rescue.unavailable': { en: 'Room unavailable', zh: '房间不可用' },
  'rescue.couldNotOpen': { en: 'This room could not be opened.', zh: '这个房间无法打开。' },
  'rescue.joinBeforeAnswering': { en: 'Join before answering', zh: '答题前请先加入' },
  'rescue.chooseAvatar': {
    en: 'Choose your avatar on the Rescue join screen.',
    zh: '请在救援加入页面选择你的头像。',
  },
  'rescue.goToJoinScreen': { en: 'Go to join screen', zh: '前往加入页面' },
  'rescue.tryAgain': { en: 'Try again.', zh: '请重试。' },

  'rescue.complete': { en: 'Rescue complete', zh: '救援完成' },
  'rescue.finalRanks': { en: 'Final ranks', zh: '最终排名' },
  'rescue.savedAsStreak': {
    en: 'The database saved this result as qualifying Group Streak activity.',
    zh: '这次结果已记录为符合条件的小队连续记录活动。',
  },
  'rescue.backToSquad': { en: 'Back to squad', zh: '返回小队' },
  'rescue.resetRoom': { en: 'Reset room', zh: '重置房间' },

  'rescue.round': { en: 'Round {current} of {total}', zh: '第 {current} 轮，共 {total} 轮' },
  'rescue.inviteSquad': { en: 'Invite Squad', zh: '邀请小队' },
  'rescue.exitRoom': { en: 'Exit room', zh: '退出房间' },
  'rescue.syncNote': {
    en: 'Database state refreshes every 2 seconds; presence updates every 10 seconds.',
    zh: '数据库状态每 2 秒刷新一次；在线状态每 10 秒更新一次。',
  },

  'rescue.rank': { en: 'Rank', zh: '排名' },
  'rescue.live': { en: 'Live', zh: '进行中' },
  'rescue.lockYourAnswerHint': {
    en: 'Lock your answer. The room advances together when everyone answers or the timer ends.',
    zh: '锁定你的答案。所有人都作答，或计时结束后，房间会一起进入下一题。',
  },
  'rescue.answerPanel': { en: 'Answer panel', zh: '作答面板' },
  'rescue.lockYourAnswer': { en: 'Lock your answer', zh: '锁定你的答案' },
  'rescue.typeYourAnswer': { en: 'Type your answer', zh: '输入你的答案' },
  'rescue.submit': { en: 'Submit', zh: '提交' },
  'rescue.grading': { en: 'Server is grading…', zh: '服务器正在评分…' },
  'rescue.correctLocked': { en: 'Correct — answer locked', zh: '正确 — 答案已锁定' },
  'rescue.incorrectLocked': { en: 'Incorrect — answer locked', zh: '错误 — 答案已锁定' },

  'rescue.inviteSquadTitle': { en: 'Invite Squad', zh: '邀请小队' },
  'rescue.inviteSquadDescription': {
    en: 'Select members who are not already in this room.',
    zh: '选择尚未在这个房间里的成员。',
  },
  'rescue.everyoneInvited': {
    en: 'Everyone is already invited or participating.',
    zh: '所有人都已经受邀或正在参与了。',
  },
  'rescue.sendInvitations': { en: 'Send invitations', zh: '发送邀请' },

  'rescue.toast.points': { en: '+{points} points', zh: '+{points} 分' },
  'rescue.toast.notQuite': { en: 'Not quite', zh: '还差一点' },
  'rescue.toast.answerNotSubmitted': { en: 'Answer not submitted', zh: '答案未提交成功' },
  'rescue.toast.roomRestarted': { en: 'Room restarted', zh: '房间已重新开始' },
  'rescue.toast.roomNotRestarted': { en: 'Room not restarted', zh: '房间未能重新开始' },
  // Chinese carries no plural form, so the count sits in one sentence rather
  // than a singular/plural pair the way the English string needs.
  'rescue.toast.invited': {
    en: 'Invited {count} squad member{suffix}',
    zh: '已邀请 {count} 位小队成员',
  },
  'rescue.toast.invitationsNotSent': { en: 'Invitations not sent', zh: '邀请未发送成功' },
  'rescue.toast.streakDay': { en: '+1 group streak day', zh: '小队连续记录 +1 天' },
  'rescue.toast.savedAsActivity': {
    en: 'This completed Rescue quiz is saved as squad activity.',
    zh: '这次完成的救援测验已记录为小队活动。',
  },

  // ParticipantList status line, in priority order: finished view, answered,
  // then the raw presence enum (invited/online/away/finished/left — shared
  // with revision.presence.*, same values on the wire).
  'rescue.status.finished': { en: 'Finished', zh: '已完成' },
  'rescue.status.answerLocked': { en: 'Answer locked', zh: '答案已锁定' },
} satisfies Dictionary;
