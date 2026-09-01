import { commonDict } from './dict/common';
import { dashboardDict } from './dict/dashboard';
import { navDict } from './dict/nav';

export const dictionary = {
  ...commonDict,
  ...dashboardDict,
  ...navDict,
};

export type TranslationKey = keyof typeof dictionary;
