import type { Dictionary } from '../types';

/** Strings shared across more than one feature. Feature-specific copy lives in its own module. */
export const commonDict = {
  'common.save': { en: 'Save', zh: '保存' },
  'common.cancel': { en: 'Cancel', zh: '取消' },
  'common.close': { en: 'Close', zh: '关闭' },
  'common.send': { en: 'Send', zh: '发送' },
  'common.sending': { en: 'Sending…', zh: '发送中…' },
  'common.retry': { en: 'Try again', zh: '重试' },
  'common.loading': { en: 'Loading…', zh: '加载中…' },
  'common.back': { en: 'Back', zh: '返回' },
  'common.next': { en: 'Next', zh: '下一步' },
  'common.done': { en: 'Done', zh: '完成' },
  'common.continue': { en: 'Continue', zh: '继续' },
  'common.copy': { en: 'Copy', zh: '复制' },
  'common.copied': { en: 'Copied', zh: '已复制' },
  'common.search': { en: 'Search', zh: '搜索' },
  'common.edit': { en: 'Edit', zh: '编辑' },
  'common.you': { en: 'You', zh: '你' },
  'common.error': { en: 'Something went wrong', zh: '出了点问题' },
  'common.empty': { en: 'Nothing here yet', zh: '这里还没有内容' },

  // Shared between discussion-room.tsx and revision-room.tsx — both render a
  // CoverageVerdict from lib/discussion-rubric.ts against the same three
  // states.
  'verdict.covered': { en: 'Covered', zh: '已覆盖' },
  'verdict.partial': { en: 'Partly', zh: '部分覆盖' },
  'verdict.missed': { en: 'Not mentioned', zh: '未提及' },

  'subject.biology': { en: 'Biology', zh: '生物' },
  'subject.chemistry': { en: 'Chemistry', zh: '化学' },
  'subject.physics': { en: 'Physics', zh: '物理' },
  'subject.english': { en: 'English', zh: '英文' },
  'subject.history': { en: 'History', zh: '历史' },
  'subject.geography': { en: 'Geography', zh: '地理' },
  'subject.aMath': { en: 'A-Math', zh: '高级数学' },
  'subject.eMath': { en: 'E-Math', zh: '基础数学' },
} satisfies Dictionary;
