'use client';

import { useCurrentAccount } from '@/lib/api/me';

/**
 * Compatibility shape for the existing Squad/Rescue components. The values
 * now come from the authenticated EduNets account, not the Power Apps host.
 */
export const useUser = () => {
  const accountQuery = useCurrentAccount();
  const user = accountQuery.data?.user;

  return {
    ...accountQuery,
    data: user
      ? {
          objectId: user.id,
          userPrincipalName: user.email,
          fullName: user.name,
        }
      : null,
  };
};
