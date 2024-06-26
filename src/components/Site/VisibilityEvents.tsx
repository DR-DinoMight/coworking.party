'use client';

import { useAtomValue } from 'jotai';
import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';
import { useRef } from 'react';

import usePageVisibility from '@/hooks/usePageVisibility';
import useUserData from '@/hooks/useUserData';

import { AWAY_TIME_THRESHOLD } from '@/config';
import { partySocketAtom } from '@/store';

export default function VisibilityEvents() {
  const { data: session } = useSession();
  const { updateUserData, userData } = useUserData();
  const ws = useAtomValue(partySocketAtom);
  const awayStartTimeRef = useRef<number | null>(null);

  usePageVisibility((isVisible: boolean) => {
    let awayTimeout: NodeJS.Timeout | undefined = undefined;

    if (!session || !ws) {
      console.error("Couldn't send visibility change: ", { ws, session });
      return;
    }

    if (isVisible) {
      if (awayTimeout) clearTimeout(awayTimeout);

      updateUserData({ data: { away: false, awayStartedAt: null } });

      const awayTime = awayStartTimeRef.current
        ? new Date().getTime() - awayStartTimeRef.current
        : null;
      posthog.capture('user no longer away', { userId: userData?.userId, awayTime });

      awayStartTimeRef.current = null;
    } else {
      // wait for the page to not be for a while before considering the user away
      awayTimeout = setTimeout(() => {
        // can't rely on isVisible here because it's in a closure?
        if (document.visibilityState === 'hidden') {
          const now = new Date();

          updateUserData({ data: { away: true, awayStartedAt: now } });
          awayStartTimeRef.current = now.getTime();

          posthog.capture('user away', {
            userId: userData?.userId,
            threshold: AWAY_TIME_THRESHOLD,
          });
        }
      }, AWAY_TIME_THRESHOLD);
    }
  });

  return null;
}
