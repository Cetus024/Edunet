'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, LogIn, Mail, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildAuthPath } from '@/features/auth/auth-navigation';
import { GoogleAuthButton, startGoogleAuth, useOAuthErrorToast } from '@/features/auth/google-auth';
import { getAuthErrorMessage } from '@/lib/api/auth-client';
import { useCurrentAccount } from '@/lib/api/me';
import {
  acceptStudySquadInvitation,
  studySquadQueryKey,
  useStudySquadInvitation,
} from '@/lib/api/study-squads';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { useTranslation } from '@/lib/i18n';

export default function SquadInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');
  const invitationQuery = useStudySquadInvitation(token);
  const accountQuery = useCurrentAccount();
  const [isGooglePending, setIsGooglePending] = useState(false);
  const { t } = useTranslation();
  const invitePath = token ? `/squad-invite?token=${encodeURIComponent(token)}` : '/squad-invite';

  useOAuthErrorToast();

  const acceptMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error(t('squadInvite.incomplete'));
      return acceptStudySquadInvitation(token);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: studySquadQueryKey });
      toast.success(t('squadInvite.joined', { squad: result.squad?.name ?? t('squadInvite.joinedFallback') }));
      navigate('/study-squad', { replace: true });
    },
    onError: (error) => {
      toast.error(t('squadInvite.couldNotJoin'), {
        description: error instanceof Error ? error.message : t('squadInvite.tryAgain'),
      });
    },
  });

  const continueWithGoogle = async () => {
    if (!token) return;
    setIsGooglePending(true);
    try {
      const result = await startGoogleAuth({
        callbackPath: invitePath,
        errorPath: invitePath,
      });
      if (result.error) throw result.error;
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t('squadInvite.googleSignInFailed')));
      setIsGooglePending(false);
    }
  };

  const invitation = invitationQuery.data?.invitation;
  const account = accountQuery.data;
  const isLoading = Boolean(token) && (invitationQuery.isPending || accountQuery.isPending);
  const error = !token
    ? new Error(t('squadInvite.incomplete'))
    : invitationQuery.error ?? accountQuery.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] p-5 text-[var(--edunets-ink)]">
      <Card className="w-full max-w-xl overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_26px_70px_rgba(29,58,98,0.14)]">
        <CardContent className="p-7 text-center sm:p-10">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[var(--edunets-dark-blue)] text-white shadow-lg">
            {error ? <AlertCircle className="h-10 w-10" /> : <Users className="h-10 w-10" />}
          </span>

          {isLoading ? (
            <div className="mt-7" aria-busy="true">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[var(--edunets-dark-blue)]" />
              <p className="mt-3 font-bold">{t('squadInvite.checking')}</p>
            </div>
          ) : error ? (
            <div className="mt-7">
              <h1 className="text-3xl font-black text-[var(--edunets-dark-blue)]">{t('squadInvite.unavailable')}</h1>
              <p className="mt-3 text-sm font-medium leading-6 text-[var(--edunets-ink)]/70">
                {error instanceof Error ? error.message : t('squadInvite.cannotOpen')}
              </p>
              <Button onClick={() => navigate('/')} variant="outline" className="mt-6 rounded-full">
                {t('squadInvite.goToEdunets')}
              </Button>
            </div>
          ) : invitation ? (
            <div className="mt-7">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--edunets-light-blue)]">{t('squadInvite.title')}</p>
              <h1 className="mt-3 text-3xl font-black text-[var(--edunets-dark-blue)] sm:text-4xl">{t('squadInvite.join', { squad: invitation.squadName })}</h1>
              <p className="mx-auto mt-4 max-w-md font-medium leading-7 text-[var(--edunets-ink)]/70">
                {t('squadInvite.invitedBy', { name: invitation.inviterName })}
              </p>

              <div className="mt-8">
                {account ? (
                  <>
                    <p className="mb-4 text-sm font-semibold text-[var(--edunets-ink)]/70">
                      {t('squadInvite.signedInAs', { email: account.user.email })}
                    </p>
                    <Button
                      onClick={() => acceptMutation.mutate()}
                      disabled={acceptMutation.isPending}
                      className="w-full rounded-full bg-[var(--edunets-dark-blue)] text-white"
                    >
                      {acceptMutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {t('squadInvite.accept')}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <GoogleAuthButton
                      label={t('squadInvite.continueWithGoogle')}
                      busy={isGooglePending}
                      disabled={isGooglePending}
                      onClick={() => void continueWithGoogle()}
                    />
                    <div className="flex items-center gap-3" aria-hidden="true">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t('squadInvite.or')}</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(buildAuthPath('/login', invitePath))}
                      className="h-12 w-full rounded-full border-[var(--edunets-dark-blue)] font-black text-[var(--edunets-dark-blue)]"
                    >
                      <Mail className="h-4 w-4" /> {t('squadInvite.continueWithEmail')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate(buildAuthPath('/signup', invitePath))}
                      className="inline-flex items-center gap-2 text-sm font-black text-[var(--edunets-dark-blue)] hover:text-[var(--edunets-light-blue)] focus-visible:outline-none focus-visible:underline"
                    >
                      <UserPlus className="h-4 w-4" /> {t('squadInvite.createWithEmail')}
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--edunets-ink)]/60">
                <LogIn className="h-4 w-4" /> {t('squadInvite.emailOnly')}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
