import { commonDict } from './dict/common';
import { dashboardDict } from './dict/dashboard';
import { navDict } from './dict/nav';
import { revisionRoomDict } from './dict/revision-room';
import { squadDict } from './dict/squad';
import { squadInviteDict } from './dict/squad-invite';

export const dictionary = {
  ...commonDict,
  ...dashboardDict,
  ...navDict,
  ...revisionRoomDict,
  ...squadDict,
  ...squadInviteDict,
};

export type TranslationKey = keyof typeof dictionary;
