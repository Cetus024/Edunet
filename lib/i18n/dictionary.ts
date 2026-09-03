import { commonDict } from './dict/common';
import { conceptWebLinkDict } from './dict/concept-web-link';
import { dashboardDict } from './dict/dashboard';
import { navDict } from './dict/nav';
import { rescueRoomDict } from './dict/rescue-room';
import { revisionRoomDict } from './dict/revision-room';
import { squadDict } from './dict/squad';
import { squadInviteDict } from './dict/squad-invite';

export const dictionary = {
  ...commonDict,
  ...conceptWebLinkDict,
  ...dashboardDict,
  ...navDict,
  ...rescueRoomDict,
  ...revisionRoomDict,
  ...squadDict,
  ...squadInviteDict,
};

export type TranslationKey = keyof typeof dictionary;
