import type { Dictionary } from '../types';

/** Revision Room now uses handwritten solutions, OCR confirmation, and step-by-step feedback.
 * Legacy transcript labels remain for saved voice-session history.
 */
export const revisionRoomDict = {
  'revision.title': { en: 'Revision Room', zh: '复习房间' },
  'revision.chooseTopic': { en: 'Choose a Revision Room topic', zh: '选择一个复习房间的课题' },
  'revision.everyoneJoins': {
    en: 'Everyone joins with their own account and writes on a personal solution board.',
    zh: '每个人用自己的账号加入，在个人白板上手写解题。',
  },
  'revision.createRoomBadge': { en: 'Create multiplayer room', zh: '创建多人房间' },
  'revision.createRoom': { en: 'Create room', zh: '创建房间' },
  'revision.needSquadFirst': { en: 'Create or join a Study Squad first.', zh: '请先创建或加入一个学习小队。' },
  'revision.soloOk': {
    en: 'Your squad has no other members yet. You can create the room now and invite them later.',
    zh: '你的小队目前还没有其他成员。你可以先创建房间，之后再邀请他们。',
  },
  'revision.back': { en: 'Back', zh: '返回' },
  'revision.backToSquad': { en: 'Back to Study Squad', zh: '返回学习小队' },
  'revision.unavailable': { en: 'Room unavailable', zh: '房间不可用' },
  'revision.notCreated': { en: 'Room not created', zh: '房间未创建成功' },
  'revision.tryAgain': { en: 'Try again.', zh: '请重试。' },
  'revision.couldNotLoad': { en: 'This room could not be loaded.', zh: '这个房间无法加载。' },

  'revision.start': { en: 'Start room', zh: '开始房间' },
  'revision.endAndReview': { en: 'End & review', zh: '结束并查看点评' },
  'revision.endSession': { en: 'End session', zh: '结束会话' },
  'revision.waitingInLobby': { en: 'Waiting in the lobby', zh: '在等候室等待中' },
  'revision.inviteInstructions': {
    en: 'Each invited member opens their notification and joins with their own account.',
    zh: '每位被邀请的成员打开自己的通知，用自己的账号加入。',
  },

  'revision.groupExplanation': { en: 'GROUP EXPLANATION', zh: '小组讲解' },
  'revision.speakFromOwnMic': { en: 'Speak from your own microphone', zh: '用你自己的麦克风讲解' },
  'revision.startMyExplanation': { en: 'Start my explanation', zh: '开始我的讲解' },
  'revision.finishAndShare': { en: 'Finish & share', zh: '结束并分享' },
  'revision.micActive': { en: 'Mic active', zh: '麦克风开启中' },
  'revision.micUnavailable': { en: 'Mic meter unavailable', zh: '麦克风音量表不可用' },
  'revision.liveTranscriptHint': {
    en: 'Your live transcript appears here. Other members can record at the same time.',
    zh: '你的实时转录会显示在这里。其他成员可以同时录制。',
  },

  'revision.joinRoom': { en: 'Join room', zh: '加入房间' },
  'revision.hostedBy': { en: 'Hosted by {name}', zh: '由 {name} 主持' },
  'revision.hostedByInline': { en: 'hosted by {name}', zh: '由 {name} 主持' },
  'revision.hostSuffix': { en: ' · Host', zh: ' · 主持人' },
  'revision.inviteUpToFour': {
    en: '{subject} · Invite up to four Study Squad members.',
    zh: '{subject} · 最多可邀请四名学习小队成员。',
  },

  // RevisionRoomPresence — a closed enum on the wire, so it is translated by
  // lookup rather than passed through as free text.
  'revision.presence.invited': { en: 'invited', zh: '已邀请' },
  'revision.presence.online': { en: 'online', zh: '在线' },
  'revision.presence.away': { en: 'away', zh: '离开' },
  'revision.presence.finished': { en: 'finished', zh: '已完成' },
  'revision.presence.left': { en: 'left', zh: '已离开' },

  'revision.groupReview': { en: 'Group review', zh: '小组点评' },
  'revision.whatSquadCovered': { en: 'What your squad covered', zh: '你们小队讲到了什么' },
  'revision.sharedTranscript': { en: 'Shared transcript', zh: '共享转录' },
  'revision.noExplanationsShared': { en: 'No explanations shared yet.', zh: '还没有人分享讲解。' },
  'revision.noSpeechCaptured': { en: 'No speech was captured', zh: '没有录到任何语音' },
  'revision.transcriptNotShared': { en: 'Transcript not shared', zh: '转录未分享' },
  'revision.participants': { en: 'Participants', zh: '参与者' },

  'revision.toast.joined': { en: 'You joined the Revision Room', zh: '你已加入复习房间' },
  'revision.toast.couldNotJoin': { en: 'Could not join', zh: '无法加入' },
  'revision.toast.isLive': { en: 'Revision Room is live', zh: '复习房间已开始' },
  'revision.toast.reviewReady': { en: 'Group review is ready', zh: '小组点评已准备好' },
  'revision.toast.explanationShared': { en: 'Your explanation was shared', zh: '你的讲解已分享' },
  'revision.toast.linkCopied': { en: 'Room link copied', zh: '房间链接已复制' },
} satisfies Dictionary;
