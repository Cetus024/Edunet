import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import {
  notificationChannelEnum,
  notifications,
  notificationTypeEnum,
} from '../../../../database/schema/notifications.js';
import { ApiError } from '../errors.js';

export type NotificationChannel = typeof notificationChannelEnum.enumValues[number];
export type NotificationType = typeof notificationTypeEnum.enumValues[number];

export type CreateNotificationInput = {
  recipientUserId: string;
  actorUserId?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  resourceId?: string | null;
  dedupeKey: string;
  createdAt?: Date;
};

export function buildNotificationValues(input: CreateNotificationInput) {
  return {
    id: randomUUID(),
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId ?? null,
    channel: input.channel,
    type: input.type,
    title: input.title.slice(0, 160),
    body: input.body,
    href: input.href.slice(0, 500),
    resourceId: input.resourceId ?? null,
    dedupeKey: input.dedupeKey.slice(0, 200),
    readAt: null,
    createdAt: input.createdAt ?? new Date(),
  };
}

export async function listNotifications(userId: string, limit: number) {
  const [rows, unreadRows] = await Promise.all([
    db.select({
      id: notifications.id,
      channel: notifications.channel,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      resourceId: notifications.resourceId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actor: {
        id: users.id,
        name: users.name,
        image: users.image,
      },
    })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorUserId))
      .where(eq(notifications.recipientUserId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit),
    db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt),
      )),
  ]);

  return {
    unreadCount: unreadRows[0]?.count ?? 0,
    notifications: rows.map((row) => ({
      ...row,
      actor: row.actor?.id ? row.actor : null,
    })),
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const readAt = new Date();
  const [updated] = await db.update(notifications).set({ readAt }).where(and(
    eq(notifications.id, notificationId),
    eq(notifications.recipientUserId, userId),
  )).returning({ id: notifications.id });

  if (!updated) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found.');
  return { notificationId: updated.id, readAt };
}

export async function markAllNotificationsRead(userId: string) {
  const readAt = new Date();
  await db.update(notifications).set({ readAt }).where(and(
    eq(notifications.recipientUserId, userId),
    isNull(notifications.readAt),
  ));
  return { readAt };
}
