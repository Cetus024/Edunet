import type { Dictionary } from '../types';

export const squadInviteDict = {
  'squadInvite.checking': { en: 'Checking your squad invitation…', zh: '正在核实你的小队邀请…' },
  'squadInvite.title': { en: 'Study Squad invitation', zh: '学习小队邀请' },
  'squadInvite.unavailable': { en: 'Invitation unavailable', zh: '邀请不可用' },
  'squadInvite.emailOnly': {
    en: 'Only the email address that received the invitation can join.',
    zh: '只有收到邀请的那个邮箱地址才能加入。',
  },
  'squadInvite.incomplete': {
    en: 'This squad invitation link is incomplete.',
    zh: '这个小队邀请链接不完整。',
  },
  'squadInvite.cannotOpen': { en: 'This invitation cannot be opened.', zh: '这个邀请无法打开。' },
  'squadInvite.couldNotJoin': { en: 'Could not join the squad', zh: '无法加入小队' },
  'squadInvite.tryAgain': { en: 'Try the invitation again.', zh: '请重新尝试这个邀请。' },
  'squadInvite.continueWithGoogle': {
    en: 'Continue with the invited Google account',
    zh: '使用受邀的 Google 账号继续',
  },
  'squadInvite.goToEdunets': { en: 'Go to EduNets', zh: '前往 EduNets' },
  'squadInvite.join': { en: 'Join {squad}', zh: '加入 {squad}' },
  'squadInvite.invitedBy': {
    en: '{name} invited you to learn together and help each other with quick rescue sessions.',
    zh: '{name} 邀请你一起学习，用快速救援互相帮助。',
  },
  'squadInvite.signedInAs': { en: 'Signed in as {email}', zh: '已用 {email} 登录' },
  'squadInvite.accept': { en: 'Accept invitation', zh: '接受邀请' },
  'squadInvite.joined': { en: 'You joined {squad}.', zh: '你已加入 {squad}。' },
  'squadInvite.joinedFallback': { en: 'the study squad', zh: '这个学习小队' },
  'squadInvite.googleSignInFailed': {
    en: 'EduNets could not start Google sign-in.',
    zh: 'EduNets 无法启动 Google 登录。',
  },
} satisfies Dictionary;
