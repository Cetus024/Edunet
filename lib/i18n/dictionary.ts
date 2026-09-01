import { commonDict } from './dict/common';
import { navDict } from './dict/nav';

export const dictionary = {
  ...commonDict,
  ...navDict,
};

export type TranslationKey = keyof typeof dictionary;
