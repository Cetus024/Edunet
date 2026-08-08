const placeholderTable: any = {
  requesterUserId: { notNull: false },
  recipientUserId: { notNull: true },
  requesterClassSnapshot: { notNull: false },
  submissionId: { notNull: true },
  unread: { notNull: true },
  readAt: { notNull: false },
};

export const enquiryMessages = placeholderTable;
export const enquiryThreads = placeholderTable;

export const enquiryRequesterRoleEnum = {
  enumValues: ['student', 'parent'] as const,
};

export const enquiryRecipientRoleEnum = {
  enumValues: ['teacher', 'tutor'] as const,
};

export const enquirySenderRoleEnum = {
  enumValues: ['student', 'parent', 'teacher', 'tutor'] as const,
};
