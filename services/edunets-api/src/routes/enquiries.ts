import { Hono, type Context } from 'hono';

import { ApiError, readJson } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import {
  createEnquiry,
  getQuestionRecipients,
  listEnquiries,
  loadEnquiryActor,
  markEnquiryRead,
  sendEnquiryMessage,
} from '../services/enquiries.js';
import type { AppEnv } from '../types.js';
import {
  createEnquirySchema,
  enquiryThreadIdSchema,
  questionRecipientsQuerySchema,
  sendEnquiryMessageSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requireUserId(context: Context<AppEnv>): string {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user.id;
}

api.get('/me/question-recipients', loadSession, requireSession, async (context) => {
  const actor = await loadEnquiryActor(requireUserId(context));
  const query = questionRecipientsQuerySchema.parse(context.req.query());
  return context.json(await getQuestionRecipients(actor, query.subjectId));
});

api.get('/me/enquiries', loadSession, requireSession, async (context) => {
  const actor = await loadEnquiryActor(requireUserId(context));
  return context.json({ threads: await listEnquiries(actor) });
});

api.post('/me/enquiries', loadSession, requireSession, async (context) => {
  const actor = await loadEnquiryActor(requireUserId(context));
  const input = createEnquirySchema.parse(await readJson(context));
  const result = await createEnquiry(actor, input);
  return context.json(result, result.idempotentReplay ? 200 : 201);
});

api.post('/me/enquiries/:threadId/messages', loadSession, requireSession, async (context) => {
  const actor = await loadEnquiryActor(requireUserId(context));
  const threadId = enquiryThreadIdSchema.parse(context.req.param('threadId'));
  const input = sendEnquiryMessageSchema.parse(await readJson(context));
  const result = await sendEnquiryMessage(actor, threadId, input);
  return context.json(result, result.idempotentReplay ? 200 : 201);
});

api.put('/me/enquiries/:threadId/read', loadSession, requireSession, async (context) => {
  const actor = await loadEnquiryActor(requireUserId(context));
  const threadId = enquiryThreadIdSchema.parse(context.req.param('threadId'));
  return context.json(await markEnquiryRead(actor, threadId));
});

export { api as enquiriesApi };
