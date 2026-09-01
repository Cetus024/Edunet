import type { Dictionary } from '../types';

/**
 * Sidebar labels double as the mobile bottom-bar labels, where the English
 * strings are truncated to their first word. Chinese has no word breaks, so
 * `nav.*.short` carries a deliberately short form for that bar instead.
 */
export const navDict = {
  'nav.dashboard': { en: 'Dashboard', zh: '学习总览' },
  'nav.dashboard.short': { en: 'Dashboard', zh: '总览' },
  'nav.teacherHome': { en: 'Teacher Home', zh: '教师主页' },
  'nav.teacherHome.short': { en: 'Teacher', zh: '主页' },
  'nav.smartQuiz': { en: 'Smart Quiz', zh: '智能测验' },
  'nav.smartQuiz.short': { en: 'Smart', zh: '测验' },
  'nav.conceptWeb': { en: 'Concept Web', zh: '概念图谱' },
  'nav.conceptWeb.short': { en: 'Concept', zh: '图谱' },
  'nav.askTeacher': { en: 'Ask Teacher', zh: '请教老师' },
  'nav.askTeacher.short': { en: 'Ask', zh: '请教' },
  'nav.messages': { en: 'Messages', zh: '消息' },
  'nav.messages.short': { en: 'Messages', zh: '消息' },
  'nav.captureHub': { en: 'Capture Hub', zh: '随手记' },
  'nav.captureHub.short': { en: 'Capture', zh: '随手记' },
  'nav.studySquad': { en: 'Study Squad', zh: '学习小队' },
  'nav.studySquad.short': { en: 'Study', zh: '小队' },
  'nav.myProfile': { en: 'My Profile', zh: '个人资料' },
  'nav.myProfile.short': { en: 'My', zh: '我的' },

  'sidebar.tagline': {
    en: 'Weave stronger bonds, retain every lesson',
    zh: '编织更紧密的联系，记住每一堂课',
  },
  'sidebar.logOut': { en: 'Log Out', zh: '退出登录' },
  'sidebar.footer.teacher': {
    en: 'Guide O-Level learning with clarity',
    zh: '以清晰的方式引导 O-Level 学习',
  },
  'sidebar.footer.learner': {
    en: 'Built for O-Level momentum',
    zh: '为 O-Level 的学习节奏而生',
  },
  'sidebar.language.label': { en: 'Language', zh: '语言' },
  'sidebar.language.switchTo': { en: 'Switch to {language}', zh: '切换为{language}' },

  'role.teacher': { en: 'Teacher', zh: '老师' },
  'role.student': { en: 'Student', zh: '学生' },
  'role.member': { en: 'EduNets member', zh: 'EduNets 成员' },
} satisfies Dictionary;
