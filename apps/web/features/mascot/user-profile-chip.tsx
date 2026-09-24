'use client';

import type { ReactNode } from 'react';
import { format } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import { getInitials } from '@/lib/squad-data';
import { cn } from '@/lib/utils';

type UserProfileChipProps = {
  className?: string;
  /** Optional trailing control (e.g. close). */
  trailing?: ReactNode;
};

export function UserProfileChip({ className, trailing }: UserProfileChipProps) {
  const { data: account } = useCurrentAccount();
  const fullName = account?.user.name?.trim() || 'EduNets learner';
  const roleLabel = isTeachingRole(account?.profile?.role)
    ? 'Teacher'
    : account?.profile?.role
      ? 'Student'
      : 'Learner';
  const todayLabel = format(new Date(), 'd MMM yyyy');
  const initials = getInitials(fullName);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[1.75rem] border border-[#1D3A62]/08 bg-white px-3 py-2.5 shadow-[0_10px_28px_rgba(29,58,98,0.12)]',
        className,
      )}
    >
      <Avatar className="h-11 w-11 border border-white shadow-sm">
        <AvatarImage src={account?.user.image ?? undefined} alt="" />
        <AvatarFallback className="bg-[#1D3A62] text-sm font-bold text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight text-[#17233A]">{fullName}</p>
        <p className="mt-0.5 truncate text-xs text-[#6B7C93]">
          {roleLabel} · {todayLabel}
        </p>
      </div>
      {trailing}
    </div>
  );
}
